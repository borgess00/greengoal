// Núcleo das operações que usam API-Football + IA. Usado pelo painel admin
// (via createServerFn) e pela automação diária (scripts/automacao.ts).
// Exclusivo do servidor.

import { pruneSections, sanitizeAi, scrubPromises, type AnalysisContent } from '@/lib/analysis'
import { buildFacts } from '@/lib/facts'
import { isFinished, isLive } from '@/lib/fixture-status'
import { currentGradeDate } from '@/lib/grade'
import {
  AI_TICKETS_SCHEMA,
  buildReadyTickets,
  isAiTicketsResponse,
  MARKET_CODES,
  oddsByCode,
  type ReadyTicketsContent,
  type TicketFixtureInfo,
} from '@/lib/ready-tickets'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { aiConfigured, generateAiAnalysis, structuredCall } from './ai.server'
import { collectFixtureBundle, footballConfigured, readCollectOptions, syncGrade } from './football.server'

const STALE_GENERATING_MS = 10 * 60_000

export type GenerateResult =
  | { ok: true; skipped?: boolean; used?: number; limit?: number }
  | { ok: false; limitReached: true; used: number; limit: number }
  | { ok: false; limitReached?: false; error: string; used?: number; limit?: number }

export async function logRun(kind: string, status: 'ok' | 'error', details: Record<string, unknown>, userId: string | null, fixtureId?: number, gradeDate?: string) {
  await supabaseAdmin()
    .from('sync_runs')
    .insert({ kind, status, details, started_by: userId, fixture_id: fixtureId ?? null, grade_date: gradeDate ?? null })
}

type Quota = { allowed: boolean; used: number; daily_limit: number }

async function consumeQuota(): Promise<Quota | null> {
  const { data, error } = await supabaseAdmin().rpc('consume_ai_call').single<Quota>()
  return error ? null : data
}

/** Gera (ou regenera) a análise de UMA partida. userId = null na automação. */
export async function generateAnalysisCore(fixtureId: number, force: boolean, userId: string | null): Promise<GenerateResult> {
  if (!footballConfigured()) return { ok: false, error: 'API_FOOTBALL_KEY não configurada nos segredos do servidor.' }
  if (!aiConfigured()) return { ok: false, error: 'Chave de IA não configurada nos segredos do servidor (ANTHROPIC_API_KEY).' }
  const db = supabaseAdmin()

  const { data: fixture } = await db.from('fixtures').select('id, grade_date').eq('id', fixtureId).maybeSingle()
  if (!fixture) return { ok: false, error: 'Partida não encontrada no banco.' }

  const { data: existing } = await db.from('analyses').select('status, updated_at').eq('fixture_id', fixtureId).maybeSingle()
  if (existing?.status === 'done' && !force) return { ok: true, skipped: true }
  if (existing?.status === 'generating' && Date.now() - Date.parse(existing.updated_at) < STALE_GENERATING_MS) {
    return { ok: false, error: 'Esta análise já está sendo gerada.' }
  }

  // Teto diário GLOBAL, controlado de forma atômica no banco.
  const quota = await consumeQuota()
  if (!quota) return { ok: false, error: 'Falha ao verificar o limite diário de IA.' }
  if (!quota.allowed) return { ok: false, limitReached: true, used: quota.used, limit: quota.daily_limit }

  await db.from('analyses').upsert({ fixture_id: fixtureId, status: 'generating', error: null, generated_by: userId })

  // 1) Coleta dos dados de apoio. Falha aqui devolve a cota (IA não foi chamada).
  let collected: Awaited<ReturnType<typeof collectFixtureBundle>>
  try {
    collected = await collectFixtureBundle(fixtureId, await readCollectOptions())
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha na coleta de dados.'
    await db.rpc('refund_ai_call')
    await db.from('analyses').update({ status: 'error', error: `Coleta: ${message}` }).eq('fixture_id', fixtureId)
    await logRun('generate', 'error', { stage: 'collect', message }, userId, fixtureId, fixture.grade_date)
    return { ok: false, error: message, used: quota.used - 1, limit: quota.daily_limit }
  }

  // 2) Geração pela IA.
  try {
    const { facts, display, support } = buildFacts(collected.bundle)
    const { analysis, model, usage } = await generateAiAnalysis(facts, support)
    const clean = sanitizeAi(analysis)
    const { secoes, removed } = pruneSections(clean, support)
    const content: AnalysisContent = {
      ...clean,
      secoes,
      display,
      meta: {
        model,
        generated_at: new Date().toISOString(),
        sources: Object.fromEntries(Object.entries(collected.sources).map(([k, v]) => [k, v === true])),
        removed_sections: removed,
      },
    }
    const { error } = await db
      .from('analyses')
      .update({ status: 'done', content: content as never, model, error: null, generated_at: content.meta.generated_at, generated_by: userId })
      .eq('fixture_id', fixtureId)
    if (error) throw new Error(`Falha ao salvar: ${error.message}`)
    await logRun(
      'generate',
      'ok',
      { api_calls: collected.tracker.calls, cached: collected.tracker.cached, api_remaining: collected.tracker.remaining, usage, removed },
      userId,
      fixtureId,
      fixture.grade_date,
    )
    return { ok: true, used: quota.used, limit: quota.daily_limit }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha na geração.'
    await db.from('analyses').update({ status: 'error', error: message }).eq('fixture_id', fixtureId)
    await logRun('generate', 'error', { stage: 'ai', message }, userId, fixtureId, fixture.grade_date)
    return { ok: false, error: message, used: quota.used, limit: quota.daily_limit }
  }
}

// ---------------------------------------------------------------------
// Bilhetes prontos
// ---------------------------------------------------------------------

export const TICKETS_PROMPT = `Você é o analista do GreenGoal, site brasileiro de informação sobre futebol para maiores de 18 anos.
Sua tarefa: montar BILHETES PRONTOS do dia a partir das análises já publicadas, em português do Brasil.

DADOS
- Você recebe a lista de partidas do dia que ainda não começaram, cada uma com resumo, confiança dos dados, mercados em destaque da análise (com probabilidade estimada, frequência, risco, motivos a favor e contra) e as odds reais disponíveis (código do mercado, odd e probabilidade implícita sem a margem).
- Use SOMENTE essas informações. Não invente jogos, números, odds, escalações ou estatísticas.
- "fixture_id" deve ser exatamente o id de uma partida recebida.

COMO MONTAR
- Organize em três níveis de risco, nesta ordem: "baixo", "medio" e "medio-alto". Pode haver mais de um bilhete por nível quando os dados sustentarem; não há limite fixo de jogos, mas só entre o que tiver base real.
  - baixo: seleções de maior probabilidade estimada, dados consistentes, poucas condições. Ainda podem perder.
  - medio: fundamento estatístico razoável, mais variabilidade.
  - medio-alto: potencial interessante, mas dependente de contexto ou de eventos menos frequentes.
- O risco reflete probabilidade, variabilidade e qualidade dos dados — nunca só a linha ou a odd. Bilhetes com muitas seleções têm risco maior: a chance combinada cai a cada jogo.
- Uma seleção por partida em cada bilhete. Evite seleções correlacionadas no mesmo bilhete e não repita a mesma conclusão em mercados diferentes.
- Prefira mercados com odd real disponível e use o "codigo" correspondente. Mercados sem odd na lista (ex.: escanteios totais, finalizações) usam codigo "outro" e entram só com sustentação clara.
- Dê preferência a seleções que a análise já destacou. Partidas com confiança de dados baixa entram com cautela, se entrarem.
- "probabilidade_estimada": inteiro conservador de 1 a 99 (a da análise, quando houver) ou null. Não confunda frequência histórica com probabilidade.
- Considere valor: compare a probabilidade estimada com a implícita da odd; não trate favorito como sinônimo de boa aposta.
- Não force bilhetes: se não houver base para um nível, não monte bilhete daquele nível. Lista vazia é aceitável.
- Escanteios: a fonte só traz totais por partida; nunca monte seleções de escanteios em intervalos de tempo (ex.: 10 primeiros minutos).
- "titulo": curto (ex.: "Bilhete conservador"). "resumo": 1 a 2 frases sobre a lógica do bilhete e o principal risco. "justificativa" de cada seleção: 1 a 2 frases com os números que a sustentam.
- "observacoes": alertas gerais (escalações não confirmadas, amostras pequenas, mercados evitados e por quê).

PROIBIDO: prometer lucro, ganho ou acerto; usar "garantido", "certeza", "aposta certa", "sem risco", "100%". Apostas envolvem risco.`

export type TicketsResult = { ok: true; tickets: number } | { ok: false; limitReached?: boolean; error: string }

/** Gera os bilhetes prontos do dia a partir das análises concluídas. */
export async function generateReadyTicketsCore(date: string, userId: string | null): Promise<TicketsResult> {
  if (!aiConfigured()) return { ok: false, error: 'Chave de IA não configurada nos segredos do servidor (ANTHROPIC_API_KEY).' }
  const db = supabaseAdmin()

  const { data: fx, error: fxError } = await db
    .from('fixtures')
    .select('id, kickoff_at, local_time, league_name, home_team_name, away_team_name, status_short')
    .eq('grade_date', date)
  if (fxError) return { ok: false, error: 'Falha ao carregar partidas.' }
  const upcoming = (fx ?? []).filter((f) => !isFinished(f.status_short as string) && !isLive(f.status_short as string) && Date.parse(f.kickoff_at as string) > Date.now())
  if (!upcoming.length) return { ok: false, error: 'Não há partidas a começar nesta data.' }

  const { data: an } = await db
    .from('analyses')
    .select('fixture_id, content')
    .eq('status', 'done')
    .in('fixture_id', upcoming.map((f) => f.id as number))
  const analyses = (an ?? []) as Array<{ fixture_id: number; content: AnalysisContent }>
  if (!analyses.length) return { ok: false, error: 'Nenhuma partida a começar tem análise concluída nesta data.' }

  const fixtures: TicketFixtureInfo[] = []
  const input = analyses.map((a) => {
    const f = upcoming.find((u) => u.id === a.fixture_id)!
    const odds = oddsByCode(a.content.display?.odds)
    fixtures.push({
      id: a.fixture_id,
      home: f.home_team_name as string,
      away: f.away_team_name as string,
      league: f.league_name as string,
      kickoff_at: f.kickoff_at as string,
      local_time: f.local_time as string,
      odds,
    })
    return {
      fixture_id: a.fixture_id,
      jogo: `${f.home_team_name} x ${f.away_team_name}`,
      competicao: f.league_name,
      horario_brasilia: f.local_time,
      confianca_dados: a.content.confianca_dados,
      resumo: a.content.resumo,
      destaques: a.content.destaques,
      alertas: a.content.alertas,
      odds_disponiveis: Object.entries(odds).map(([codigo, q]) => ({ codigo, odd: q!.odd, probabilidade_implicita: q!.implied })),
    }
  })

  const quota = await consumeQuota()
  if (!quota) return { ok: false, error: 'Falha ao verificar o limite diário de IA.' }
  if (!quota.allowed) return { ok: false, limitReached: true, error: `Limite diário de IA atingido (${quota.used}/${quota.daily_limit}).` }

  await db.from('daily_tickets').upsert({ grade_date: date, status: 'generating', error: null })
  try {
    const { json, model, usage } = await structuredCall({
      name: 'greengoal_tickets',
      system: TICKETS_PROMPT,
      user: JSON.stringify({ data: date, codigos_de_mercado: MARKET_CODES, partidas: input }),
      schema: AI_TICKETS_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 6000,
    })
    if (!isAiTicketsResponse(json)) throw new Error('A resposta da IA não segue o formato esperado.')
    // Rede de segurança contra promessas nos textos.
    for (const t of json.bilhetes) {
      t.titulo = scrubPromises(t.titulo) || 'Bilhete'
      t.resumo = scrubPromises(t.resumo)
      for (const s of t.selecoes) s.justificativa = scrubPromises(s.justificativa)
    }
    json.observacoes = json.observacoes.map(scrubPromises).filter(Boolean)
    const built = buildReadyTickets(json, fixtures)
    const content: ReadyTicketsContent = {
      date,
      ...built,
      model,
      generated_at: new Date().toISOString(),
      fixtures_considered: fixtures.length,
    }
    await db
      .from('daily_tickets')
      .update({ status: 'done', content: content as never, model, error: null, generated_at: content.generated_at })
      .eq('grade_date', date)
    await logRun('tickets', 'ok', { tickets: built.bilhetes.length, fixtures: fixtures.length, usage }, userId, undefined, date)
    return { ok: true, tickets: built.bilhetes.length }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha na geração dos bilhetes.'
    await db.from('daily_tickets').update({ status: 'error', error: message }).eq('grade_date', date)
    await logRun('tickets', 'error', { message }, userId, undefined, date)
    return { ok: false, error: message }
  }
}

// ---------------------------------------------------------------------
// Automação diária
// ---------------------------------------------------------------------

async function readNumberSetting(key: string, fallback: number) {
  const { data } = await supabaseAdmin().from('app_settings').select('value').eq('key', key).maybeSingle()
  const v = Number(data?.value)
  return Number.isFinite(v) ? v : fallback
}

export interface AutomationReport {
  date: string
  skipped?: string
  synced?: number
  generated: number
  failed: number
  limitReached: boolean
  tickets?: string
  log: string[]
}

/**
 * Rotina automática: busca os jogos do dia, gera as análises que faltam
 * (prioridade por campeonato e horário, até o limite configurado) e, em
 * seguida, os bilhetes prontos.
 */
export async function runAutomation(opts: { date?: string; log?: (msg: string) => void } = {}): Promise<AutomationReport> {
  const date = opts.date ?? currentGradeDate()
  const out: AutomationReport = { date, generated: 0, failed: 0, limitReached: false, log: [] }
  const say = (m: string) => {
    out.log.push(m)
    opts.log?.(m)
  }
  const db = supabaseAdmin()

  if (!(await readNumberSetting('auto_enabled', 1))) {
    out.skipped = 'Automação desligada no painel.'
    say(out.skipped)
    return out
  }
  if (!footballConfigured() || !aiConfigured()) {
    out.skipped = 'Chaves da API-Football e/ou da IA ausentes.'
    say(out.skipped)
    return out
  }

  // 1) Jogos do dia.
  try {
    const r = await syncGrade(date)
    out.synced = r.saved
    say(`Jogos salvos para ${date}: ${r.saved} (restantes na API-Football: ${r.tracker.remaining ?? '?'})`)
    await logRun('sync', 'ok', { saved: r.saved, fetched: r.fetched, api_calls: r.tracker.calls, api_remaining: r.tracker.remaining, auto: true }, null, undefined, date)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    say(`Falha ao buscar jogos: ${message}`)
    await logRun('sync', 'error', { message, auto: true }, null, undefined, date)
  }

  // 2) Análises que faltam, das partidas que ainda não começaram.
  const max = Math.max(0, await readNumberSetting('auto_max_analyses', 4))
  const [{ data: fixtures }, { data: leagues }, { data: analyses }] = await Promise.all([
    db.from('fixtures').select('id, league_id, kickoff_at, status_short, home_team_name, away_team_name').eq('grade_date', date),
    db.from('leagues').select('id, priority'),
    db.from('analyses').select('fixture_id, status'),
  ])
  const prio = new Map((leagues ?? []).map((l) => [l.id as number, l.priority as number]))
  const done = new Set((analyses ?? []).filter((a) => a.status === 'done').map((a) => a.fixture_id as number))
  const queue = (fixtures ?? [])
    .filter((f) => !done.has(f.id as number) && Date.parse(f.kickoff_at as string) > Date.now() + 10 * 60_000)
    .sort((a, b) => (prio.get(a.league_id as number) ?? 999) - (prio.get(b.league_id as number) ?? 999) || Date.parse(a.kickoff_at as string) - Date.parse(b.kickoff_at as string))
    .slice(0, max)
  say(`Análises a gerar nesta execução: ${queue.length} (limite configurado: ${max})`)

  for (const f of queue) {
    const r = await generateAnalysisCore(f.id as number, true, null)
    const name = `${f.home_team_name} x ${f.away_team_name}`
    if (r.ok) {
      out.generated++
      say(`✓ ${name}`)
    } else if ('limitReached' in r && r.limitReached) {
      out.limitReached = true
      say(`Teto diário de IA atingido (${r.used}/${r.limit}). Parando.`)
      break
    } else {
      out.failed++
      say(`✗ ${name}: ${'error' in r ? r.error : 'erro'}`)
      // Cota da API-Football esgotada: não adianta continuar.
      if ('error' in r && /request limit|requests? (per day|limit)|reached the limit/i.test(r.error)) break
    }
  }

  // 3) Bilhetes prontos do dia.
  if (!out.limitReached) {
    const t = await generateReadyTicketsCore(date, null)
    out.tickets = t.ok ? `${t.tickets} bilhete(s) gerado(s)` : `sem bilhetes: ${t.error}`
    say(`Bilhetes: ${out.tickets}`)
  }

  await logRun('auto', out.failed && !out.generated ? 'error' : 'ok', { generated: out.generated, failed: out.failed, limitReached: out.limitReached, tickets: out.tickets }, null, undefined, date)
  return out
}
