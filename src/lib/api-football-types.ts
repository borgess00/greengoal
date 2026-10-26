// Tipos mínimos (e tolerantes) das respostas da API-Football v3.
// Campos podem vir nulos; o código nunca presume a presença de um dado.

export interface ApiEnvelope<T> {
  get?: string
  parameters?: Record<string, string>
  errors?: unknown
  results?: number
  paging?: { current: number; total: number }
  response: T
}

export interface ApiTeamRef {
  id: number
  name: string
  logo?: string | null
  winner?: boolean | null
}

export interface ApiFixture {
  fixture: {
    id: number
    referee?: string | null
    timezone?: string
    date: string
    timestamp?: number
    venue?: { id?: number | null; name?: string | null; city?: string | null } | null
    status: { long?: string; short: string; elapsed?: number | null }
  }
  league: {
    id: number
    name: string
    country?: string | null
    logo?: string | null
    flag?: string | null
    season: number
    round?: string | null
  }
  teams: { home: ApiTeamRef; away: ApiTeamRef }
  goals: { home: number | null; away: number | null }
  score?: {
    halftime?: { home: number | null; away: number | null }
    fulltime?: { home: number | null; away: number | null }
    extratime?: { home: number | null; away: number | null }
    penalty?: { home: number | null; away: number | null }
  }
}

export interface ApiStatisticEntry {
  type: string
  value: number | string | null
}

export interface ApiFixtureTeamStatistics {
  team: { id: number; name: string }
  statistics: ApiStatisticEntry[]
}

export interface ApiPrediction {
  predictions?: {
    winner?: { id: number | null; name: string | null; comment?: string | null } | null
    win_or_draw?: boolean | null
    under_over?: string | null
    goals?: { home?: string | null; away?: string | null } | null
    advice?: string | null
    percent?: { home?: string | null; draw?: string | null; away?: string | null } | null
  }
  comparison?: Record<string, { home?: string | null; away?: string | null }>
}

export interface ApiTeamStatistics {
  form?: string | null
  fixtures?: {
    played?: { home?: number; away?: number; total?: number }
    wins?: { home?: number; away?: number; total?: number }
    draws?: { home?: number; away?: number; total?: number }
    loses?: { home?: number; away?: number; total?: number }
  }
  goals?: {
    for?: { total?: { home?: number; away?: number; total?: number }; average?: { home?: string; away?: string; total?: string } }
    against?: { total?: { home?: number; away?: number; total?: number }; average?: { home?: string; away?: string; total?: string } }
  }
  clean_sheet?: { home?: number; away?: number; total?: number }
  failed_to_score?: { home?: number; away?: number; total?: number }
  cards?: {
    yellow?: Record<string, { total?: number | null; percentage?: string | null }>
    red?: Record<string, { total?: number | null; percentage?: string | null }>
  }
  lineups?: Array<{ formation: string; played: number }>
}

export interface ApiInjury {
  player: { id: number; name: string; type?: string | null; reason?: string | null }
  team: { id: number; name: string }
}

export interface ApiOddsBet {
  id: number
  name: string
  values: Array<{ value: string; odd: string }>
}

export interface ApiOdds {
  bookmakers?: Array<{ id: number; name: string; bets: ApiOddsBet[] }>
}

export interface ApiPlayerEntry {
  player: { id: number; name: string; age?: number | null; injured?: boolean | null }
  statistics: Array<{
    team?: { id: number; name: string }
    league?: { id: number | null; season?: number | null }
    games?: { appearences?: number | null; lineups?: number | null; minutes?: number | null; position?: string | null }
    shots?: { total?: number | null; on?: number | null }
    goals?: { total?: number | null }
  }>
}

export interface ApiStandingRow {
  rank: number
  team: { id: number; name: string }
  points: number
  goalsDiff?: number
  group?: string | null
  form?: string | null
  description?: string | null
  all?: { played?: number; win?: number; draw?: number; lose?: number; goals?: { for?: number; against?: number } }
}

/** Pacote bruto coletado para uma partida (armazenado em fixture_data). */
export interface RawBundle {
  fixture: ApiFixture
  h2h: ApiFixture[]
  predictions: ApiPrediction | null
  teamStats: { home: ApiTeamStatistics | null; away: ApiTeamStatistics | null }
  lastFixtures: { home: ApiFixture[]; away: ApiFixture[] }
  matchStats: Record<string, ApiFixtureTeamStatistics[]>
  injuries: ApiInjury[]
  odds: ApiOdds | null
  players: { home: ApiPlayerEntry[]; away: ApiPlayerEntry[] }
  standings: ApiStandingRow[][] | null
}
