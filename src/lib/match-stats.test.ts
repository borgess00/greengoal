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

describe('marketAngles', () => {
  const row = (gf: number, ga: number, venue: 'casa' | 'fora', league = 'Liga', corners: number | null = null): import('./match-stats').GameRow => ({
    fixtureId: Math.random(),
    date: '2026-11-01',
    league,
    venue,
    opponent: 'X',
    opponentLogo: null,
    gf,
    ga,
    result: gf > ga ? 'V' : gf < ga ? 'D' : 'E',
    stats:
      corners == null
        ? null
        : { shots: 10, shotsOn: 4, shotsAgainst: 8, cornersFor: corners, cornersAgainst: 4, yellow: 1, red: 0, yellowOpp: 2, redOpp: 0, possession: 50, fouls: 10 },
  })
  it('conta acertos por ângulo e mede a consistência', async () => {
    const { marketAngles, rankMarkets } = await import('./match-stats')
    const games = [row(2, 1, 'casa', 'Liga', 6), row(1, 1, 'fora', 'Copa', 5), row(3, 0, 'casa'), row(0, 0, 'fora'), row(2, 2, 'casa'), row(1, 0, 'casa')]
    const h2h = [row(2, 1, 'casa'), row(1, 2, 'fora'), row(0, 1, 'casa')]
    const list = marketAngles({ team: 'Time', side: 'home', games, venue: 'casa', league: 'Liga', opponent: 'Rival', h2h })
    const over15 = list.find((m) => m.key === 'home-over15')!
    expect(over15.angles.map((a) => [a.label, a.hits, a.total])).toEqual([
      ['nos últimos 6 jogos', 4, 6],
      ['nos últimos 5 jogos', 4, 5],
      ['jogando em casa', 3, 4],
      ['na Liga', 3, 5],
      ['contra o Rival', 2, 3],
    ])
    expect(over15.rate).toBe(67)
    expect(over15.floor).toBe(60)
    expect(list.find((m) => m.key === 'home-scores')!.market).toBe('Time marca')
    // Escanteios só com 2 jogos de estatística: amostra pequena, fica de fora.
    expect(list.find((m) => m.key === 'home-corners9')).toBeUndefined()
    // Com 3+ jogos de estatística o rótulo informa quantos entraram na conta.
    const more = [...games.slice(0, 2), row(1, 0, 'casa', 'Liga', 7), ...games.slice(2)]
    const corners = marketAngles({ team: 'Time', side: 'home', games: more, venue: 'casa', league: 'Liga', opponent: 'Rival', h2h: [] }).find((m) => m.key === 'home-corners9')!
    expect(corners.angles[0]).toEqual({ label: 'nos últimos 7 jogos (3 com estatística)', hits: 3, total: 3 })
    expect(rankMarkets(list)[0].floor).toBeGreaterThanOrEqual(rankMarkets(list)[1].floor)
  })
})
