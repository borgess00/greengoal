// Radar de escanteios: médias GERAIS por partida (a API-Football não informa
// o minuto dos escanteios, então não há dado de 0–10 min).
import type { ApiFixture, RawBundle } from './api-football-types'
import { statProfile } from './facts'

export interface CornerTeamRow {
  fixtureId: number
  kickoff_at: string
  local_time: string
  league_name: string
  team: string
  teamLogo: string | null
  opponent: string
  venue: 'casa' | 'fora'
  sample: number
  forAvg: number | null
  againstAvg: number | null
  venueForAvg: number | null
  venueSample: number
  atLeast4: number
  atLeast5: number
  opponentSample: number
  opponentConcededAvg: number | null
  /** Média simples entre escanteios a favor do time e cedidos pelo adversário. */
  combinedAvg: number | null
}

export interface CornerFixtureInfo {
  id: number
  kickoff_at: string
  local_time: string
  league_name: string
  home_team_id: number
  home_team_name: string
  home_team_logo: string | null
  away_team_id: number
  away_team_name: string
  away_team_logo: string | null
}

export const MIN_CORNER_SAMPLE = 3

export function cornerRows(
  fx: CornerFixtureInfo,
  bundle: Pick<RawBundle, 'lastFixtures' | 'matchStats'>,
): CornerTeamRow[] {
  const home = statProfile(fx.home_team_id, bundle.lastFixtures.home as ApiFixture[], bundle.matchStats, 'casa')
  const away = statProfile(fx.away_team_id, bundle.lastFixtures.away as ApiFixture[], bundle.matchStats, 'fora')
  const make = (
    side: 'home' | 'away',
    mine: ReturnType<typeof statProfile>,
    theirs: ReturnType<typeof statProfile>,
  ): CornerTeamRow | null => {
    if (!mine || mine.avg.cornersFor == null) return null
    const forAvg = mine.avg.cornersFor ?? null
    const conceded = theirs?.avg.cornersAgainst ?? null
    return {
      fixtureId: fx.id,
      kickoff_at: fx.kickoff_at,
      local_time: fx.local_time,
      league_name: fx.league_name,
      team: side === 'home' ? fx.home_team_name : fx.away_team_name,
      teamLogo: side === 'home' ? fx.home_team_logo : fx.away_team_logo,
      opponent: side === 'home' ? fx.away_team_name : fx.home_team_name,
      venue: side === 'home' ? 'casa' : 'fora',
      sample: mine.sample,
      forAvg,
      againstAvg: mine.avg.cornersAgainst ?? null,
      venueForAvg: mine.venueAvg.cornersFor ?? null,
      venueSample: mine.venueSample,
      atLeast4: mine.cornersForAtLeast['4'],
      atLeast5: mine.cornersForAtLeast['5'],
      opponentSample: theirs?.sample ?? 0,
      opponentConcededAvg: conceded,
      combinedAvg: forAvg != null && conceded != null ? Math.round(((forAvg + conceded) / 2) * 100) / 100 : null,
    }
  }
  return [make('home', home, away), make('away', away, home)].filter((r): r is CornerTeamRow => r !== null)
}

/** Ordena por média combinada; amostras pequenas vão para o fim. */
export function rankCornerRows(rows: CornerTeamRow[]): CornerTeamRow[] {
  return [...rows].sort((a, b) => {
    const sa = a.sample >= MIN_CORNER_SAMPLE ? 1 : 0
    const sb = b.sample >= MIN_CORNER_SAMPLE ? 1 : 0
    if (sa !== sb) return sb - sa
    return (b.combinedAvg ?? b.forAvg ?? 0) - (a.combinedAvg ?? a.forAvg ?? 0)
  })
}
