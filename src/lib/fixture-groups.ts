// Organização dos jogos do dia por país e por competição.
import type { FixtureRow } from './types'

const COUNTRY_PT: Record<string, string> = {
  World: 'Internacional',
  Brazil: 'Brasil',
  Argentina: 'Argentina',
  Uruguay: 'Uruguai',
  Colombia: 'Colômbia',
  Peru: 'Peru',
  Chile: 'Chile',
  Paraguay: 'Paraguai',
  Ecuador: 'Equador',
  Bolivia: 'Bolívia',
  Venezuela: 'Venezuela',
  USA: 'Estados Unidos',
  Mexico: 'México',
  England: 'Inglaterra',
  Spain: 'Espanha',
  Italy: 'Itália',
  Germany: 'Alemanha',
  France: 'França',
  Portugal: 'Portugal',
  Netherlands: 'Holanda',
  Belgium: 'Bélgica',
  Turkey: 'Turquia',
  Scotland: 'Escócia',
  Switzerland: 'Suíça',
  'Saudi-Arabia': 'Arábia Saudita',
  Japan: 'Japão',
  'South-Korea': 'Coreia do Sul',
  China: 'China',
  Australia: 'Austrália',
}

export function countryLabel(country: string | null | undefined): string {
  if (!country) return 'Outros'
  return COUNTRY_PT[country] ?? country.replace(/-/g, ' ')
}

export interface LeagueGroup {
  leagueId: number
  leagueName: string
  leagueLogo: string | null
  fixtures: FixtureRow[]
}

export interface CountryGroup {
  country: string
  leagues: LeagueGroup[]
  total: number
}

/**
 * Agrupa por país e, dentro dele, por competição. Países e competições seguem
 * a prioridade cadastrada em `leagues`; os jogos ficam em ordem de horário.
 */
export function groupFixtures(fixtures: FixtureRow[], priority: Map<number, number>, order: 'asc' | 'desc' = 'asc'): CountryGroup[] {
  const prio = (id: number) => priority.get(id) ?? 999
  const byCountry = new Map<string, Map<number, LeagueGroup>>()
  for (const f of fixtures) {
    const country = countryLabel(f.league_country)
    let leagues = byCountry.get(country)
    if (!leagues) byCountry.set(country, (leagues = new Map()))
    let g = leagues.get(f.league_id)
    if (!g) leagues.set(f.league_id, (g = { leagueId: f.league_id, leagueName: f.league_name, leagueLogo: f.league_logo, fixtures: [] }))
    g.fixtures.push(f)
  }
  const dir = order === 'asc' ? 1 : -1
  const groups: CountryGroup[] = [...byCountry.entries()].map(([country, leagues]) => {
    const list = [...leagues.values()]
      .map((l) => ({ ...l, fixtures: [...l.fixtures].sort((a, b) => dir * (Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))) }))
      .sort((a, b) => prio(a.leagueId) - prio(b.leagueId) || a.leagueName.localeCompare(b.leagueName, 'pt-BR'))
    return { country, leagues: list, total: list.reduce((n, l) => n + l.fixtures.length, 0) }
  })
  const best = (g: CountryGroup) => Math.min(...g.leagues.map((l) => prio(l.leagueId)))
  return groups.sort((a, b) => best(a) - best(b) || a.country.localeCompare(b.country, 'pt-BR'))
}
