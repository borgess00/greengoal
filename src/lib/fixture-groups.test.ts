import { describe, expect, it } from 'vitest'
import { countryLabel, groupFixtures } from './fixture-groups'
import type { FixtureRow } from './types'

const fx = (id: number, league_id: number, league_name: string, league_country: string, kickoff_at: string) =>
  ({ id, league_id, league_name, league_country, league_logo: null, kickoff_at }) as FixtureRow

describe('groupFixtures', () => {
  it('agrupa por país e competição, na ordem de prioridade e horário', () => {
    const priority = new Map([
      [71, 1],
      [73, 2],
      [39, 14],
      [2, 11],
    ])
    const groups = groupFixtures(
      [
        fx(1, 39, 'Premier League', 'England', '2026-10-27T16:00:00Z'),
        fx(2, 71, 'Serie A', 'Brazil', '2026-10-27T22:00:00Z'),
        fx(3, 71, 'Serie A', 'Brazil', '2026-10-27T19:00:00Z'),
        fx(4, 73, 'Copa do Brasil', 'Brazil', '2026-10-27T23:00:00Z'),
        fx(5, 2, 'UEFA Champions League', 'World', '2026-10-27T20:00:00Z'),
      ],
      priority,
    )
    expect(groups.map((g) => g.country)).toEqual(['Brasil', 'Internacional', 'Inglaterra'])
    expect(groups[0].leagues.map((l) => l.leagueName)).toEqual(['Serie A', 'Copa do Brasil'])
    expect(groups[0].leagues[0].fixtures.map((f) => f.id)).toEqual([3, 2])
    expect(groups[0].total).toBe(3)
  })
  it('traduz países', () => {
    expect(countryLabel('Saudi-Arabia')).toBe('Arábia Saudita')
    expect(countryLabel(null)).toBe('Outros')
  })
})
