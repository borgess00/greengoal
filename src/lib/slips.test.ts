import { describe, expect, it } from 'vitest'
import { marketLabel, performance, settleSelection, settleSlip, slipOdd, type SlipFixture } from './slips'

const fx = (status: string, ft: [number, number] | null, goals: [number, number] | null = ft): SlipFixture => ({
  id: 1,
  kickoff_at: '2026-11-25T20:00:00Z',
  league_name: 'Liga',
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  status_short: status,
  goals_home: goals?.[0] ?? null,
  goals_away: goals?.[1] ?? null,
  ft_home: ft?.[0] ?? null,
  ft_away: ft?.[1] ?? null,
})

describe('settleSelection', () => {
  it('confere pelo placar do tempo regulamentar', () => {
    expect(settleSelection({ fixture_id: 1, market: 'casa', odd: 1.8 }, fx('FT', [2, 1]))).toBe('won')
    expect(settleSelection({ fixture_id: 1, market: 'mais_2_5', odd: 2 }, fx('FT', [2, 1]))).toBe('won')
    expect(settleSelection({ fixture_id: 1, market: 'ambos_nao', odd: 2 }, fx('FT', [2, 1]))).toBe('lost')
    expect(settleSelection({ fixture_id: 1, market: 'X2', odd: 2 }, fx('FT', [0, 0]))).toBe('won')
    // Prorrogação não conta: 1x1 no tempo normal, 2x1 depois.
    expect(settleSelection({ fixture_id: 1, market: 'empate', odd: 3 }, fx('AET', [1, 1], [2, 1]))).toBe('won')
  })
  it('jogo não encerrado fica aberto; adiado/cancelado anula', () => {
    expect(settleSelection({ fixture_id: 1, market: 'casa', odd: null }, fx('2H', null, [1, 0]))).toBe('open')
    expect(settleSelection({ fixture_id: 1, market: 'casa', odd: null }, fx('PST', null))).toBe('void')
    expect(settleSelection({ fixture_id: 1, market: 'casa', odd: null }, undefined)).toBe('open')
  })
})

describe('bilhete', () => {
  it('um erro perde; anuladas valem odd 1; tudo anulado = anulado', () => {
    expect(settleSlip(['won', 'lost', 'open'])).toBe('lost')
    expect(settleSlip(['won', 'open'])).toBe('open')
    expect(settleSlip(['won', 'void'])).toBe('won')
    expect(settleSlip(['void', 'void'])).toBe('void')
    expect(slipOdd([{ odd: 1.5 }, { odd: 2 }])).toBe(3)
    expect(slipOdd([{ odd: 1.5 }, { odd: 2 }], ['won', 'void'])).toBe(1.5)
    expect(slipOdd([{ odd: 1.5 }, { odd: null }])).toBeNull()
  })
  it('desempenho: acerto, unidades e ROI só com dados reais', () => {
    const p = performance([
      { status: 'won', odd_total: 3, stake_units: 1 },
      { status: 'lost', odd_total: 2, stake_units: 1 },
      { status: 'won', odd_total: null, stake_units: 1 },
      { status: 'open', odd_total: 2, stake_units: 1 },
      { status: 'void', odd_total: 2, stake_units: 1 },
    ])
    expect(p).toMatchObject({ total: 5, open: 1, won: 2, lost: 1, void: 1, hitRate: 67, units: 1, roi: 50 })
    expect(performance([]).hitRate).toBeNull()
  })
  it('rótulos dos mercados usam os nomes dos times', () => {
    expect(marketLabel('casa', 'Flamengo', 'Palmeiras')).toBe('Vitória do Flamengo')
    expect(marketLabel('X2', 'Flamengo', 'Palmeiras')).toBe('Palmeiras ou empate')
  })
})
