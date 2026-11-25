import { describe, expect, it } from 'vitest'
import type { ApiFixture, ApiFixtureTeamStatistics } from './api-football-types'
import { formString, matchReading, radarValues, summarizeWindow, teamGames } from './match-stats'

const TEAM = 10
let seq = 100
function game(date: string, home: number, away: number, gh: number, ga: number, status = 'FT'): ApiFixture {
  return {
    fixture: { id: seq++, date, status: { short: status } },
    league: { id: 1, name: 'Liga', season: 2026 },
    teams: { home: { id: home, name: `T${home}`, logo: null }, away: { id: away, name: `T${away}`, logo: null } },
    goals: { home: gh, away: ga },
    score: { fulltime: { home: gh, away: ga } },
  }
}
const stats = (team: number, shots: number, corners: number | null, yellow: number | null, possession: string): ApiFixtureTeamStatistics => ({
  team: { id: team, name: `T${team}` },
  statistics: [
    { type: 'Total Shots', value: shots },
    { type: 'Corner Kicks', value: corners },
    { type: 'Yellow Cards', value: yellow },
    { type: 'Ball Possession', value: possession },
  ],
})

describe('teamGames / summarizeWindow', () => {
  const g1 = game('2026-11-20T20:00:00Z', TEAM, 2, 3, 1) // V em casa
  const g2 = game('2026-11-15T20:00:00Z', 3, TEAM, 1, 1) // E fora
  const g3 = game('2026-11-10T20:00:00Z', 4, TEAM, 2, 0) // D fora
  const future = game('2026-11-30T20:00:00Z', TEAM, 5, 0, 0, 'NS')
  const matchStats = {
    [String(g1.fixture.id)]: [stats(TEAM, 15, 7, null, '60%'), stats(2, 8, 3, 2, '40%')],
    [String(g2.fixture.id)]: [stats(3, 10, 4, 1, '45%'), stats(TEAM, 12, 5, 3, '55%')],
  }
  const rows = teamGames(TEAM, [g3, future, g1, g2, g1], matchStats)

  it('ordena do mais recente, ignora jogos não encerrados e duplicados', () => {
    expect(rows.map((r) => r.result)).toEqual(['V', 'E', 'D'])
    expect(rows[0]).toMatchObject({ venue: 'casa', gf: 3, ga: 1, opponent: 'T2' })
    expect(rows[2].stats).toBeNull()
    expect(formString(rows)).toBe('VED')
  })

  it('cartão nulo vira zero; posse e médias só com jogos que têm estatística', () => {
    expect(rows[0].stats).toMatchObject({ yellow: 0, yellowOpp: 2, cornersFor: 7, cornersAgainst: 3, possession: 60 })
    const s = summarizeWindow(rows, 10)!
    expect(s.games).toBe(3)
    expect(s.statGames).toBe(2)
    expect(s.goalsFor).toBe(1.33)
    expect(s.shots).toBe(13.5)
    expect(s.cornersFor).toBe(6)
    expect(s.cornersTotal).toBe(9.5)
    expect(s.cardsTotal).toBe(3) // (0+2) e (3+1)
    expect(s.possession).toBe(58)
    expect(s.conversion).toBe(14.8) // 4 gols em 27 finalizações
    expect(s.over25).toBe(1)
  })

  it('janela menor usa só os jogos mais recentes', () => {
    const s = summarizeWindow(rows, 1)!
    expect(s.games).toBe(1)
    expect(s.goalsFor).toBe(3)
    expect(summarizeWindow([], 5)).toBeNull()
  })

  it('radar deixa sem valor o eixo sem dado', () => {
    const r = radarValues(summarizeWindow(rows.slice(2), 5))
    expect(r.Ataque).toBe(0)
    expect(r.Defesa).toBe(33)
    expect(r.Posse).toBeNull()
    expect(r.Escanteios).toBeNull()
  })

  it('leitura da partida é gerada só com os números', () => {
    const h = summarizeWindow(rows, 3)
    const a = summarizeWindow(rows.slice(2), 1)
    const text = matchReading('Casa', 'Fora', h, a).join(' ')
    expect(text).toContain('Casa chega com o ataque mais produtivo')
    expect(matchReading('Casa', 'Fora', null, null)).toEqual([])
  })
})
