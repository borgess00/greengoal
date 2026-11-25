// Estatísticas dos jogos recentes (painel da partida, destaque da página
// inicial) e busca de jogos. Lê só o banco: nunca chama a API-Football.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ApiFixture, ApiFixtureTeamStatistics } from '@/lib/api-football-types'
import { isFinished } from '@/lib/fixture-status'
import { addDays, currentGradeDate } from '@/lib/grade'
import { formString, marketAngles, rankMarkets, summarizeWindow, teamGames, type GameRow, type MarketAngles, type WindowSummary } from '@/lib/match-stats'
import type { FixtureRow } from '@/lib/types'
import { optionalAuth } from './auth-middleware'
import { userHasActiveSubscription, userIsAdmin } from './access.server'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { withForms } from './forms.server'

type Recent = {
  lastFixtures?: { home?: ApiFixture[]; away?: ApiFixture[] } | null
  matchStats?: Record<string, ApiFixtureTeamStatistics[]> | null
  h2h?: ApiFixture[] | null
}

/** Carrega só os jogos recentes e as estatísticas do pacote (sem jogadores, odds etc.). */
async function loadRecent(fixtureIds: number[]) {
  if (!fixtureIds.length) return new Map<number, Recent & { collected_at: string }>()
  const { data } = await supabaseAdmin()
    .from('fixture_data')
    .select('fixture_id, collected_at, lastFixtures:payload->lastFixtures, matchStats:payload->matchStats, h2h:payload->h2h')
    .in('fixture_id', fixtureIds)
  return new Map((data ?? []).map((r) => [r.fixture_id as number, r as unknown as Recent & { collected_at: string }]))
}

const STAT_FIXTURE_COLUMNS =
  'id, grade_date, kickoff_at, local_time, league_id, league_name, league_logo, status_short, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo'
type StatFixture = Pick<
  FixtureRow,
  | 'id'
  | 'grade_date'
  | 'kickoff_at'
  | 'local_time'
  | 'league_id'
  | 'league_name'
  | 'league_logo'
  | 'status_short'
  | 'home_team_id'
  | 'home_team_name'
  | 'home_team_logo'
  | 'away_team_id'
  | 'away_team_name'
  | 'away_team_logo'
>

export type MatchStatsResult =
  | { status: 'nodata'; isAdmin: boolean }
  | { status: 'locked'; needsLogin: boolean; form: { home: string; away: string } }
  | { status: 'ok'; isAdmin: boolean; collectedAt: string; home: GameRow[]; away: GameRow[]; h2hHome: GameRow[]; h2hAway: GameRow[] }

/**
 * Painel de estatísticas da partida. A forma recente (resultados) é pública;
 * os números detalhados vão só para assinantes ativos e administradores.
 */
export const getMatchStats = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .validator((d: { id: number }) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<MatchStatsResult> => {
    const db = supabaseAdmin()
    const { data: fx, error } = await db.from('fixtures').select('id, home_team_id, away_team_id').eq('id', data.id).maybeSingle()
    if (error || !fx) throw new Error('Partida não encontrada.')
    const userId = context.auth?.user.id
    const [sub, admin] = userId ? await Promise.all([userHasActiveSubscription(userId), userIsAdmin(userId)]) : [false, false]
    const recent = (await loadRecent([data.id])).get(data.id)
    if (!recent?.lastFixtures) return { status: 'nodata', isAdmin: admin }
    const home = teamGames(fx.home_team_id as number, recent.lastFixtures.home, recent.matchStats ?? undefined)
    const away = teamGames(fx.away_team_id as number, recent.lastFixtures.away, recent.matchStats ?? undefined)
    if (!home.length && !away.length) return { status: 'nodata', isAdmin: admin }
    // Mantém a forma dos cartões em dia (coletas antigas não tinham a coluna).
    await db
      .from('fixtures')
      .update({ form_home: formString(home, 10), form_away: formString(away, 10) })
      .eq('id', data.id)
      .then(
        () => undefined,
        () => undefined,
      )
    if (!sub && !admin) return { status: 'locked', needsLogin: !userId, form: { home: formString(home), away: formString(away) } }
    const h2h = recent.h2h ?? []
    return {
      status: 'ok',
      isAdmin: admin,
      collectedAt: recent.collected_at,
      home,
      away,
      h2hHome: teamGames(fx.home_team_id as number, h2h, recent.matchStats ?? undefined),
      h2hAway: teamGames(fx.away_team_id as number, h2h, recent.matchStats ?? undefined),
    }
  })

export interface FeaturedMatch {
  fixture: StatFixture
  window: number
  form: { home: string; away: string }
  home: WindowSummary | null
  away: WindowSummary | null
  /** Os mercados mais consistentes entre os ângulos (amostra de vitrine). */
  markets: MarketAngles[]
}

/**
 * Destaque da página inicial: uma partida de hoje (ainda por jogar, do
 * campeonato de maior prioridade) com o resumo dos últimos 5 jogos.
 */
export const getFeaturedMatch = createServerFn({ method: 'GET' }).handler(async (): Promise<FeaturedMatch | null> => {
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) return null
  const db = supabaseAdmin()
  const date = currentGradeDate()
  const [{ data: fixtures }, { data: leagues }] = await Promise.all([
    db.from('fixtures').select(STAT_FIXTURE_COLUMNS).eq('grade_date', date).order('kickoff_at').limit(500),
    db.from('leagues').select('id, priority'),
  ])
  const list = (fixtures ?? []) as StatFixture[]
  if (!list.length) return null
  const { data: withData } = await db.from('fixture_data').select('fixture_id').in('fixture_id', list.map((f) => f.id))
  const has = new Set((withData ?? []).map((r) => r.fixture_id as number))
  const prio = new Map((leagues ?? []).map((l) => [l.id as number, l.priority as number]))
  const now = Date.now()
  const candidates = list
    .filter((f) => has.has(f.id))
    .sort((a, b) => {
      const pa = isFinished(a.status_short) || Date.parse(a.kickoff_at) < now - 2 * 3600_000 ? 1 : 0
      const pb = isFinished(b.status_short) || Date.parse(b.kickoff_at) < now - 2 * 3600_000 ? 1 : 0
      return pa - pb || (prio.get(a.league_id) ?? 999) - (prio.get(b.league_id) ?? 999) || Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)
    })
  for (const fixture of candidates.slice(0, 5)) {
    const recent = (await loadRecent([fixture.id])).get(fixture.id)
    const home = teamGames(fixture.home_team_id, recent?.lastFixtures?.home, recent?.matchStats ?? undefined)
    const away = teamGames(fixture.away_team_id, recent?.lastFixtures?.away, recent?.matchStats ?? undefined)
    if (!home.length || !away.length) continue
    const h2h = recent?.h2h ?? []
    const markets = rankMarkets([
      ...marketAngles({
        team: fixture.home_team_name,
        side: 'home',
        games: home,
        venue: 'casa',
        league: fixture.league_name,
        opponent: fixture.away_team_name,
        h2h: teamGames(fixture.home_team_id, h2h, undefined),
      }),
      ...marketAngles({
        team: fixture.away_team_name,
        side: 'away',
        games: away,
        venue: 'fora',
        league: fixture.league_name,
        opponent: fixture.home_team_name,
        h2h: teamGames(fixture.away_team_id, h2h, undefined),
      }),
    ]).slice(0, 2)
    return {
      fixture,
      markets,
      window: 5,
      form: { home: formString(home), away: formString(away) },
      home: summarizeWindow(home, 5),
      away: summarizeWindow(away, 5),
    }
  }
  return null
})

/** Busca por time ou campeonato nas partidas salvas (7 dias para trás e para a frente). */
export const searchFixtures = createServerFn({ method: 'GET' })
  .validator((d: { q: string }) => z.object({ q: z.string().trim().max(60) }).parse(d))
  .handler(async ({ data }) => {
    // Remove caracteres especiais da sintaxe de filtro do PostgREST.
    const q = data.q.replace(/[,()%*\\:."']/g, ' ').replace(/\s+/g, ' ').trim()
    if (q.length < 2) return { q, fixtures: [] as FixtureRow[] }
    const today = currentGradeDate()
    const { data: rows, error } = await supabaseAdmin()
      .from('fixtures')
      .select(
        'id, grade_date, kickoff_at, local_time, league_id, league_name, league_country, league_logo, league_round, season, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo, venue, status_short, status_long, elapsed, goals_home, goals_away, ft_home, ft_away, ht_home, ht_away, referee, has_analysis, updated_at',
      )
      .gte('grade_date', addDays(today, -7))
      .lte('grade_date', addDays(today, 7))
      .or(`home_team_name.ilike."*${q}*",away_team_name.ilike."*${q}*",league_name.ilike."*${q}*"`)
      .order('kickoff_at', { ascending: true })
      .limit(60)
    if (error) throw new Error('Não foi possível buscar agora.')
    const list = (rows ?? []) as FixtureRow[]
    // Próximos jogos primeiro; os já disputados depois, do mais recente.
    const now = Date.now()
    const upcoming = list.filter((f) => Date.parse(f.kickoff_at) >= now - 2 * 3600_000)
    const past = list.filter((f) => Date.parse(f.kickoff_at) < now - 2 * 3600_000).reverse()
    return { q, fixtures: await withForms([...upcoming, ...past]) }
  })
