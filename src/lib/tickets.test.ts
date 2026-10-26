import { describe, expect, it } from 'vitest'
import { checkTicket, parsePick, parseTicket, teamSimilarity, type TicketFixture } from './tickets'

const base: Omit<TicketFixture, 'id' | 'home_team_name' | 'away_team_name'> = {
  kickoff_at: '2026-10-20T22:00:00Z',
  league_name: 'Brasileirão Série A',
  status_short: 'FT',
  goals_home: 2,
  goals_away: 1,
  ft_home: 2,
  ft_away: 1,
}
const fixtures: TicketFixture[] = [
  { ...base, id: 1, home_team_name: 'Palmeiras', away_team_name: 'Flamengo' },
  { ...base, id: 2, home_team_name: 'Atletico-MG', away_team_name: 'São Paulo', goals_home: 0, goals_away: 0, ft_home: 0, ft_away: 0 },
  { ...base, id: 3, home_team_name: 'Manchester City', away_team_name: 'Arsenal', status_short: 'NS', goals_home: null, goals_away: null, ft_home: null, ft_away: null },
  { ...base, id: 4, home_team_name: 'Inter', away_team_name: 'Juventus', status_short: 'PEN', goals_home: 1, goals_away: 1, ft_home: 1, ft_away: 1 },
]

describe('parsePick', () => {
  it.each([
    ['Casa', { kind: 'home' }],
    ['1', { kind: 'home' }],
    ['Empate', { kind: 'draw' }],
    ['X', { kind: 'draw' }],
    ['fora', { kind: 'away' }],
    ['2', { kind: 'away' }],
    ['Mais de 2.5 gols', { kind: 'over', line: 2.5 }],
    ['mais de 1,5 gols', { kind: 'over', line: 1.5 }],
    ['Over 3.5', { kind: 'over', line: 3.5 }],
    ['Menos de 2.5 gols', { kind: 'under', line: 2.5 }],
    ['Ambos marcam', { kind: 'btts', yes: true }],
    ['Ambos não marcam', { kind: 'btts', yes: false }],
    ['1X', { kind: 'double', options: ['home', 'draw'] }],
  ])('%s', (text, expected) => {
    expect(parsePick(text)).toEqual(expected)
  })

  it('rejeita linhas inteiras e textos desconhecidos', () => {
    expect(parsePick('Mais de 2 gols')).toBeNull()
    expect(parsePick('escanteios')).toBeNull()
  })
})

describe('parseTicket', () => {
  it('limita a 30 linhas e aponta formato inválido', () => {
    const input = Array.from({ length: 35 }, (_, i) => `Time ${i} x Outro ${i} - casa`).join('\n') + '\nlinha sem formato'
    const { lines, truncated } = parseTicket(input)
    expect(lines).toHaveLength(30)
    expect(truncated).toBe(6)
    expect(parseTicket('qualquer coisa').lines[0].error).toBeTruthy()
  })
})

describe('teamSimilarity', () => {
  it('reconhece variações comuns', () => {
    expect(teamSimilarity('Sao Paulo', 'São Paulo')).toBe(1)
    expect(teamSimilarity('Man City', 'Manchester City')).toBeGreaterThan(0.6)
    expect(teamSimilarity('Atlético Mineiro', 'Atletico-MG')).toBeGreaterThan(0.6)
    expect(teamSimilarity('Palmeiras', 'Flamengo')).toBeLessThan(0.5)
  })
})

describe('checkTicket', () => {
  it('confere palpites contra o placar armazenado', () => {
    const { results, summary } = checkTicket(
      [
        'Palmeiras x Flamengo - Casa',
        'Flamengo x Palmeiras - fora', // mando invertido: "fora" = vitória do Palmeiras
        'Atletico-MG x São Paulo - Mais de 2.5 gols',
        'Manchester City x Arsenal - Ambos marcam',
        'Inter x Juventus - Empate', // decidido nos pênaltis: 90 min = empate
        'Real Madrid x Barcelona - casa',
        'palpite sem formato',
      ].join('\n'),
      fixtures,
      new Date('2026-10-26T12:00:00Z'),
    )
    expect(results.map((r) => r.outcome)).toEqual(['won', 'won', 'lost', 'open', 'won', 'not_found', 'invalid'])
    expect(summary).toMatchObject({ won: 3, lost: 1, open: 1, not_found: 1, invalid: 1, total: 7 })
  })
})
