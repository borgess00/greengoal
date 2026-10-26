// Radar de Escanteios (assinantes) e coleta leve (admin).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { RawBundle } from '@/lib/api-football-types'
import { cornerRows, rankCornerRows, type CornerFixtureInfo, type CornerTeamRow } from '@/lib/corners'
import { currentGradeDate, isValidDate } from '@/lib/grade'
import { requireAdmin, requireSubscriber } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { collectCornerData, footballConfigured, readCollectOptions } from './football.server'

export const getCornerRadar = createServerFn({ method: 'GET' })
  .middleware([requireSubscriber])
  .validator((d: { date?: string }) => z.object({ date: z.string().refine(isValidDate).optional() }).parse(d))
  .handler(async ({ data }) => {
    const date = data.date ?? currentGradeDate()
    const db = supabaseAdmin()
    const { data: fixtures, error } = await db
      .from('fixtures')
      .select('id, kickoff_at, local_time, league_name, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo')
      .eq('grade_date', date)
      .order('kickoff_at')
    if (error) throw new Error('Falha ao carregar partidas.')
    const list = (fixtures ?? []) as CornerFixtureInfo[]
    if (!list.length) return { date, rows: [] as CornerTeamRow[], fixtures: 0, covered: 0 }
    const { data: bundles } = await db.from('fixture_data').select('fixture_id, payload').in('fixture_id', list.map((f) => f.id))
    const byId = new Map((bundles ?? []).map((b) => [b.fixture_id as number, b.payload as Partial<RawBundle>]))
    const rows: CornerTeamRow[] = []
    let covered = 0
    for (const fx of list) {
      const b = byId.get(fx.id)
      if (!b?.lastFixtures || !b.matchStats) continue
      const r = cornerRows(fx, { lastFixtures: b.lastFixtures, matchStats: b.matchStats })
      if (r.length) covered++
      rows.push(...r)
    }
    return { date, rows: rankCornerRows(rows), fixtures: list.length, covered }
  })

export const collectCornersForFixture = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { fixtureId: number }) => z.object({ fixtureId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    if (!footballConfigured()) throw new Error('API_FOOTBALL_KEY não configurada nos segredos do servidor.')
    const r = await collectCornerData(data.fixtureId, await readCollectOptions())
    return { skipped: r.skipped, apiCalls: r.tracker.calls, apiRemaining: r.tracker.remaining }
  })
