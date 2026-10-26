// Transforma o pacote bruto da API-Football em "fatos" compactos para a IA
// e em blocos de exibição. Tudo é derivado dos dados recebidos: quando um
// dado não existe, o campo fica null/ausente — nunca é estimado.

import type {
  ApiFixture,
  ApiFixtureTeamStatistics,
  ApiOdds,
  ApiPlayerEntry,
  ApiStandingRow,
  ApiTeamStatistics,
  RawBundle,
} from './api-football-types'
import { FINISHED } from './fixture-status'
import { spParts } from './grade'

type Side = 'home' | 'away'

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', ''))
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------
// Forma recente
// ---------------------------------------------------------------------

export interface MatchLine {
  date: string
  league: string
  venue: 'casa' | 'fora'
  opponent: string
  gf: number
  ga: number
  result: 'V' | 'E' | 'D'
}

export interface FormSummary {
  matches: number
  record: { v: number; e: number; d: number }
  sequence: string // mais recente primeiro
  goalsForAvg: number
  goalsAgainstAvg: number
  totalGoalsAvg: number
  over: Record<'0.5' | '1.5' | '2.5' | '3.5', number> // contagem de jogos acima da linha
  btts: number
  cleanSheets: number
  failedToScore: number
}

function regulation(f: ApiFixture): { home: number; away: number } | null {
  const ft = f.score?.fulltime
  if (ft && ft.home != null && ft.away != null) return { home: ft.home, away: ft.away }
  if (f.goals.home != null && f.goals.away != null) return { home: f.goals.home, away: f.goals.away }
  return null
}

export function matchLines(fixtures: ApiFixture[], teamId: number): MatchLine[] {
  return fixtures
    .filter((f) => FINISHED.has(f.fixture.status.short) && regulation(f))
    .sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date))
    .map((f) => {
      const s = regulation(f)!
      const isHome = f.teams.home.id === teamId
      const gf = isHome ? s.home : s.away
      const ga = isHome ? s.away : s.home
      return {
        date: spParts(f.fixture.date).date,
        league: f.league.name,
        venue: isHome ? 'casa' : 'fora',
        opponent: isHome ? f.teams.away.name : f.teams.home.name,
        gf,
        ga,
        result: gf > ga ? 'V' : gf < ga ? 'D' : 'E',
      }
    })
}

export function summarizeForm(lines: MatchLine[]): FormSummary | null {
  if (!lines.length) return null
  const n = lines.length
  const sum = (fn: (l: MatchLine) => number) => lines.reduce((a, l) => a + fn(l), 0)
  const over = (line: number) => lines.filter((l) => l.gf + l.ga > line).length
  return {
    matches: n,
    record: {
      v: lines.filter((l) => l.result === 'V').length,
      e: lines.filter((l) => l.result === 'E').length,
      d: lines.filter((l) => l.result === 'D').length,
    },
    sequence: lines.map((l) => l.result).join(''),
    goalsForAvg: round(sum((l) => l.gf) / n),
    goalsAgainstAvg: round(sum((l) => l.ga) / n),
    totalGoalsAvg: round(sum((l) => l.gf + l.ga) / n),
    over: { '0.5': over(0.5), '1.5': over(1.5), '2.5': over(2.5), '3.5': over(3.5) },
    btts: lines.filter((l) => l.gf > 0 && l.ga > 0).length,
    cleanSheets: lines.filter((l) => l.ga === 0).length,
    failedToScore: lines.filter((l) => l.gf === 0).length,
  }
}

// ---------------------------------------------------------------------
// Estatísticas por partida (escanteios, finalizações, cartões...)
// ---------------------------------------------------------------------

const STAT_KEYS = {
  corners: 'Corner Kicks',
  shots: 'Total Shots',
  shotsOn: 'Shots on Goal',
  fouls: 'Fouls',
  yellow: 'Yellow Cards',
  red: 'Red Cards',
  offsides: 'Offsides',
  possession: 'Ball Possession',
} as const

type StatKey = keyof typeof STAT_KEYS

function statValue(entry: ApiFixtureTeamStatistics | undefined, key: StatKey): number | null {
  if (!entry) return null
  const s = entry.statistics.find((x) => x.type === STAT_KEYS[key])
  if (!s) return null
  // Cartões/escanteios ausentes costumam vir como null quando são zero.
  if (s.value == null) return key === 'possession' ? null : 0
  return num(s.value)
}

export interface StatProfile {
  sample: number // partidas com estatística disponível
  venueSample: number // partidas no mesmo mando do jogo analisado
  avg: Partial<Record<'cornersFor' | 'cornersAgainst' | 'shots' | 'shotsOn' | 'shotsAgainst' | 'fouls' | 'yellow' | 'red' | 'offsides' | 'possession', number>>
  venueAvg: Partial<Record<'cornersFor' | 'cornersAgainst', number>>
  cornersForAtLeast: Record<'3' | '4' | '5' | '6', number> // jogos com N+ escanteios a favor
  matchCornersOver: Record<'7.5' | '8.5' | '9.5' | '10.5', number> // escanteios totais da partida
  cardsTotalAvg: number | null // cartões amarelos somados das duas equipes
}

export function statProfile(
  teamId: number,
  recent: ApiFixture[],
  matchStats: Record<string, ApiFixtureTeamStatistics[]>,
  venue: 'casa' | 'fora',
): StatProfile | null {
  type Row = { venue: 'casa' | 'fora'; v: Record<string, number | null> }
  const rows: Row[] = []
  for (const f of recent) {
    const stats = matchStats[String(f.fixture.id)]
    if (!stats || stats.length < 2) continue
    const mine = stats.find((s) => s.team.id === teamId)
    const theirs = stats.find((s) => s.team.id !== teamId)
    if (!mine || !theirs) continue
    rows.push({
      venue: f.teams.home.id === teamId ? 'casa' : 'fora',
      v: {
      cornersFor: statValue(mine, 'corners'),
      cornersAgainst: statValue(theirs, 'corners'),
      shots: statValue(mine, 'shots'),
      shotsOn: statValue(mine, 'shotsOn'),
      shotsAgainst: statValue(theirs, 'shots'),
      fouls: statValue(mine, 'fouls'),
      yellow: statValue(mine, 'yellow'),
      red: statValue(mine, 'red'),
      offsides: statValue(mine, 'offsides'),
      possession: statValue(mine, 'possession'),
      yellowOpp: statValue(theirs, 'yellow'),
      },
    })
  }
  if (!rows.length) return null
  const avgOf = (list: Row[], k: string) => {
    const vals = list.map((r) => r.v[k]).filter((v): v is number => typeof v === 'number')
    return vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined
  }
  const avg: StatProfile['avg'] = {}
  for (const k of ['cornersFor', 'cornersAgainst', 'shots', 'shotsOn', 'shotsAgainst', 'fouls', 'yellow', 'red', 'offsides', 'possession'] as const) {
    const v = avgOf(rows, k)
    if (v !== undefined) avg[k] = v
  }
  const venueRows = rows.filter((r) => r.venue === venue)
  const venueAvg: StatProfile['venueAvg'] = {}
  for (const k of ['cornersFor', 'cornersAgainst'] as const) {
    const v = avgOf(venueRows, k)
    if (v !== undefined) venueAvg[k] = v
  }
  const cf = rows.map((r) => r.v.cornersFor).filter((v): v is number => v != null)
  const mc = rows
    .map(({ v }) => (v.cornersFor != null && v.cornersAgainst != null ? v.cornersFor + v.cornersAgainst : null))
    .filter((v): v is number => v != null)
  const cards = rows
    .map(({ v }) => (v.yellow != null && v.yellowOpp != null ? v.yellow + v.yellowOpp : null))
    .filter((v): v is number => v != null)
  return {
    sample: rows.length,
    venueSample: venueRows.length,
    avg,
    venueAvg,
    cornersForAtLeast: {
      '3': cf.filter((v) => v >= 3).length,
      '4': cf.filter((v) => v >= 4).length,
      '5': cf.filter((v) => v >= 5).length,
      '6': cf.filter((v) => v >= 6).length,
    },
    matchCornersOver: {
      '7.5': mc.filter((v) => v > 7.5).length,
      '8.5': mc.filter((v) => v > 8.5).length,
      '9.5': mc.filter((v) => v > 9.5).length,
      '10.5': mc.filter((v) => v > 10.5).length,
    },
    cardsTotalAvg: cards.length ? round(cards.reduce((a, b) => a + b, 0) / cards.length) : null,
  }
}

// ---------------------------------------------------------------------
// Temporada (teams/statistics)
// ---------------------------------------------------------------------

function sumCards(rec: Record<string, { total?: number | null }> | undefined): number | null {
  if (!rec) return null
  let total = 0
  let seen = false
  for (const v of Object.values(rec)) {
    if (v?.total != null) {
      total += v.total
      seen = true
    }
  }
  return seen ? total : null
}

export function seasonSummary(s: ApiTeamStatistics | null, venue: Side) {
  if (!s?.fixtures?.played?.total) return null
  const played = s.fixtures.played
  const total = played.total ?? 0
  const yellow = sumCards(s.cards?.yellow)
  const red = sumCards(s.cards?.red)
  return {
    form: s.form ? s.form.slice(-10) : null,
    played: { total, home: played.home ?? null, away: played.away ?? null },
    record: {
      total: { v: s.fixtures.wins?.total ?? null, e: s.fixtures.draws?.total ?? null, d: s.fixtures.loses?.total ?? null },
      [venue === 'home' ? 'casa' : 'fora']: {
        v: s.fixtures.wins?.[venue] ?? null,
        e: s.fixtures.draws?.[venue] ?? null,
        d: s.fixtures.loses?.[venue] ?? null,
      },
    },
    goalsForAvg: { total: num(s.goals?.for?.average?.total), [venue === 'home' ? 'casa' : 'fora']: num(s.goals?.for?.average?.[venue]) },
    goalsAgainstAvg: { total: num(s.goals?.against?.average?.total), [venue === 'home' ? 'casa' : 'fora']: num(s.goals?.against?.average?.[venue]) },
    cleanSheets: s.clean_sheet?.total ?? null,
    failedToScore: s.failed_to_score?.total ?? null,
    yellowPerGame: yellow != null && total ? round(yellow / total) : null,
    redTotal: red,
    mainFormation: s.lineups?.length ? [...s.lineups].sort((a, b) => b.played - a.played)[0].formation : null,
  }
}

// ---------------------------------------------------------------------
// Jogadores (finalizações por jogo na temporada)
// ---------------------------------------------------------------------

export interface Shooter {
  name: string
  position: string | null
  apps: number
  minutes: number
  shotsPerGame: number
  onTargetPerGame: number | null
  goals: number | null
}

export function topShooters(entries: ApiPlayerEntry[], teamId: number, leagueId: number, limit = 5): Shooter[] {
  const out: Shooter[] = []
  for (const e of entries) {
    const st = e.statistics.find((s) => s.team?.id === teamId && (s.league?.id == null || s.league.id === leagueId)) ?? e.statistics.find((s) => s.team?.id === teamId)
    if (!st) continue
    const apps = st.games?.appearences ?? 0
    const minutes = st.games?.minutes ?? 0
    const shots = st.shots?.total
    if (!apps || apps < 3 || minutes < 180 || shots == null) continue
    out.push({
      name: e.player.name,
      position: st.games?.position ?? null,
      apps,
      minutes,
      shotsPerGame: round(shots / apps),
      onTargetPerGame: st.shots?.on != null ? round(st.shots.on / apps) : null,
      goals: st.goals?.total ?? null,
    })
  }
  return out.sort((a, b) => b.shotsPerGame - a.shotsPerGame).slice(0, limit)
}

// ---------------------------------------------------------------------
// Odds (probabilidade implícita sem a margem da casa)
// ---------------------------------------------------------------------

export interface ImpliedMarket {
  market: string
  bookmaker: string
  options: Array<{ label: string; odd: number; implied: number }>
  margin: number
}

const ODDS_MARKETS: Record<string, { name: string; values?: string[]; labels?: Record<string, string> }> = {
  'Match Winner': { name: 'Resultado final', labels: { Home: 'Casa', Draw: 'Empate', Away: 'Fora' } },
  'Both Teams Score': { name: 'Ambos marcam', labels: { Yes: 'Sim', No: 'Não' } },
  'Goals Over/Under': { name: 'Gols — linha 2.5', values: ['Over 2.5', 'Under 2.5'], labels: { 'Over 2.5': 'Mais de 2.5', 'Under 2.5': 'Menos de 2.5' } },
  'Double Chance': { name: 'Dupla chance', labels: { 'Home/Draw': '1X', 'Draw/Away': 'X2', 'Home/Away': '12' } },
}

export function impliedMarkets(odds: ApiOdds | null): ImpliedMarket[] {
  const books = odds?.bookmakers ?? []
  if (!books.length) return []
  const out: ImpliedMarket[] = []
  for (const [betName, cfg] of Object.entries(ODDS_MARKETS)) {
    for (const b of books) {
      const bet = b.bets.find((x) => x.name === betName)
      if (!bet) continue
      const values = bet.values.filter((v) => !cfg.values || cfg.values.includes(v.value))
      const parsed = values.map((v) => ({ label: cfg.labels?.[v.value] ?? v.value, odd: Number(v.odd) })).filter((v) => v.odd > 1)
      if (parsed.length < 2) continue
      const rawSum = parsed.reduce((a, v) => a + 1 / v.odd, 0)
      // Dupla chance não soma 100%: cada opção cobre dois resultados.
      const norm = betName === 'Double Chance' ? rawSum / 2 : rawSum
      out.push({
        market: cfg.name,
        bookmaker: b.name,
        margin: round((norm - 1) * 100, 1),
        options: parsed.map((v) => ({ label: v.label, odd: v.odd, implied: round((1 / v.odd / norm) * 100, 1) })),
      })
      break
    }
  }
  return out
}

// ---------------------------------------------------------------------
// Fatos completos + blocos de exibição
// ---------------------------------------------------------------------

function standingFor(standings: ApiStandingRow[][] | null, teamId: number) {
  if (!standings) return null
  for (const group of standings) {
    const row = group.find((r) => r.team.id === teamId)
    if (row)
      return {
        posicao: row.rank,
        pontos: row.points,
        jogos: row.all?.played ?? null,
        saldo: row.goalsDiff ?? null,
        grupo: row.group ?? null,
        zona: row.description ?? null,
        forma: row.form ?? null,
        equipesNaTabela: group.length,
      }
  }
  return null
}

export function buildFacts(raw: RawBundle) {
  const f = raw.fixture
  const homeId = f.teams.home.id
  const awayId = f.teams.away.id
  const leagueId = f.league.id
  const homeLines = matchLines(raw.lastFixtures.home, homeId)
  const awayLines = matchLines(raw.lastFixtures.away, awayId)
  const h2hLines = matchLines(raw.h2h, homeId)
  const kickoff = spParts(f.fixture.date)

  const percent = raw.predictions?.predictions?.percent
  const pct = percent
    ? { casa: num(percent.home), empate: num(percent.draw), fora: num(percent.away) }
    : null
  const validPct = pct && pct.casa != null && pct.empate != null && pct.fora != null ? pct : null

  const homeShooters = topShooters(raw.players.home, homeId, leagueId)
  const awayShooters = topShooters(raw.players.away, awayId, leagueId)
  const homeStats = statProfile(homeId, raw.lastFixtures.home, raw.matchStats, 'casa')
  const awayStats = statProfile(awayId, raw.lastFixtures.away, raw.matchStats, 'fora')
  const odds = impliedMarkets(raw.odds)
  const injuries = raw.injuries.map((i) => ({
    jogador: i.player.name,
    equipe: i.team.id === homeId ? 'mandante' : 'visitante',
    tipo: i.player.type ?? null,
    motivo: i.player.reason ?? null,
  }))

  const facts = {
    partida: {
      competicao: f.league.name,
      pais: f.league.country ?? null,
      rodada: f.league.round ?? null,
      temporada: f.league.season,
      data: kickoff.date,
      horario_brasilia: kickoff.time,
      estadio: f.fixture.venue?.name ?? null,
      mandante: f.teams.home.name,
      visitante: f.teams.away.name,
      arbitro: f.fixture.referee ?? null,
    },
    classificacao: {
      mandante: standingFor(raw.standings, homeId),
      visitante: standingFor(raw.standings, awayId),
    },
    forma_recente: {
      mandante: summarizeForm(homeLines),
      visitante: summarizeForm(awayLines),
      mandante_em_casa: summarizeForm(homeLines.filter((l) => l.venue === 'casa')),
      visitante_fora: summarizeForm(awayLines.filter((l) => l.venue === 'fora')),
      jogos_mandante: homeLines.slice(0, 10),
      jogos_visitante: awayLines.slice(0, 10),
    },
    temporada: {
      mandante: seasonSummary(raw.teamStats.home, 'home'),
      visitante: seasonSummary(raw.teamStats.away, 'away'),
    },
    confrontos_diretos: {
      resumo: summarizeForm(h2hLines), // na perspectiva do mandante atual
      jogos: h2hLines.slice(0, 10),
    },
    estatisticas_por_jogo: {
      mandante: homeStats,
      visitante: awayStats,
      observacao: 'Médias dos últimos jogos com estatística disponível. Escanteios são totais por partida; a fonte não informa o minuto de cada escanteio.',
    },
    previsao_api_football: raw.predictions?.predictions
      ? {
          percentuais: validPct,
          comparacao: raw.predictions.comparison ?? null,
          observacao: 'Modelo estatístico da própria API-Football; não é garantia de resultado.',
        }
      : null,
    mercado: odds.length ? { odds_e_probabilidade_implicita: odds } : null,
    desfalques: injuries.length ? injuries : null,
    finalizadores_temporada: {
      mandante: homeShooters,
      visitante: awayShooters,
    },
  }

  const display = {
    percent: validPct,
    h2h: h2hLines.slice(0, 5).map((l) => ({
      date: l.date,
      league: l.league,
      home: l.venue === 'casa' ? f.teams.home.name : l.opponent,
      away: l.venue === 'casa' ? l.opponent : f.teams.home.name,
      score: l.venue === 'casa' ? `${l.gf} x ${l.ga}` : `${l.ga} x ${l.gf}`,
    })),
    shooters: { home: homeShooters, away: awayShooters },
    form: {
      home: summarizeForm(homeLines)?.sequence.slice(0, 5) ?? null,
      away: summarizeForm(awayLines)?.sequence.slice(0, 5) ?? null,
    },
    corners: homeStats || awayStats
      ? {
          home: homeStats ? { sample: homeStats.sample, ...pickCorners(homeStats) } : null,
          away: awayStats ? { sample: awayStats.sample, ...pickCorners(awayStats) } : null,
        }
      : null,
    odds,
    injuries,
    standings: { home: facts.classificacao.mandante, away: facts.classificacao.visitante },
  }

  const support = {
    importancia: !!(facts.classificacao.mandante || facts.classificacao.visitante || f.league.round),
    confrontos: h2hLines.length > 0,
    forma: homeLines.length > 0 || awayLines.length > 0,
    probabilidade: !!validPct || odds.some((o) => o.market === 'Resultado final'),
    gols: homeLines.length > 0 || awayLines.length > 0 || !!facts.temporada.mandante || !!facts.temporada.visitante,
    escanteios: (homeStats?.avg.cornersFor != null) || (awayStats?.avg.cornersFor != null),
    cartoes: homeStats?.avg.yellow != null || awayStats?.avg.yellow != null || facts.temporada.mandante?.yellowPerGame != null || facts.temporada.visitante?.yellowPerGame != null,
    arbitro: !!f.fixture.referee,
    finalizacoes: homeShooters.length > 0 || awayShooters.length > 0,
  }

  return { facts, display, support }
}

function pickCorners(p: StatProfile) {
  return {
    forAvg: p.avg.cornersFor ?? null,
    againstAvg: p.avg.cornersAgainst ?? null,
    venueForAvg: p.venueAvg.cornersFor ?? null,
    venueSample: p.venueSample,
    atLeast4: p.cornersForAtLeast['4'],
    atLeast5: p.cornersForAtLeast['5'],
  }
}

export type Facts = ReturnType<typeof buildFacts>['facts']
export type AnalysisDisplay = ReturnType<typeof buildFacts>['display']
export type SectionSupport = ReturnType<typeof buildFacts>['support']
