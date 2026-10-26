// Helpers EXCLUSIVOS do servidor para a API-Football (API-Sports).
// A chave API_FOOTBALL_KEY fica só nos segredos do servidor.
//
// Estratégia de consumo:
// - /fixtures?date=... traz todas as partidas do dia em uma chamada; o filtro
//   pelos campeonatos habilitados é feito aqui. Assim a cobertura de ligas
//   não multiplica o número de chamadas.
// - Respostas imutáveis (estatísticas de partidas encerradas) ficam no
//   api_cache para sempre; respostas que mudam têm validade curta.

import type {
  ApiEnvelope,
  ApiFixture,
  ApiFixtureTeamStatistics,
  ApiInjury,
  ApiOdds,
  ApiPlayerEntry,
  ApiPrediction,
  ApiStandingRow,
  ApiTeamStatistics,
  RawBundle,
} from '@/lib/api-football-types'
import { FINISHED } from '@/lib/fixture-status'
import { addDays, gradeDateFor, periodFor, spParts, TIMEZONE } from '@/lib/grade'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

// API_FOOTBALL_BASE_URL permite apontar para um servidor de testes local.
const BASE_URL = process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io'

export function footballConfigured() {
  return !!process.env.API_FOOTBALL_KEY?.trim()
}

export interface CallTracker {
  calls: number
  cached: number
  remaining: number | null
}

export function newTracker(): CallTracker {
  return { calls: 0, cached: 0, remaining: null }
}

class ApiFootballError extends Error {}

async function request<T>(path: string, params: Record<string, string | number>, tracker: CallTracker): Promise<ApiEnvelope<T>> {
  const key = process.env.API_FOOTBALL_KEY?.trim()
  if (!key) throw new ApiFootballError('API_FOOTBALL_KEY não configurada nos segredos do servidor.')
  const url = new URL(BASE_URL + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(20_000) })
      tracker.calls++
      const remaining = res.headers.get('x-ratelimit-requests-remaining')
      if (remaining != null && remaining !== '') tracker.remaining = Number(remaining)
      if (res.status === 429 || res.status >= 500) {
        lastError = new ApiFootballError(`API-Football respondeu ${res.status}`)
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
        continue
      }
      if (!res.ok) throw new ApiFootballError(`API-Football respondeu ${res.status}`)
      const body = (await res.json()) as ApiEnvelope<T>
      const errors = body.errors
      const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && typeof errors === 'object' && Object.keys(errors).length > 0
      if (hasErrors) {
        const msg = Object.values(errors as Record<string, string>).join('; ')
        if (/rate ?limit|too many/i.test(msg) && attempt < 2) {
          lastError = new ApiFootballError(msg)
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
          continue
        }
        throw new ApiFootballError(`API-Football: ${msg}`)
      }
      return body
    } catch (e) {
      lastError = e
      if (e instanceof ApiFootballError) throw e
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new ApiFootballError('Falha ao consultar a API-Football.')
}

/** Consulta com cache no banco. ttlSeconds = null => não expira. */
async function cached<T>(
  key: string,
  ttlSeconds: number | null,
  tracker: CallTracker,
  fetcher: () => Promise<T>,
): Promise<T> {
  const db = supabaseAdmin()
  const { data } = await db.from('api_cache').select('payload, expires_at').eq('key', key).maybeSingle()
  if (data && (!data.expires_at || Date.parse(data.expires_at) > Date.now())) {
    tracker.cached++
    return data.payload as T
  }
  const payload = await fetcher()
  await db.from('api_cache').upsert({
    key,
    payload: payload as never,
    fetched_at: new Date().toISOString(),
    expires_at: ttlSeconds == null ? null : new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  })
  return payload
}

// ---------------------------------------------------------------------
// Partidas
// ---------------------------------------------------------------------

export async function fetchFixturesByDate(date: string, tracker: CallTracker) {
  const body = await request<ApiFixture[]>('/fixtures', { date, timezone: TIMEZONE }, tracker)
  return body.response ?? []
}

export async function fetchFixturesByIds(ids: number[], tracker: CallTracker) {
  const out: ApiFixture[] = []
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    const body = await request<ApiFixture[]>('/fixtures', { ids: chunk.join('-'), timezone: TIMEZONE }, tracker)
    out.push(...(body.response ?? []))
  }
  return out
}

/** Converte a partida da API na linha da tabela fixtures. */
export function toFixtureRow(f: ApiFixture) {
  const local = spParts(f.fixture.date)
  const ft = f.score?.fulltime
  const ht = f.score?.halftime
  return {
    id: f.fixture.id,
    grade_date: gradeDateFor(f.fixture.date),
    kickoff_at: new Date(f.fixture.date).toISOString(),
    local_time: local.time,
    period: periodFor(f.fixture.date),
    league_id: f.league.id,
    league_name: f.league.name,
    league_country: f.league.country ?? null,
    league_logo: f.league.logo ?? null,
    league_round: f.league.round ?? null,
    season: f.league.season,
    home_team_id: f.teams.home.id,
    home_team_name: f.teams.home.name,
    home_team_logo: f.teams.home.logo ?? null,
    away_team_id: f.teams.away.id,
    away_team_name: f.teams.away.name,
    away_team_logo: f.teams.away.logo ?? null,
    venue: f.fixture.venue?.name ?? null,
    status_short: f.fixture.status.short,
    status_long: f.fixture.status.long ?? null,
    elapsed: f.fixture.status.elapsed ?? null,
    goals_home: f.goals.home,
    goals_away: f.goals.away,
    ft_home: ft?.home ?? null,
    ft_away: ft?.away ?? null,
    ht_home: ht?.home ?? null,
    ht_away: ht?.away ?? null,
    referee: f.fixture.referee ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function enabledLeagueIds(): Promise<Set<number>> {
  const { data, error } = await supabaseAdmin().from('leagues').select('id').eq('enabled', true)
  if (error) throw new Error('Falha ao ler campeonatos habilitados.')
  return new Set((data ?? []).map((r) => r.id as number))
}

/**
 * Sincroniza a grade de uma data: busca a data e o dia seguinte (madrugada),
 * filtra os campeonatos habilitados e grava/atualiza as partidas.
 */
export async function syncGrade(gradeDate: string) {
  const tracker = newTracker()
  const leagues = await enabledLeagueIds()
  const [day, next] = await Promise.all([
    fetchFixturesByDate(gradeDate, tracker),
    fetchFixturesByDate(addDays(gradeDate, 1), tracker),
  ])
  const seen = new Set<number>()
  const rows = [...day, ...next]
    .filter((f) => leagues.has(f.league.id))
    .filter((f) => (seen.has(f.fixture.id) ? false : (seen.add(f.fixture.id), true)))
    .map(toFixtureRow)
  // Grava somente as partidas que pertencem à grade pedida. As demais do
  // dia seguinte ficam para a sincronização daquela data (grade completa).
  const gradeRows = rows.filter((r) => r.grade_date === gradeDate)
  if (gradeRows.length) {
    const { error } = await supabaseAdmin().from('fixtures').upsert(gradeRows, { onConflict: 'id' })
    if (error) throw new Error(`Falha ao gravar partidas: ${error.message}`)
  }
  return { saved: gradeRows.length, fetched: day.length + next.length, tracker }
}

/** Atualiza status/placar de partidas já armazenadas. */
export async function refreshFixtures(ids: number[], tracker: CallTracker = newTracker()) {
  if (!ids.length || !footballConfigured()) return { updated: 0, tracker }
  const list = await fetchFixturesByIds(ids, tracker)
  // Linhas completas: se o horário mudou, grade e período são recalculados.
  const rows = list.map(toFixtureRow)
  if (rows.length) {
    const { error } = await supabaseAdmin().from('fixtures').upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`Falha ao atualizar partidas: ${error.message}`)
  }
  return { updated: rows.length, tracker }
}

// ---------------------------------------------------------------------
// Dados de apoio para a análise
// ---------------------------------------------------------------------

export interface CollectOptions {
  lastMatches: number // jogos recentes por equipe
  matchStats: number // quantos desses jogos terão estatísticas detalhadas
  playerPages: number // páginas de /players por equipe (20 jogadores por página)
}

export async function readCollectOptions(): Promise<CollectOptions> {
  const { data } = await supabaseAdmin().from('app_settings').select('key, value').in('key', ['collect_last_matches', 'collect_match_stats', 'collect_player_pages'])
  const get = (k: string, d: number, max: number) => {
    const v = Number((data ?? []).find((r) => r.key === k)?.value)
    return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : d
  }
  return {
    lastMatches: Math.max(1, get('collect_last_matches', 10, 20)),
    matchStats: get('collect_match_stats', 5, 10),
    playerPages: get('collect_player_pages', 2, 5),
  }
}

type Step<T> = { ok: true; value: T } | { ok: false; error: string }

async function step<T>(fn: () => Promise<T>): Promise<Step<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function playersOf(teamId: number, season: number, pages: number, tracker: CallTracker) {
  const out: ApiPlayerEntry[] = []
  for (let page = 1; page <= pages; page++) {
    const body = await cached(`players:${teamId}:${season}:${page}`, 12 * 3600, tracker, () =>
      request<ApiPlayerEntry[]>('/players', { team: teamId, season, page }, tracker),
    )
    out.push(...(body.response ?? []))
    if (!body.paging || body.paging.current >= body.paging.total) break
  }
  return out
}

async function matchStatistics(fixtureId: number, tracker: CallTracker) {
  // Estatística de partida encerrada não muda: cache permanente.
  return cached(`fixture-stats:${fixtureId}`, null, tracker, async () => {
    const body = await request<ApiFixtureTeamStatistics[]>('/fixtures/statistics', { fixture: fixtureId }, tracker)
    return body.response ?? []
  })
}

/** Coleta todos os dados de apoio de uma partida. Falhas parciais viram ausências. */
export async function collectFixtureBundle(fixtureId: number, opts: CollectOptions) {
  const tracker = newTracker()
  const fx = await fetchFixturesByIds([fixtureId], tracker)
  const fixture = fx[0]
  if (!fixture) throw new Error('Partida não encontrada na API-Football.')
  const homeId = fixture.teams.home.id
  const awayId = fixture.teams.away.id
  const season = fixture.league.season
  const leagueId = fixture.league.id
  const hour = 3600

  const [h2h, predictions, statsHome, statsAway, lastHome, lastAway, injuries, odds, standings] = await Promise.all([
    step(() =>
      cached(`h2h:${Math.min(homeId, awayId)}-${Math.max(homeId, awayId)}`, 12 * hour, tracker, async () =>
        (await request<ApiFixture[]>('/fixtures/headtohead', { h2h: `${homeId}-${awayId}`, last: 10, timezone: TIMEZONE }, tracker)).response ?? [],
      ),
    ),
    step(() =>
      cached(`predictions:${fixtureId}`, 6 * hour, tracker, async () =>
        (await request<ApiPrediction[]>('/predictions', { fixture: fixtureId }, tracker)).response?.[0] ?? null,
      ),
    ),
    step(() =>
      cached(`team-stats:${leagueId}:${season}:${homeId}`, 12 * hour, tracker, async () =>
        (await request<ApiTeamStatistics>('/teams/statistics', { league: leagueId, season, team: homeId }, tracker)).response ?? null,
      ),
    ),
    step(() =>
      cached(`team-stats:${leagueId}:${season}:${awayId}`, 12 * hour, tracker, async () =>
        (await request<ApiTeamStatistics>('/teams/statistics', { league: leagueId, season, team: awayId }, tracker)).response ?? null,
      ),
    ),
    step(() =>
      cached(`last:${homeId}:${opts.lastMatches}`, 6 * hour, tracker, async () =>
        (await request<ApiFixture[]>('/fixtures', { team: homeId, last: opts.lastMatches, timezone: TIMEZONE }, tracker)).response ?? [],
      ),
    ),
    step(() =>
      cached(`last:${awayId}:${opts.lastMatches}`, 6 * hour, tracker, async () =>
        (await request<ApiFixture[]>('/fixtures', { team: awayId, last: opts.lastMatches, timezone: TIMEZONE }, tracker)).response ?? [],
      ),
    ),
    step(async () => (await request<ApiInjury[]>('/injuries', { fixture: fixtureId }, tracker)).response ?? []),
    step(() =>
      cached(`odds:${fixtureId}`, 3 * hour, tracker, async () =>
        (await request<ApiOdds[]>('/odds', { fixture: fixtureId }, tracker)).response?.[0] ?? null,
      ),
    ),
    step(() =>
      cached(`standings:${leagueId}:${season}`, 6 * hour, tracker, async () =>
        (await request<Array<{ league: { standings: ApiStandingRow[][] } }>>('/standings', { league: leagueId, season }, tracker)).response?.[0]?.league
          ?.standings ?? null,
      ),
    ),
  ])

  const [playersHome, playersAway] = await Promise.all([
    step(() => playersOf(homeId, season, opts.playerPages, tracker)),
    step(() => playersOf(awayId, season, opts.playerPages, tracker)),
  ])

  // Estatísticas detalhadas (escanteios, finalizações, cartões) dos jogos recentes.
  const recent = (list: Step<ApiFixture[]>) =>
    (list.ok ? list.value : [])
      .filter((f) => FINISHED.has(f.fixture.status.short))
      .sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date))
      .slice(0, opts.matchStats)
      .map((f) => f.fixture.id)
  const statIds = [...new Set([...recent(lastHome), ...recent(lastAway)])]
  const matchStats: Record<string, ApiFixtureTeamStatistics[]> = {}
  let statsErrors = 0
  for (const id of statIds) {
    const r = await step(() => matchStatistics(id, tracker))
    if (r.ok && r.value.length) matchStats[String(id)] = r.value
    else if (!r.ok) statsErrors++
  }

  const bundle: RawBundle = {
    fixture,
    h2h: h2h.ok ? h2h.value : [],
    predictions: predictions.ok ? predictions.value : null,
    teamStats: { home: statsHome.ok ? statsHome.value : null, away: statsAway.ok ? statsAway.value : null },
    lastFixtures: { home: lastHome.ok ? lastHome.value : [], away: lastAway.ok ? lastAway.value : [] },
    matchStats,
    injuries: injuries.ok ? injuries.value : [],
    odds: odds.ok ? odds.value : null,
    players: { home: playersHome.ok ? playersHome.value : [], away: playersAway.ok ? playersAway.value : [] },
    standings: standings.ok ? standings.value : null,
  }

  const sources: Record<string, boolean | string> = {
    h2h: h2h.ok || h2h.error,
    predictions: predictions.ok || predictions.error,
    team_stats_home: statsHome.ok || statsHome.error,
    team_stats_away: statsAway.ok || statsAway.error,
    last_home: lastHome.ok || lastHome.error,
    last_away: lastAway.ok || lastAway.error,
    injuries: injuries.ok || injuries.error,
    odds: odds.ok || odds.error,
    standings: standings.ok || standings.error,
    players_home: playersHome.ok || playersHome.error,
    players_away: playersAway.ok || playersAway.error,
    match_stats: statsErrors === 0 ? true : `${statsErrors} falha(s)`,
  }

  // Atualiza a própria partida (status, árbitro etc.).
  await supabaseAdmin().from('fixtures').upsert(toFixtureRow(fixture), { onConflict: 'id' })

  await supabaseAdmin()
    .from('fixture_data')
    .upsert({ fixture_id: fixtureId, payload: bundle as never, sources, api_calls: tracker.calls, collected_at: new Date().toISOString() })

  return { bundle, sources, tracker }
}

/** Confere IDs de campeonatos na API e atualiza nome, país e logo. */
export async function verifyLeagues(ids: number[]) {
  const tracker = newTracker()
  const results: Array<{ id: number; ok: boolean; name?: string }> = []
  for (const id of ids) {
    const r = await step(() => request<Array<{ league: { id: number; name: string; logo?: string }; country?: { name?: string } }>>('/leagues', { id }, tracker))
    const item = r.ok ? r.value.response?.[0] : undefined
    if (item) {
      await supabaseAdmin()
        .from('leagues')
        .update({ api_name: item.league.name, api_country: item.country?.name ?? null, logo: item.league.logo ?? null, verified: true })
        .eq('id', id)
      results.push({ id, ok: true, name: item.league.name })
    } else if (r.ok) {
      await supabaseAdmin().from('leagues').update({ enabled: false, verified: false }).eq('id', id)
      results.push({ id, ok: false })
    } else {
      results.push({ id, ok: false })
    }
  }
  return { results, tracker }
}

/**
 * Coleta leve para o Radar de Escanteios: só jogos recentes e estatísticas
 * por partida das duas equipes (não usa IA). Não sobrescreve uma coleta
 * completa já existente.
 */
export async function collectCornerData(fixtureId: number, opts: CollectOptions) {
  const tracker = newTracker()
  const db = supabaseAdmin()
  const { data: fx } = await db.from('fixtures').select('id, home_team_id, away_team_id').eq('id', fixtureId).maybeSingle()
  if (!fx) throw new Error('Partida não encontrada no banco.')
  const { data: existing } = await db.from('fixture_data').select('sources').eq('fixture_id', fixtureId).maybeSingle()
  if (existing && !(existing.sources as Record<string, unknown>)?.light) return { skipped: true, tracker }

  const last = (teamId: number) =>
    cached(`last:${teamId}:${opts.lastMatches}`, 6 * 3600, tracker, async () =>
      (await request<ApiFixture[]>('/fixtures', { team: teamId, last: opts.lastMatches, timezone: TIMEZONE }, tracker)).response ?? [],
    )
  const [home, away] = await Promise.all([last(fx.home_team_id as number), last(fx.away_team_id as number)])
  const recent = (list: ApiFixture[]) =>
    list
      .filter((f) => FINISHED.has(f.fixture.status.short))
      .sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date))
      .slice(0, Math.max(opts.matchStats, 1))
      .map((f) => f.fixture.id)
  const matchStats: Record<string, ApiFixtureTeamStatistics[]> = {}
  for (const id of [...new Set([...recent(home), ...recent(away)])]) {
    const r = await step(() => matchStatistics(id, tracker))
    if (r.ok && r.value.length) matchStats[String(id)] = r.value
  }
  await db.from('fixture_data').upsert({
    fixture_id: fixtureId,
    payload: { lastFixtures: { home, away }, matchStats } as never,
    sources: { light: true },
    api_calls: tracker.calls,
    collected_at: new Date().toISOString(),
  })
  return { skipped: false, tracker }
}
