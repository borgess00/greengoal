// Resultado das partidas encerradas: estatísticas finais e gols (público).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ApiFixtureTeamStatistics } from '@/lib/api-football-types'
import { matchEvents, statGroups, type ApiEvent, type MatchEvent, type StatGroup } from '@/lib/match-result'
import { requireAdmin } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { collectFixtureResult, footballConfigured } from './football.server'

export type MatchResult = { available: false } | { available: true; groups: StatGroup[]; events: MatchEvent[]; collectedAt: string }

export const getMatchResult = createServerFn({ method: 'GET' })
  .validator((d: { id: number }) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<MatchResult> => {
    const db = supabaseAdmin()
    const [{ data: fx }, { data: row, error }] = await Promise.all([
      db.from('fixtures').select('home_team_id, away_team_id').eq('id', data.id).maybeSingle(),
      db.from('fixture_results').select('stats, events, collected_at').eq('fixture_id', data.id).maybeSingle(),
    ])
    // Sem a atualização do banco a tabela não existe: trata como "ainda sem dados".
    if (error || !row || !fx) return { available: false }
    const home = fx.home_team_id as number
    const away = fx.away_team_id as number
    return {
      available: true,
      groups: statGroups(row.stats as ApiFixtureTeamStatistics[], home, away),
      events: matchEvents(row.events as ApiEvent[], home, away),
      collectedAt: row.collected_at as string,
    }
  })

export const collectResultForFixture = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { fixtureId: number }) => z.object({ fixtureId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    if (!footballConfigured()) throw new Error('API_FOOTBALL_KEY não configurada nos segredos do servidor.')
    const r = await collectFixtureResult(data.fixtureId)
    return { apiCalls: r.tracker.calls, events: r.events }
  })
