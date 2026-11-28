// Estatísticas dos jogos recentes de cada equipe, por janela (últimos 5, 10…).
// Tudo vem dos jogos coletados da API-Football: quando um número não existe
// (ex.: partida sem estatística detalhada), ele fica null — nunca é estimado.

import type { ApiFixture, ApiFixtureTeamStatistics } from './api-football-types'
import { FINISHED } from './fixture-status'
import { spParts } from './grade'

export type Result = 'V' | 'E' | 'D'

export interface GameStats {
  shots: number | null
  shotsOn: number | null
  shotsAgainst: number | null
  cornersFor: number | null
  cornersAgainst: number | null
  yellow: number | null
  red: number | null
  yellowOpp: number | null
  redOpp: number | null
  possession: number | null
  fouls: number | null
}

export interface GameRow {
  fixtureId: number
  date: string // AAAA-MM-DD (Brasília)
  league: string
  venue: 'casa' | 'fora'
  opponent: string
  opponentLogo: string | null
  gf: number
  ga: number
  result: Result
  /** Estatística detalhada da partida (null quando a fonte não tem). */
  stats: GameStats | null
}

const STAT_TYPES: Record<string, string> = {
  shots: 'Total Shots',
  shotsOn: 'Shots on Goal',
  corners: 'Corner Kicks',
  yellow: 'Yellow Cards',
  red: 'Red Cards',
  possession: 'Ball Possession',
  fouls: 'Fouls',
}

function statOf(entry: ApiFixtureTeamStatistics, key: keyof typeof STAT_TYPES): number | null {
  const s = entry.statistics.find((x) => x.type === STAT_TYPES[key])
  if (!s) return null
  // A API manda null quando cartões/escanteios são zero.
  if (s.value == null) return key === 'possession' || key === 'shots' || key === 'shotsOn' ? null : 0
  const n = typeof s.value === 'number' ? s.value : Number(String(s.value).replace('%', ''))
  return Number.isFinite(n) ? n : null
}

function score(f: ApiFixture): { home: number; away: number } | null {
  const ft = f.score?.fulltime
  if (ft && ft.home != null && ft.away != null) return { home: ft.home, away: ft.away }
  if (f.goals.home != null && f.goals.away != null) return { home: f.goals.home, away: f.goals.away }
  return null
}

/** Jogos encerrados da equipe, do mais recente para o mais antigo. */
export function teamGames(teamId: number, fixtures: ApiFixture[] | undefined, matchStats: Record<string, ApiFixtureTeamStatistics[]> | undefined): GameRow[] {
  const seen = new Set<number>()
  return (fixtures ?? [])
    .filter((f) => FINISHED.has(f.fixture.status.short) && score(f) && (f.teams.home.id === teamId || f.teams.away.id === teamId))
    .sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date))
    .filter((f) => (seen.has(f.fixture.id) ? false : (seen.add(f.fixture.id), true)))
    .map((f) => {
      const s = score(f)!
      const isHome = f.teams.home.id === teamId
      const gf = isHome ? s.home : s.away
      const ga = isHome ? s.away : s.home
      const opp = isHome ? f.teams.away : f.teams.home
      const entries = matchStats?.[String(f.fixture.id)] ?? []
      const mine = entries.find((e) => e.team.id === teamId)
      const theirs = entries.find((e) => e.team.id !== teamId)
      return {
        fixtureId: f.fixture.id,
        date: spParts(f.fixture.date).date,
        league: f.league.name,
        venue: isHome ? 'casa' : 'fora',
        opponent: opp.name,
        opponentLogo: opp.logo ?? null,
        gf,
        ga,
        result: gf > ga ? 'V' : gf < ga ? 'D' : 'E',
        stats:
          mine && theirs
            ? {
                shots: statOf(mine, 'shots'),
                shotsOn: statOf(mine, 'shotsOn'),
                shotsAgainst: statOf(theirs, 'shots'),
                cornersFor: statOf(mine, 'corners'),
                cornersAgainst: statOf(theirs, 'corners'),
                yellow: statOf(mine, 'yellow'),
                red: statOf(mine, 'red'),
                yellowOpp: statOf(theirs, 'yellow'),
                redOpp: statOf(theirs, 'red'),
                possession: statOf(mine, 'possession'),
                fouls: statOf(mine, 'fouls'),
              }
            : null,
      } satisfies GameRow
    })
}

/** Sequência V/E/D (mais recente primeiro). */
export function formString(rows: GameRow[], n = 5): string {
  return rows
    .slice(0, n)
    .map((r) => r.result)
    .join('')
}

export interface WindowSummary {
  games: number
  /** Jogos da janela com estatística detalhada (finalizações, escanteios…). */
  statGames: number
  record: { v: number; e: number; d: number }
  goalsFor: number
  goalsAgainst: number
  goalsTotal: number
  over15: number
  over25: number
  btts: number
  cleanSheets: number
  failedToScore: number
  shots: number | null
  shotsOn: number | null
  shotsAgainst: number | null
  conversion: number | null // % de gols por finalização
  cornersFor: number | null
  cornersAgainst: number | null
  cornersTotal: number | null
  corners5Plus: number // jogos com 5+ escanteios a favor
  yellow: number | null
  red: number | null
  cardsTotal: number | null // amarelos + vermelhos das duas equipes
  possession: number | null
  fouls: number | null
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

function avg(values: Array<number | null | undefined>, d = 1): number | null {
  const v = values.filter((x): x is number => typeof x === 'number')
  return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length, d) : null
}

export function summarizeWindow(rows: GameRow[], n: number): WindowSummary | null {
  const list = rows.slice(0, n)
  if (!list.length) return null
  const st = list.map((r) => r.stats).filter((s): s is GameStats => s !== null)
  const goalsWithShots = list.filter((r) => r.stats?.shots != null)
  const shotsSum = goalsWithShots.reduce((a, r) => a + (r.stats!.shots ?? 0), 0)
  const n0 = list.length
  return {
    games: n0,
    statGames: st.length,
    record: {
      v: list.filter((r) => r.result === 'V').length,
      e: list.filter((r) => r.result === 'E').length,
      d: list.filter((r) => r.result === 'D').length,
    },
    goalsFor: round(list.reduce((a, r) => a + r.gf, 0) / n0, 2),
    goalsAgainst: round(list.reduce((a, r) => a + r.ga, 0) / n0, 2),
    goalsTotal: round(list.reduce((a, r) => a + r.gf + r.ga, 0) / n0, 2),
    over15: list.filter((r) => r.gf + r.ga > 1.5).length,
    over25: list.filter((r) => r.gf + r.ga > 2.5).length,
    btts: list.filter((r) => r.gf > 0 && r.ga > 0).length,
    cleanSheets: list.filter((r) => r.ga === 0).length,
    failedToScore: list.filter((r) => r.gf === 0).length,
    shots: avg(st.map((s) => s.shots)),
    shotsOn: avg(st.map((s) => s.shotsOn)),
    shotsAgainst: avg(st.map((s) => s.shotsAgainst)),
    conversion: shotsSum > 0 ? round((goalsWithShots.reduce((a, r) => a + r.gf, 0) / shotsSum) * 100) : null,
    cornersFor: avg(st.map((s) => s.cornersFor)),
    cornersAgainst: avg(st.map((s) => s.cornersAgainst)),
    cornersTotal: avg(st.map((s) => (s.cornersFor != null && s.cornersAgainst != null ? s.cornersFor + s.cornersAgainst : null))),
    corners5Plus: st.filter((s) => (s.cornersFor ?? 0) >= 5).length,
    yellow: avg(st.map((s) => s.yellow)),
    red: avg(st.map((s) => s.red), 2),
    cardsTotal: avg(
      st.map((s) => (s.yellow != null && s.yellowOpp != null ? s.yellow + s.yellowOpp + (s.red ?? 0) + (s.redOpp ?? 0) : null)),
    ),
    possession: avg(st.map((s) => s.possession), 0),
    fouls: avg(st.map((s) => s.fouls)),
  }
}

/**
 * Médias "da partida" combinando os recortes das duas equipes: em cada jogo
 * soma os dois times em campo (gols, finalizações, escanteios, cartões) e
 * tira a média entre mandante e visitante. Posse é a média simples.
 */
export function matchAverages(h: WindowSummary | null, a: WindowSummary | null) {
  const mean = (x: number | null | undefined, y: number | null | undefined) => {
    const v = [x, y].filter((n): n is number => typeof n === 'number')
    return v.length ? round(v.reduce((s, n) => s + n, 0) / v.length) : null
  }
  const shots = (s: WindowSummary | null) => (s?.shots != null && s.shotsAgainst != null ? s.shots + s.shotsAgainst : null)
  return {
    goals: mean(h?.goalsTotal, a?.goalsTotal),
    shots: mean(shots(h), shots(a)),
    corners: mean(h?.cornersTotal, a?.cornersTotal),
    cards: mean(h?.cardsTotal, a?.cardsTotal),
  }
}

// ---------------------------------------------------------------------
// Radar comparativo (escalas fixas e públicas — ver RADAR_SCALES)
// ---------------------------------------------------------------------

export const RADAR_AXES = ['Ataque', 'Defesa', 'Posse', 'Pressão', 'Escanteios'] as const
export type RadarAxis = (typeof RADAR_AXES)[number]

export const RADAR_SCALES: Record<RadarAxis, string> = {
  Ataque: 'gols marcados por jogo (3,0 = 100)',
  Defesa: 'inverso dos gols sofridos por jogo (0 sofridos = 100; 3,0 = 0)',
  Posse: 'posse de bola média (%)',
  Pressão: 'finalizações por jogo (20 = 100)',
  Escanteios: 'escanteios a favor por jogo (10 = 100)',
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

/** Valores 0–100 por eixo; null quando não há dado para o eixo. */
export function radarValues(s: WindowSummary | null): Record<RadarAxis, number | null> {
  return {
    Ataque: s ? clamp((s.goalsFor / 3) * 100) : null,
    Defesa: s ? clamp(100 - (s.goalsAgainst / 3) * 100) : null,
    Posse: s?.possession != null ? clamp(s.possession) : null,
    Pressão: s?.shots != null ? clamp((s.shots / 20) * 100) : null,
    Escanteios: s?.cornersFor != null ? clamp((s.cornersFor / 10) * 100) : null,
  }
}

// ---------------------------------------------------------------------
// Leitura da partida (texto automático, sem IA, só com os números)
// ---------------------------------------------------------------------

const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

export function matchReading(home: string, away: string, h: WindowSummary | null, a: WindowSummary | null): string[] {
  const out: string[] = []
  if (!h || !a) {
    const one = h ?? a
    const name = h ? home : away
    if (one) out.push(`${name} soma ${one.record.v} vitória(s), ${one.record.e} empate(s) e ${one.record.d} derrota(s) nos últimos ${one.games} jogos, com média de ${fmt(one.goalsFor)} gol(s) marcado(s).`)
    return out
  }
  const diff = h.goalsFor - a.goalsFor
  if (Math.abs(diff) >= 0.4) {
    const [best, other, bs, os] = diff > 0 ? [home, away, h, a] : [away, home, a, h]
    out.push(`${best} chega com o ataque mais produtivo: ${fmt(bs.goalsFor)} gol(s) por jogo, contra ${fmt(os.goalsFor)} do ${other}.`)
  } else {
    out.push(`Os ataques têm produção parecida: ${fmt(h.goalsFor)} gol(s) por jogo do ${home} e ${fmt(a.goalsFor)} do ${away}.`)
  }
  const dd = h.goalsAgainst - a.goalsAgainst
  if (Math.abs(dd) >= 0.4) {
    const [solid, sv] = dd < 0 ? [home, h] : [away, a]
    out.push(`${solid} tem a defesa mais firme no recorte, sofrendo ${fmt(sv.goalsAgainst)} gol(s) por jogo e ficando sem sofrer gols em ${sv.cleanSheets} de ${sv.games}.`)
  }
  const overShare = (h.over25 + a.over25) / (h.games + a.games)
  if (overShare >= 0.6) out.push(`Os jogos recentes das duas equipes tiveram muitos gols: ${h.over25 + a.over25} de ${h.games + a.games} passaram de 2,5.`)
  else if (overShare <= 0.35) out.push(`Os jogos recentes das duas equipes foram de poucos gols: só ${h.over25 + a.over25} de ${h.games + a.games} passaram de 2,5.`)
  if (h.shots != null && a.shots != null && Math.abs(h.shots - a.shots) >= 3) {
    const [p, ps, o, os] = h.shots > a.shots ? [home, h.shots, away, a.shots] : [away, a.shots, home, h.shots]
    out.push(`${p} finaliza mais (${fmt(ps)} por jogo, contra ${fmt(os)} do ${o}), sinal de maior volume ofensivo.`)
  }
  if (h.cornersTotal != null && a.cornersTotal != null) {
    const mean = (h.cornersTotal + a.cornersTotal) / 2
    if (mean >= 10.5) out.push(`Jogos com muitos escanteios: média de ${fmt(mean)} por partida somando os recortes das duas equipes.`)
    else if (mean <= 8) out.push(`Poucos escanteios nos jogos recentes: média de ${fmt(mean)} por partida somando os recortes das duas equipes.`)
  }
  return out
}

// ---------------------------------------------------------------------
// Mercados por ângulo: em quantos jogos cada mercado aconteceu, olhando a
// mesma equipe por vários recortes (geral, mando, competição, confronto).
// É frequência histórica — não é previsão.
// ---------------------------------------------------------------------

export interface AngleHit {
  label: string
  hits: number
  total: number
}

export interface MarketAngles {
  key: string
  market: string
  team: string
  side: 'home' | 'away'
  /** Primeiro ângulo = últimos 10 jogos (ou menos, se a equipe tiver menos) — base da taxa principal. */
  angles: AngleHit[]
  rate: number // % no ângulo principal
  /** Menor taxa entre os ângulos com 3+ jogos: mede a consistência. */
  floor: number
  sample: number
}

type Market = { key: string; label: (team: string) => string; needsStats: boolean; test: (r: GameRow) => boolean | null }

const cornersTotal = (r: GameRow) => (r.stats?.cornersFor != null && r.stats.cornersAgainst != null ? r.stats.cornersFor + r.stats.cornersAgainst : null)
const cardsTotal = (r: GameRow) =>
  r.stats?.yellow != null && r.stats.yellowOpp != null ? r.stats.yellow + r.stats.yellowOpp + (r.stats.red ?? 0) + (r.stats.redOpp ?? 0) : null

export const MARKETS: Market[] = [
  { key: 'over15', label: () => 'Mais de 1,5 gols no jogo', needsStats: false, test: (r) => r.gf + r.ga > 1.5 },
  { key: 'over25', label: () => 'Mais de 2,5 gols no jogo', needsStats: false, test: (r) => r.gf + r.ga > 2.5 },
  { key: 'under35', label: () => 'Menos de 3,5 gols no jogo', needsStats: false, test: (r) => r.gf + r.ga < 3.5 },
  { key: 'btts', label: () => 'Ambos marcam', needsStats: false, test: (r) => r.gf > 0 && r.ga > 0 },
  { key: 'scores', label: (t) => `${t} marca`, needsStats: false, test: (r) => r.gf > 0 },
  { key: 'clean', label: (t) => `${t} não sofre gol`, needsStats: false, test: (r) => r.ga === 0 },
  { key: 'corners9', label: () => '9+ escanteios no jogo', needsStats: true, test: (r) => (cornersTotal(r) == null ? null : cornersTotal(r)! >= 9) },
  { key: 'cards4', label: () => '4+ cartões no jogo', needsStats: true, test: (r) => (cardsTotal(r) == null ? null : cardsTotal(r)! >= 4) },
]

function hitsOf(rows: GameRow[], m: Market, label: string): AngleHit {
  const results = rows.map((r) => m.test(r)).filter((v): v is boolean => v !== null)
  // Rótulo honesto: diz quantos jogos entraram de fato na conta.
  const counted = results.length < rows.length ? `${label} (${results.length} com estatística)` : label
  return { label: counted, hits: results.filter(Boolean).length, total: results.length }
}

const pctOf = (a: AngleHit) => (a.total ? Math.round((a.hits / a.total) * 100) : 0)

export function marketAngles(opts: {
  team: string
  side: 'home' | 'away'
  games: GameRow[]
  /** Mando do jogo analisado para esta equipe. */
  venue: 'casa' | 'fora'
  league: string
  opponent: string
  h2h: GameRow[]
}): MarketAngles[] {
  const { team, side, games, venue, league, opponent, h2h } = opts
  const venueGames = games.filter((g) => g.venue === venue).slice(0, 10)
  const leagueGames = games.filter((g) => g.league === league).slice(0, 10)
  const out: MarketAngles[] = []
  for (const m of MARKETS) {
    const angles = [
      hitsOf(games.slice(0, 10), m, `nos últimos ${Math.min(10, games.length)} jogos`),
      hitsOf(games.slice(0, 5), m, `nos últimos ${Math.min(5, games.length)} jogos`),
      hitsOf(venueGames, m, venue === 'casa' ? 'jogando em casa' : 'jogando fora'),
      hitsOf(leagueGames, m, `na ${league}`),
      hitsOf(h2h.slice(0, 10), m, `contra o ${opponent}`),
    ].filter((a) => a.total > 0)
    const main = angles[0]
    if (!main || main.total < 3) continue
    const solid = angles.filter((a) => a.total >= 3)
    out.push({
      key: `${side}-${m.key}`,
      market: m.label(team),
      team,
      side,
      angles,
      rate: pctOf(main),
      floor: Math.min(...solid.map(pctOf)),
      sample: main.total,
    })
  }
  return out
}

/** Ordena pelos mercados mais consistentes entre os ângulos (amostra maior desempata). */
export function rankMarkets(list: MarketAngles[]): MarketAngles[] {
  return [...list].sort((a, b) => b.floor - a.floor || b.rate - a.rate || b.sample - a.sample)
}

// ---------------------------------------------------------------------
// "Jogo quente": vários mercados que se repetiram em TODOS os ângulos.
// ---------------------------------------------------------------------

export const HOT_FLOOR = 80 // % mínima em cada ângulo com 3+ jogos
export const HOT_SAMPLE = 5 // jogos mínimos no recorte principal
export const HOT_MIN_MARKETS = 3

/** Quantos mercados (das duas equipes) bateram em 80%+ em todos os ângulos. */
export function hotMarketCount(list: MarketAngles[]): number {
  return list.filter((m) => m.floor >= HOT_FLOOR && m.sample >= HOT_SAMPLE).length
}

export function isHot(count: number | null | undefined) {
  return (count ?? 0) >= HOT_MIN_MARKETS
}

/** Mercados por ângulo das duas equipes de uma partida (atalho usado no servidor). */
export function fixtureMarkets(opts: {
  home: { name: string; games: GameRow[]; h2h: GameRow[] }
  away: { name: string; games: GameRow[]; h2h: GameRow[] }
  league: string
}): MarketAngles[] {
  return [
    ...marketAngles({ team: opts.home.name, side: 'home', games: opts.home.games, venue: 'casa', league: opts.league, opponent: opts.away.name, h2h: opts.home.h2h }),
    ...marketAngles({ team: opts.away.name, side: 'away', games: opts.away.games, venue: 'fora', league: opts.league, opponent: opts.home.name, h2h: opts.away.h2h }),
  ]
}
