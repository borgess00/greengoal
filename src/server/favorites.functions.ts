// Times favoritos da pessoa logada. Leitura e escrita com o token do próprio
// usuário: o RLS do banco garante que cada um só mexe nos seus.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { addDays, currentGradeDate } from '@/lib/grade'
import type { FixtureRow } from '@/lib/types'
import { requireAuth } from './auth-middleware'
import { supabasePublic } from '@/integrations/supabase/supabase.server'
import { withForms } from './forms.server'

export interface FavoriteTeam {
  team_id: number
  team_name: string
  team_logo: string | null
}

const PENDING = 'Os favoritos ainda não foram ativados no banco (falta rodar a atualização do Supabase).'

export const getFavoriteTeams = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db.from('favorite_teams').select('team_id, team_name, team_logo').order('team_name')
    if (error) return { ready: false as const, message: PENDING, teams: [] as FavoriteTeam[] }
    return { ready: true as const, teams: (data ?? []) as FavoriteTeam[] }
  })

export const toggleFavoriteTeam = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { teamId: number; teamName: string; teamLogo?: string | null; on: boolean }) =>
    z
      .object({
        teamId: z.number().int().positive(),
        teamName: z.string().trim().min(1).max(120),
        teamLogo: z.string().url().max(500).nullish(),
        on: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.db
    if (data.on) {
      const { error } = await db
        .from('favorite_teams')
        .upsert({ user_id: context.user.id, team_id: data.teamId, team_name: data.teamName, team_logo: data.teamLogo ?? null }, { onConflict: 'user_id,team_id', ignoreDuplicates: true })
      if (error) throw new Error(/Limite/.test(error.message) ? 'Limite de 50 times favoritos atingido.' : PENDING)
    } else {
      const { error } = await db.from('favorite_teams').delete().eq('team_id', data.teamId)
      if (error) throw new Error(PENDING)
    }
    return { ok: true }
  })

/** Jogos dos times favoritos: de ontem até os próximos 7 dias já carregados. */
export const getFavoriteFixtures = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: favs, error } = await context.db.from('favorite_teams').select('team_id')
    if (error) return { ready: false as const, message: PENDING, fixtures: [] as FixtureRow[] }
    const ids = (favs ?? []).map((f) => f.team_id as number)
    if (!ids.length) return { ready: true as const, fixtures: [] as FixtureRow[] }
    const today = currentGradeDate()
    const list = ids.join(',')
    const { data: rows, error: e2 } = await supabasePublic()
      .from('fixtures')
      .select(
        'id, grade_date, kickoff_at, local_time, league_id, league_name, league_country, league_logo, league_round, season, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo, venue, status_short, status_long, elapsed, goals_home, goals_away, ft_home, ft_away, ht_home, ht_away, referee, has_analysis, updated_at',
      )
      .gte('grade_date', addDays(today, -1))
      .lte('grade_date', addDays(today, 7))
      .or(`home_team_id.in.(${list}),away_team_id.in.(${list})`)
      .order('kickoff_at')
      .limit(100)
    if (e2) throw new Error('Não foi possível carregar os jogos dos favoritos.')
    return { ready: true as const, fixtures: await withForms((rows ?? []) as FixtureRow[]) }
  })
