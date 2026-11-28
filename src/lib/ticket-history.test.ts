import { describe, expect, it } from 'vitest'
import type { ReadyTicket } from './ready-tickets'
import type { SlipFixture } from './slips'
import { settleReadyTicket, summarizeHistory } from './ticket-history'

const fx = (id: number, h: number, a: number, status = 'FT'): SlipFixture => ({ id, kickoff_at: '2026-11-20T20:00:00Z', league_name: 'L', home_team_name: 'A', away_team_name: 'B', status_short: status, goals_home: h, goals_away: a, ft_home: h, ft_away: a })
const sel = (id: number, codigo: string, odd: number | null) => ({ fixture_id: id, jogo: 'A x B', liga: 'L', horario: '17:00', kickoff_at: '', mercado: codigo, codigo, probabilidade_estimada: null, odd, probabilidade_implicita: null, casa_de_apostas: null, justificativa: '' }) as ReadyTicket['selecoes'][number]
const ticket = (faixa: ReadyTicket['faixa'], selecoes: ReadyTicket['selecoes'], odd: number | null): ReadyTicket => ({ titulo: 't', faixa, resumo: '', selecoes, odd_total: odd, probabilidade_combinada: null })
const map = new Map([fx(1, 2, 1), fx(2, 0, 0), fx(3, 1, 1, 'NS')].map((f) => [f.id, f]))

describe('histórico dos bilhetes prontos', () => {
  it('confere pelo placar e separa mercados não conferíveis', () => {
    expect(settleReadyTicket(ticket('baixa', [sel(1, 'mais_1_5', 1.3)], 1.3), '2026-11-20', map).status).toBe('won')
    expect(settleReadyTicket(ticket('media', [sel(1, 'casa', 2), sel(2, 'ambos_sim', 1.8)], 3.6), '2026-11-20', map).status).toBe('lost')
    expect(settleReadyTicket(ticket('alta', [sel(1, 'casa', 2), sel(2, 'outro', null)], null), '2026-11-20', map).status).toBe('unverifiable')
    // Erro decide mesmo com outra seleção não conferível.
    expect(settleReadyTicket(ticket('alta', [sel(2, 'casa', 2), sel(1, 'outro', null)], null), '2026-11-20', map).status).toBe('lost')
    expect(settleReadyTicket(ticket('alta', [sel(3, 'casa', 2)], 2), '2026-11-20', map).status).toBe('open')
  })
  it('resume acerto por faixa, unidades e meses', () => {
    const list = [
      settleReadyTicket(ticket('baixa', [sel(1, 'mais_1_5', 1.3)], 1.3), '2026-11-20', map),
      settleReadyTicket(ticket('baixa', [sel(2, 'mais_1_5', 1.4)], 1.4), '2026-11-21', map),
      settleReadyTicket(ticket('media', [sel(1, 'casa', 2.5)], 2.5), '2026-10-30', map),
      settleReadyTicket(ticket('alta', [sel(2, 'outro', null)], null), '2026-11-21', map),
    ]
    const s = summarizeHistory(list)
    expect(s).toMatchObject({ total: 4, decided: 3, won: 2, lost: 1, unverifiable: 1, rate: 67 })
    expect(s.units).toBe(0.8) // +0,3 -1 +1,5
    expect(s.byTier.find((t) => t.tier === 'baixa')).toMatchObject({ won: 1, lost: 1, rate: 50 })
    expect(s.byMonth.map((m) => m.month)).toEqual(['2026-11', '2026-10'])
  })
})
