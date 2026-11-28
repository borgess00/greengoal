// Páginas de time, de campeonato e comparador. Leem só o banco (nunca a
// API-Football). Estatísticas detalhadas (finalizações, escanteios, cartões,
// posse) vão só para assinantes; quem não assina recebe resultados e gols.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ApiFixture, ApiFixtureTeamStatistics, ApiStandingRow } from '@/lib/api-football-types'
import { isFinished } from '@/lib/fixture-status'
import { addDays, currentGradeDate } from '@/lib/grade'
import { teamGames, type GameRow } from '@/lib/match-stats'
import type { FixtureRow } from '@/lib/types'
import { optionalAuth } from './auth-middleware'
import { userHasActiveSubscription, userIsAdmin } from './access.server'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { withForms } from './forms.server'

const FIXTURE_COLUMNS =
  'id, grade_date, kickoff_at, local_time, league_id, league_name, league_country, league_logo, league_round, season, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo, venue, status_short, status_long, elapsed, goals_home, goals_away, ft_home, ft_away, ht_home, ht_away, referee, has_analysis, updated_at'

export interface TeamInfo {
  id: number
  name: string
  logo: string | null
  leagueId: number | null
  leagueName: string | null
  leagueLogo: string | null
}

async function isPro(userId: string | undefined) {
  if (!userId) return false
  const [sub, admin] = await Promise.all([userHasActiveSubscription(userId), userIsAdmin(userId)])
  return sub || admin
}

const strip = (rows: GameRow[]) => rows.map((r) => ({ ...r, stats: null }))

/** Jogos recentes de um time a partir da coleta mais nova em que ele aparece. */
async function teamBundle(teamId: number) {
  const db = supabaseAdmin()
  const { data: fx } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, home_team_name, away_team_name, home_team_logo, away_team_logo, league_id, league_name, league_logo, kickoff_at')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('kickoff_at', { ascending: false })
    .limit(40)
  const list = fx ?? []
  if (!list.length) return null
  const first = list[0]
  const home = first.home_team_id === teamId
  const info: TeamInfo = {
    id: teamId,
    name: (home ? first.home_team_name : first.away_team_name) as string,
    logo: (home ? first.home_team_logo : first.away_team_logo) as string | null,
    leagueId: first.league_id as number,
    leagueName: first.league_name as string,
    leagueLogo: first.league_logo as string | null,
  }
  type Row = { fixture_id: number; lastFixtures?: { home?: ApiFixture[]; away?: ApiFixture[] } | null; matchStats?: Record<string, ApiFixtureTeamStatistics[]> | null; h2h?: ApiFixture[] | null }
  const { data: bundles } = await db
    .from('fixture_data')
    .select('fixture_id, lastFixtures:payload->lastFixtures, matchStats:payload->matchStats, h2h:payload->h2h')
    .in('fixture_id', list.map((f) => f.id as number))
  const byId = new Map(((bundles ?? []) as Row[]).map((b) => [b.fixture_id, b]))
  for (const f of list) {
    const b = byId.get(f.id as number)
    if (!b?.lastFixtures) continue
    const side = f.home_team_id === teamId ? 'home' : 'away'
    const games = teamGames(teamId, b.lastFixtures[side], b.matchStats ?? undefined)
    if (games.length) return { info, games, matchStats: b.matchStats ?? {}, h2h: b.h2h ?? [], opponentId: (side === 'home' ? f.away_team_id : f.home_team_id) as number }
  }
  return { info, games: [] as GameRow[], matchStats: {}, h2h: [] as ApiFixture[], opponentId: null }
}

function standingOf(table: ApiStandingRow[][] | null, teamId: number) {
  for (const group of table ?? []) {
    const row = group.find((r) => r.team.id === teamId)
    if (row) return row
  }
  return null
}

export const getTeam = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .validator((d: { id: number }) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const pro = await isPro(context.auth?.user.id)
    const b = await teamBundle(data.id)
    if (!b) return null
    const db = supabaseAdmin()
    const since = addDays(currentGradeDate(), -1)
    const [{ data: next }, { data: st }] = await Promise.all([
      db.from('fixtures').select(FIXTURE_COLUMNS).or(`home_team_id.eq.${data.id},away_team_id.eq.${data.id}`).gte('grade_date', since).order('kickoff_at').limit(10),
      b.info.leagueId ? db.from('league_standings').select('standings, season').eq('league_id', b.info.leagueId).order('season', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    ])
    const standing = standingOf((st?.[0]?.standings as ApiStandingRow[][] | undefined) ?? null, data.id)
    return {
      pro,
      team: b.info,
      games: pro ? b.games : strip(b.games),
      upcoming: await withForms(((next ?? []) as FixtureRow[]).filter((f) => !isFinished(f.status_short))),
      standing: standing ? { rank: standing.rank, points: standing.points, played: standing.all?.played ?? null, goalsDiff: standing.goalsDiff ?? null } : null,
    }
  })

export const getLeague = createServerFn({ method: 'GET' })
  .validator((d: { id: number }) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const db = supabaseAdmin()
    const today = currentGradeDate()
    const [{ data: lg }, { data: st }, { data: upcoming }, { data: finished }] = await Promise.all([
      db.from('leagues').select('id, name, country, logo').eq('id', data.id).maybeSingle(),
      db.from('league_standings').select('standings, season, updated_at').eq('league_id', data.id).order('season', { ascending: false }).limit(1),
      db.from('fixtures').select(FIXTURE_COLUMNS).eq('league_id', data.id).gte('grade_date', today).order('kickoff_at').limit(30),
      db.from('fixtures').select(FIXTURE_COLUMNS).eq('league_id', data.id).in('status_short', ['FT', 'AET', 'PEN']).order('kickoff_at', { ascending: false }).limit(300),
    ])
    const fin = (finished ?? []) as FixtureRow[]
    const anyFixture = (upcoming?.[0] ?? fin[0]) as FixtureRow | undefined
    if (!lg && !anyFixture) return null
    const scored = fin
      .map((f) => ({ h: f.ft_home ?? f.goals_home, a: f.ft_away ?? f.goals_away }))
      .filter((x): x is { h: number; a: number } => x.h != null && x.a != null)
    const n = scored.length
    const share = (fn: (x: { h: number; a: number }) => boolean) => (n ? Math.round((scored.filter(fn).length / n) * 100) : null)
    return {
      league: {
        id: data.id,
        name: (lg?.name as string | undefined) ?? anyFixture?.league_name ?? `Campeonato ${data.id}`,
        country: (lg?.country as string | null | undefined) ?? anyFixture?.league_country ?? null,
        logo: (lg?.logo as string | null | undefined) ?? anyFixture?.league_logo ?? null,
      },
      standings: ((st?.[0]?.standings as ApiStandingRow[][] | undefined) ?? []).map((g) =>
        g.map((r) => ({ rank: r.rank, teamId: r.team.id, team: r.team.name, logo: (r.team as { logo?: string | null }).logo ?? null, points: r.points, played: r.all?.played ?? null, win: r.all?.win ?? null, draw: r.all?.draw ?? null, lose: r.all?.lose ?? null, goalsDiff: r.goalsDiff ?? null, form: r.form ?? null, group: r.group ?? null })),
      ),
      standingsUpdated: (st?.[0]?.updated_at as string | undefined) ?? null,
      upcoming: await withForms(((upcoming ?? []) as FixtureRow[]).filter((f) => !isFinished(f.status_short))),
      results: fin.slice(0, 12),
      averages: n
        ? {
            games: n,
            goals: Math.round((scored.reduce((s, x) => s + x.h + x.a, 0) / n) * 100) / 100,
            over25: share((x) => x.h + x.a > 2.5),
            btts: share((x) => x.h > 0 && x.a > 0),
            homeWin: share((x) => x.h > x.a),
            draw: share((x) => x.h === x.a),
            awayWin: share((x) => x.h < x.a),
          }
        : null,
    }
  })

/** Times conhecidos pelo site (aparecem em alguma partida guardada). */
export const searchTeams = createServerFn({ method: 'GET' })
  .validator((d: { q: string }) => z.object({ q: z.string().trim().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const q = data.q.replace(/[,()%*\\:."']/g, ' ').trim()
    if (q.length < 2) return [] as TeamInfo[]
    const { data: rows } = await supabaseAdmin()
      .from('fixtures')
      .select('home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo, league_id, league_name, league_logo')
      .or(`home_team_name.ilike."*${q}*",away_team_name.ilike."*${q}*"`)
      .order('kickoff_at', { ascending: false })
      .limit(80)
    const out = new Map<number, TeamInfo>()
    const needle = q.toLowerCase()
    for (const r of rows ?? []) {
      for (const side of ['home', 'away'] as const) {
        const id = r[`${side}_team_id`] as number
        const name = r[`${side}_team_name`] as string
        if (!out.has(id) && name.toLowerCase().includes(needle)) {
          out.set(id, { id, name, logo: r[`${side}_team_logo`] as string | null, leagueId: r.league_id as number, leagueName: r.league_name as string, leagueLogo: r.league_logo as string | null })
        }
      }
    }
    return [...out.values()].slice(0, 12)
  })

export const getComparison = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .validator((d: { a: number; b: number }) => z.object({ a: z.coerce.number().int().positive(), b: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const pro = await isPro(context.auth?.user.id)
    const [a, b] = await Promise.all([teamBundle(data.a), teamBundle(data.b)])
    if (!a || !b) return null
    // Confronto direto: usa o h2h de uma coleta que tenha os dois times.
    const h2h = a.opponentId === data.b ? a.h2h : b.opponentId === data.a ? b.h2h : []
    const ms = { ...a.matchStats, ...b.matchStats }
    const h2hA = teamGames(data.a, h2h, ms)
    const h2hB = teamGames(data.b, h2h, ms)
    return {
      pro,
      a: { team: a.info, games: pro ? a.games : strip(a.games) },
      b: { team: b.info, games: pro ? b.games : strip(b.games) },
      h2hA: pro ? h2hA : strip(h2hA),
      h2hB: pro ? h2hB : strip(h2hB),
    }
  })
