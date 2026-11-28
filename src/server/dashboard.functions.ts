// Painel (estilo app esportivo): destaques do dia com mercados testados por
// ângulo, grandes jogos de hoje, resultados e resumo dos bilhetes da pessoa.
// Quem não assina recebe os destaques SEM o nome do mercado: a ocultação é
// feita aqui no servidor, então o mercado nunca chega ao navegador.
import { createServerFn } from '@tanstack/react-start'
import type { ApiFixture, ApiFixtureTeamStatistics, ApiOdds } from '@/lib/api-football-types'
import { impliedMarkets } from '@/lib/facts'
import { isFinished, isLive } from '@/lib/fixture-status'
import { addDays, currentGradeDate, spParts } from '@/lib/grade'
import { marketAngles, rankMarkets, teamGames, type AngleHit, type MarketAngles } from '@/lib/match-stats'
import { oddsByCode } from '@/lib/ready-tickets'
import { performance, type SlipPerformance } from '@/lib/slips'
import { optionalAuth } from './auth-middleware'
import { userHasActiveSubscription, userIsAdmin } from './access.server'
import { supabaseAdmin, supabaseAsUser } from '@/integrations/supabase/supabase.server'
import { settleSlips, type SlipRow } from './slips.server'

const COLUMNS =
  'id, grade_date, kickoff_at, local_time, league_id, league_name, league_logo, status_short, elapsed, goals_home, goals_away, ft_home, ft_away, home_team_id, home_team_name, home_team_logo, away_team_id, away_team_name, away_team_logo'

interface Fx {
  id: number
  grade_date: string
  kickoff_at: string
  local_time: string
  league_id: number
  league_name: string
  league_logo: string | null
  status_short: string
  elapsed: number | null
  goals_home: number | null
  goals_away: number | null
  ft_home: number | null
  ft_away: number | null
  home_team_id: number
  home_team_name: string
  home_team_logo: string | null
  away_team_id: number
  away_team_name: string
  away_team_logo: string | null
  form_home?: string | null
  form_away?: string | null
  hot_markets?: number | null
}

export interface PickCard {
  key: string
  fixtureId: number
  home: string
  away: string
  homeLogo: string | null
  awayLogo: string | null
  league: string
  localTime: string
  team: string
  teamLogo: string | null
  /** null = oculto (só assinantes veem o mercado). */
  market: string | null
  rate: number
  angles: AngleHit[]
  hiddenAngles: number
}

export interface BigGame extends Fx {
  odds: { casa: number | null; empate: number | null; fora: number | null; bookmaker: string | null } | null
}

export interface DashboardData {
  date: string
  pro: boolean
  loggedIn: boolean
  picks: PickCard[]
  picksTotal: number
  bigGames: BigGame[]
  results: Fx[]
  slips: (SlipPerformance & { today: number }) | null
}

// Cache curto por instância: os destaques mudam só quando a coleta roda.
let picksCache: { at: number; date: string; list: Array<MarketAngles & { fx: Fx }> } | null = null
const PICKS_TTL = 5 * 60_000

async function computePicks(date: string, fixtures: Fx[], priority: Map<number, number>) {
  if (picksCache && picksCache.date === date && Date.now() - picksCache.at < PICKS_TTL) return picksCache.list
  const now = Date.now()
  const upcoming = fixtures
    .filter((f) => !isFinished(f.status_short) && !isLive(f.status_short) && Date.parse(f.kickoff_at) > now - 10 * 60_000)
    .sort((a, b) => (priority.get(a.league_id) ?? 999) - (priority.get(b.league_id) ?? 999) || Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))
    .slice(0, 24)
  if (!upcoming.length) return []
  const { data } = await supabaseAdmin()
    .from('fixture_data')
    .select('fixture_id, lastFixtures:payload->lastFixtures, matchStats:payload->matchStats, h2h:payload->h2h')
    .in('fixture_id', upcoming.map((f) => f.id))
  type Row = { fixture_id: number; lastFixtures?: { home?: ApiFixture[]; away?: ApiFixture[] } | null; matchStats?: Record<string, ApiFixtureTeamStatistics[]> | null; h2h?: ApiFixture[] | null }
  const byId = new Map(((data ?? []) as Row[]).map((r) => [r.fixture_id, r]))
  const all: Array<MarketAngles & { fx: Fx }> = []
  for (const fx of upcoming) {
    const r = byId.get(fx.id)
    if (!r?.lastFixtures) continue
    const ms = r.matchStats ?? undefined
    const h2h = r.h2h ?? []
    const list = [
      ...marketAngles({ team: fx.home_team_name, side: 'home', games: teamGames(fx.home_team_id, r.lastFixtures.home, ms), venue: 'casa', league: fx.league_name, opponent: fx.away_team_name, h2h: teamGames(fx.home_team_id, h2h, ms) }),
      ...marketAngles({ team: fx.away_team_name, side: 'away', games: teamGames(fx.away_team_id, r.lastFixtures.away, ms), venue: 'fora', league: fx.league_name, opponent: fx.home_team_name, h2h: teamGames(fx.away_team_id, h2h, ms) }),
    ]
    // No máximo 2 destaques por partida, para variar os jogos.
    all.push(...rankMarkets(list).slice(0, 2).map((m) => ({ ...m, fx })))
  }
  const ranked = rankMarkets(all) as Array<MarketAngles & { fx: Fx }>
  picksCache = { at: Date.now(), date, list: ranked }
  return ranked
}

function toCard(m: MarketAngles & { fx: Fx }, pro: boolean): PickCard {
  const visible = pro ? m.angles : m.angles.slice(0, 3)
  return {
    key: `${m.fx.id}-${m.key}`,
    fixtureId: m.fx.id,
    home: m.fx.home_team_name,
    away: m.fx.away_team_name,
    homeLogo: m.fx.home_team_logo,
    awayLogo: m.fx.away_team_logo,
    league: m.fx.league_name,
    localTime: m.fx.local_time,
    team: m.team,
    teamLogo: m.side === 'home' ? m.fx.home_team_logo : m.fx.away_team_logo,
    market: pro ? m.market : null,
    rate: m.rate,
    angles: visible,
    hiddenAngles: m.angles.length - visible.length,
  }
}

export const getDashboard = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .handler(async ({ context }): Promise<DashboardData> => {
    const date = currentGradeDate()
    const userId = context.auth?.user.id
    const [sub, admin] = userId ? await Promise.all([userHasActiveSubscription(userId), userIsAdmin(userId)]) : [false, false]
    const pro = sub || admin
    const empty: DashboardData = { date, pro, loggedIn: !!userId, picks: [], picksTotal: 0, bigGames: [], results: [], slips: null }
    if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) return empty

    const db = supabaseAdmin()
    const yesterday = addDays(date, -1)
    const [{ data: rows }, { data: leagues }] = await Promise.all([
      db.from('fixtures').select(COLUMNS).in('grade_date', [yesterday, date]).order('kickoff_at').limit(1500),
      db.from('leagues').select('id, priority'),
    ])
    const priority = new Map((leagues ?? []).map((l) => [l.id as number, l.priority as number]))
    const byPrio = (a: Fx, b: Fx) => (priority.get(a.league_id) ?? 999) - (priority.get(b.league_id) ?? 999) || Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)
    const all = (rows ?? []) as Fx[]
    const today = all.filter((f) => f.grade_date === date)

    // Destaques do dia.
    const picks = await computePicks(date, today, priority)

    // Grandes jogos de hoje (ainda por jogar ou ao vivo), com odds 1X2 quando houver.
    const big = today.filter((f) => !isFinished(f.status_short)).sort(byPrio).slice(0, 10)
    const { data: oddsRows } = big.length ? await db.from('fixture_data').select('fixture_id, odds:payload->odds').in('fixture_id', big.map((f) => f.id)) : { data: [] }
    const oddsById = new Map(((oddsRows ?? []) as Array<{ fixture_id: number; odds: ApiOdds | null }>).map((r) => [r.fixture_id, r.odds]))
    const forms = await formsFor([...big.map((f) => f.id)])
    const bigGames: BigGame[] = big.map((f) => {
      const q = oddsByCode(impliedMarkets(oddsById.get(f.id) ?? null))
      const has = q.casa || q.empate || q.fora
      return {
        ...f,
        ...forms.get(f.id),
        odds: has ? { casa: q.casa?.odd ?? null, empate: q.empate?.odd ?? null, fora: q.fora?.odd ?? null, bookmaker: q.casa?.bookmaker ?? q.fora?.bookmaker ?? null } : null,
      }
    })

    // Resultados: encerradas de hoje e de ontem.
    const results = all.filter((f) => isFinished(f.status_short)).sort((a, b) => Date.parse(b.kickoff_at) - Date.parse(a.kickoff_at)).sort(byPrio).slice(0, 12)

    // Resumo de "Meus bilhetes".
    let slips: DashboardData['slips'] = null
    if (context.auth) {
      const { data: mine, error } = await supabaseAsUser(context.auth.token).from('user_slips').select('*').order('created_at', { ascending: false }).limit(500)
      if (!error) {
        const settled = await settleSlips((mine ?? []) as SlipRow[])
        slips = { ...performance(settled.map((s) => ({ status: s.status, odd_total: s.odd_total == null ? null : Number(s.odd_total), stake_units: Number(s.stake_units) }))), today: settled.filter((s) => spParts(s.created_at).date === date).length }
      }
    }

    return {
      date,
      pro,
      loggedIn: !!userId,
      picks: picks.slice(0, 12).map((m) => toCard(m, pro)),
      picksTotal: picks.length,
      bigGames,
      results,
      slips,
    }
  })

async function formsFor(ids: number[]) {
  type F = { form_home: string | null; form_away: string | null; hot_markets?: number | null }
  if (!ids.length) return new Map<number, F>()
  const full = await supabaseAdmin().from('fixtures').select('id, form_home, form_away, hot_markets').in('id', ids)
  const res = full.error ? await supabaseAdmin().from('fixtures').select('id, form_home, form_away').in('id', ids) : full
  if (res.error) return new Map<number, F>()
  return new Map(((res.data ?? []) as Array<F & { id: number }>).map((r) => [r.id, { form_home: r.form_home, form_away: r.form_away, hot_markets: r.hot_markets ?? null }]))
}
