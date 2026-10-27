// Leitura protegida e geração das análises.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { pruneSections, sanitizeAi, type AnalysisContent } from '@/lib/analysis'
import { buildFacts } from '@/lib/facts'
import type { AnalysisRow } from '@/lib/types'
import { optionalAuth, requireAdmin } from './auth-middleware'
import { userHasActiveSubscription, userIsAdmin } from './access.server'
import { supabaseAdmin, supabaseAsUser } from '@/integrations/supabase/supabase.server'
import { aiConfigured, generateAiAnalysis } from './ai.server'
import { collectFixtureBundle, footballConfigured, readCollectOptions } from './football.server'

const STALE_GENERATING_MS = 10 * 60_000

const idInput = z.object({ fixtureId: z.coerce.number().int().positive() })

export type AnalysisAccess =
  | { access: 'login' }
  | { access: 'locked' }
  | { access: 'granted'; analysis: Pick<AnalysisRow, 'status' | 'content' | 'generated_at'> | null; isAdmin: boolean }

/**
 * Devolve a análise somente para assinantes ativos ou administradores.
 * A leitura usa o token do próprio usuário, então o RLS do banco também
 * filtra: mesmo que a checagem acima falhasse, o conteúdo não sairia.
 */
export const getAnalysisAccess = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .validator((d: { fixtureId: number }) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<AnalysisAccess> => {
    if (!context.auth) return { access: 'login' }
    const userId = context.auth.user.id
    const [sub, admin] = await Promise.all([userHasActiveSubscription(userId), userIsAdmin(userId)])
    if (!sub && !admin) return { access: 'locked' }
    const { data: row, error } = await supabaseAsUser(context.auth.token)
      .from('analyses')
      .select('status, content, generated_at')
      .eq('fixture_id', data.fixtureId)
      .maybeSingle()
    if (error) throw new Error('Não foi possível carregar a análise.')
    const visible = row && row.status === 'done' ? (row as AccessRow) : null
    return { access: 'granted', analysis: visible, isAdmin: admin }
  })

type AccessRow = Pick<AnalysisRow, 'status' | 'content' | 'generated_at'>

export type GenerateResult =
  | { ok: true; skipped?: boolean; used?: number; limit?: number }
  | { ok: false; limitReached: true; used: number; limit: number }
  | { ok: false; limitReached?: false; error: string; used?: number; limit?: number }

async function logRun(kind: string, status: 'ok' | 'error', details: Record<string, unknown>, userId: string, fixtureId?: number, gradeDate?: string) {
  await supabaseAdmin()
    .from('sync_runs')
    .insert({ kind, status, details, started_by: userId, fixture_id: fixtureId ?? null, grade_date: gradeDate ?? null })
}

/**
 * Gera (ou regenera) a análise de UMA partida. Chamado pelo painel admin,
 * inclusive no lote do dia, que chama esta função em sequência e para ao
 * atingir o teto diário global.
 */
export const generateAnalysis = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { fixtureId: number; force?: boolean }) =>
    z.object({ fixtureId: z.coerce.number().int().positive(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<GenerateResult> => {
    if (!footballConfigured()) return { ok: false, error: 'API_FOOTBALL_KEY não configurada nos segredos do servidor.' }
    if (!aiConfigured()) return { ok: false, error: 'Chave de IA não configurada nos segredos do servidor (ANTHROPIC_API_KEY).' }
    const db = supabaseAdmin()
    const userId = context.user.id

    const { data: fixture } = await db.from('fixtures').select('id, grade_date').eq('id', data.fixtureId).maybeSingle()
    if (!fixture) return { ok: false, error: 'Partida não encontrada no banco.' }

    const { data: existing } = await db.from('analyses').select('status, updated_at').eq('fixture_id', data.fixtureId).maybeSingle()
    if (existing?.status === 'done' && !data.force) return { ok: true, skipped: true }
    if (existing?.status === 'generating' && Date.now() - Date.parse(existing.updated_at) < STALE_GENERATING_MS) {
      return { ok: false, error: 'Esta análise já está sendo gerada.' }
    }

    // Teto diário GLOBAL, controlado de forma atômica no banco.
    const { data: quota, error: quotaError } = await db.rpc('consume_ai_call').single<{ allowed: boolean; used: number; daily_limit: number }>()
    if (quotaError || !quota) return { ok: false, error: 'Falha ao verificar o limite diário de IA.' }
    if (!quota.allowed) return { ok: false, limitReached: true, used: quota.used, limit: quota.daily_limit }

    await db.from('analyses').upsert({ fixture_id: data.fixtureId, status: 'generating', error: null, generated_by: userId })

    // 1) Coleta dos dados de apoio. Falha aqui devolve a cota (IA não foi chamada).
    let collected: Awaited<ReturnType<typeof collectFixtureBundle>>
    try {
      collected = await collectFixtureBundle(data.fixtureId, await readCollectOptions())
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha na coleta de dados.'
      await db.rpc('refund_ai_call')
      await db.from('analyses').update({ status: 'error', error: `Coleta: ${message}` }).eq('fixture_id', data.fixtureId)
      await logRun('generate', 'error', { stage: 'collect', message }, userId, data.fixtureId, fixture.grade_date)
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
        .eq('fixture_id', data.fixtureId)
      if (error) throw new Error(`Falha ao salvar: ${error.message}`)
      await logRun(
        'generate',
        'ok',
        { api_calls: collected.tracker.calls, cached: collected.tracker.cached, api_remaining: collected.tracker.remaining, usage, removed },
        userId,
        data.fixtureId,
        fixture.grade_date,
      )
      return { ok: true, used: quota.used, limit: quota.daily_limit }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha na geração.'
      await db.from('analyses').update({ status: 'error', error: message }).eq('fixture_id', data.fixtureId)
      await logRun('generate', 'error', { stage: 'ai', message }, userId, data.fixtureId, fixture.grade_date)
      return { ok: false, error: message, used: quota.used, limit: quota.daily_limit }
    }
  })
