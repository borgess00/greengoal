// Leitura pública das partidas armazenadas (nunca chama a API-Football).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { currentGradeDate, isValidDate } from '@/lib/grade'
import type { FixtureRow, LeagueRow } from '@/lib/types'
import { supabasePublic } from '@/integrations/supabase/supabase.server'

const FIXTURE_COLUMNS =
  'id, grade_date, kickoff_at, local_time, league_id, league_name, league_country, league_logo, league_round, season, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo, venue, status_short, status_long, elapsed, goals_home, goals_away, ft_home, ft_away, ht_home, ht_away, referee, has_analysis, updated_at'

function dbConfigured() {
  return !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
}

const gradeInput = z.object({
  date: z.string().refine(isValidDate, 'Data inválida').optional(),
})

export const getGradeFixtures = createServerFn({ method: 'GET' })
  .validator((d: { date?: string }) => gradeInput.parse(d))
  .handler(async ({ data }) => {
    const date = data.date ?? currentGradeDate()
    if (!dbConfigured()) return { date, configured: false, fixtures: [] as FixtureRow[], leagues: [] as Pick<LeagueRow, 'id' | 'name' | 'country' | 'priority'>[] }
    const db = supabasePublic()
    const [fx, lg] = await Promise.all([
      db.from('fixtures').select(FIXTURE_COLUMNS).eq('grade_date', date).order('kickoff_at', { ascending: true }).limit(1000),
      db.from('leagues').select('id, name, country, priority'),
    ])
    if (fx.error) throw new Error('Não foi possível carregar os jogos.')
    return {
      date,
      configured: true,
      fixtures: (fx.data ?? []) as FixtureRow[],
      leagues: (lg.data ?? []) as Pick<LeagueRow, 'id' | 'name' | 'country' | 'priority'>[],
    }
  })

/** Até três partidas da grade atual para a página inicial (próximas primeiro). */
export const getHomeFixtures = createServerFn({ method: 'GET' }).handler(async () => {
  const date = currentGradeDate()
  if (!dbConfigured()) return { date, fixtures: [] as FixtureRow[] }
  const db = supabasePublic()
  const { data, error } = await db
    .from('fixtures')
    .select(FIXTURE_COLUMNS)
    .eq('grade_date', date)
    .order('kickoff_at', { ascending: true })
    .limit(300)
  if (error) return { date, fixtures: [] as FixtureRow[] }
  const rows = (data ?? []) as FixtureRow[]
  const now = Date.now()
  const upcoming = rows.filter((r) => Date.parse(r.kickoff_at) > now - 2 * 3600_000)
  const pick = (upcoming.length ? upcoming : rows).slice(0, 3)
  return { date, fixtures: pick }
})

export const getFixture = createServerFn({ method: 'GET' })
  .validator((d: { id: number }) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    if (!dbConfigured()) return null
    const { data: row, error } = await supabasePublic().from('fixtures').select(FIXTURE_COLUMNS).eq('id', data.id).maybeSingle()
    if (error) throw new Error('Não foi possível carregar a partida.')
    return (row as FixtureRow | null) ?? null
  })
