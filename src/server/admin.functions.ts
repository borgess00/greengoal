// Operações administrativas. Toda função passa por requireAdmin, que
// confere o papel em user_roles no servidor.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isValidDate, spToday } from '@/lib/grade'
import type { AnalysisStatus, FixtureRow, LeagueRow } from '@/lib/types'
import { requireAdmin } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { aiConfigured, aiKeyName, aiModel } from './ai.server'
import { footballConfigured, syncGrade, verifyLeagues } from './football.server'

const dateInput = z.object({ date: z.string().refine(isValidDate, 'Data inválida') })

export interface AdminFixture extends Pick<FixtureRow, 'id' | 'kickoff_at' | 'local_time' | 'league_name' | 'league_country' | 'league_id' | 'home_team_name' | 'away_team_name' | 'status_short' | 'goals_home' | 'goals_away'> {
  analysis: { status: AnalysisStatus; error: string | null; updated_at: string; generated_at: string | null } | null
  has_data: boolean
}

export const adminOverview = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator((d: { date: string }) => dateInput.parse(d))
  .handler(async ({ data }) => {
    const db = supabaseAdmin()
    const [fx, usage, limit, runs] = await Promise.all([
      db
        .from('fixtures')
        .select('id, kickoff_at, local_time, league_name, league_country, league_id, home_team_name, away_team_name, status_short, goals_home, goals_away')
        .eq('grade_date', data.date)
        .order('kickoff_at', { ascending: true })
        .limit(1000),
      db.from('ai_usage').select('calls').eq('day', spToday()).maybeSingle(),
      db.from('app_settings').select('value').eq('key', 'ai_daily_limit').maybeSingle(),
      db.from('sync_runs').select('id, kind, status, details, grade_date, fixture_id, created_at').order('created_at', { ascending: false }).limit(15),
    ])
    if (fx.error) throw new Error('Falha ao carregar partidas.')
    const ids = (fx.data ?? []).map((f) => f.id as number)
    const [an, fd] = ids.length
      ? await Promise.all([
          db.from('analyses').select('fixture_id, status, error, updated_at, generated_at').in('fixture_id', ids),
          db.from('fixture_data').select('fixture_id').in('fixture_id', ids),
        ])
      : [{ data: [] as never[] }, { data: [] as never[] }]
    const byId = new Map((an.data ?? []).map((a: { fixture_id: number }) => [a.fixture_id, a]))
    const withData = new Set((fd.data ?? []).map((r: { fixture_id: number }) => r.fixture_id))
    const fixtures: AdminFixture[] = (fx.data ?? []).map((f) => {
      const a = byId.get(f.id as number) as AdminFixture['analysis'] & { fixture_id: number } | undefined
      return {
        ...(f as Omit<AdminFixture, 'analysis' | 'has_data'>),
        analysis: a ? { status: a.status, error: a.error, updated_at: a.updated_at, generated_at: a.generated_at } : null,
        has_data: withData.has(f.id as number),
      }
    })
    const lastRemaining = (runs.data ?? []).map((r) => (r.details as { api_remaining?: number | null })?.api_remaining).find((v) => typeof v === 'number') ?? null
    return {
      date: data.date,
      fixtures,
      usage: { day: spToday(), used: (usage.data?.calls as number | undefined) ?? 0, limit: Number(limit.data?.value ?? 50) || 50 },
      config: { football: footballConfigured(), ai: aiConfigured(), model: aiModel(), aiKey: aiKeyName() },
      apiRemaining: lastRemaining as number | null,
      runs: runs.data ?? [],
    }
  })

export const syncFixtures = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { date: string }) => dateInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!footballConfigured()) throw new Error('API_FOOTBALL_KEY não configurada nos segredos do servidor.')
    const db = supabaseAdmin()
    try {
      const r = await syncGrade(data.date)
      await db.from('sync_runs').insert({
        kind: 'sync',
        status: 'ok',
        grade_date: data.date,
        started_by: context.user.id,
        details: { saved: r.saved, fetched: r.fetched, api_calls: r.tracker.calls, api_remaining: r.tracker.remaining },
      })
      return { saved: r.saved, fetched: r.fetched, apiRemaining: r.tracker.remaining }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao sincronizar.'
      await db.from('sync_runs').insert({ kind: 'sync', status: 'error', grade_date: data.date, started_by: context.user.id, details: { message } })
      throw new Error(message)
    }
  })

// ---------------------------------------------------------------------
// Campeonatos
// ---------------------------------------------------------------------

export const listLeagues = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const { data, error } = await supabaseAdmin().from('leagues').select('*').order('priority').order('name')
    if (error) throw new Error('Falha ao carregar campeonatos.')
    return (data ?? []) as LeagueRow[]
  })

export const updateLeague = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { id: number; enabled: boolean }) => z.object({ id: z.number().int().positive(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin().from('leagues').update({ enabled: data.enabled }).eq('id', data.id)
    if (error) throw new Error('Falha ao atualizar campeonato.')
    return { ok: true }
  })

export const addLeague = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { id: number; name: string; country?: string }) =>
    z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(80), country: z.string().trim().max(60).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin()
      .from('leagues')
      .upsert({ id: data.id, name: data.name, country: data.country ?? null, priority: 200, enabled: true, verified: false })
    if (error) throw new Error('Falha ao adicionar campeonato.')
    return { ok: true }
  })

export const verifyLeaguesFn = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { ids?: number[] }) => z.object({ ids: z.array(z.number().int().positive()).max(100).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!footballConfigured()) throw new Error('API_FOOTBALL_KEY não configurada nos segredos do servidor.')
    let ids = data.ids
    if (!ids?.length) {
      const { data: rows } = await supabaseAdmin().from('leagues').select('id').eq('verified', false)
      ids = (rows ?? []).map((r) => r.id as number)
    }
    const r = await verifyLeagues(ids)
    await supabaseAdmin()
      .from('sync_runs')
      .insert({ kind: 'leagues', status: 'ok', started_by: context.user.id, details: { checked: ids.length, api_calls: r.tracker.calls, api_remaining: r.tracker.remaining } })
    return r.results
  })

// ---------------------------------------------------------------------
// Configurações de coleta
// ---------------------------------------------------------------------

const SETTINGS_KEYS = ['collect_last_matches', 'collect_match_stats', 'collect_player_pages', 'auto_enabled', 'auto_max_analyses'] as const

export const getSettings = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const { data } = await supabaseAdmin().from('app_settings').select('key, value')
    return Object.fromEntries((data ?? []).map((r) => [r.key, typeof r.value === 'boolean' ? (r.value ? 1 : 0) : Number(r.value)])) as Record<string, number>
  })

export const updateSettings = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: Partial<Record<(typeof SETTINGS_KEYS)[number], number | boolean>>) =>
    z
      .object({
        collect_last_matches: z.number().int().min(1).max(20).optional(),
        collect_match_stats: z.number().int().min(0).max(10).optional(),
        collect_player_pages: z.number().int().min(0).max(5).optional(),
        auto_enabled: z.boolean().optional(),
        auto_max_analyses: z.number().int().min(0).max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const rows = Object.entries(data)
      .filter(([, v]) => v != null)
      .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
    if (rows.length) {
      const { error } = await supabaseAdmin().from('app_settings').upsert(rows)
      if (error) throw new Error('Falha ao salvar configurações.')
    }
    return { ok: true }
  })
