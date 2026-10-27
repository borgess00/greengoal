import { describe, expect, it } from 'vitest'
import { buildReadyTickets, oddsByCode, type TicketFixtureInfo } from './ready-tickets'

const fixtures: TicketFixtureInfo[] = [
  {
    id: 1,
    home: 'Sassuolo',
    away: 'Lazio',
    league: 'Serie A',
    kickoff_at: '2026-10-27T17:30:00Z',
    local_time: '14:30',
    odds: oddsByCode([
      { market: 'Resultado final', bookmaker: 'William Hill', margin: 9.4, options: [{ label: 'Fora', code: 'fora', odd: 2.05, implied: 44.6 }] },
      { market: 'Gols — linha 2.5', bookmaker: 'William Hill', margin: 5, options: [{ label: 'Mais de 2.5', odd: 1.8, implied: 54.8 } as never] },
    ]),
  },
  { id: 2, home: 'Arsenal', away: 'Chelsea', league: 'Premier League', kickoff_at: '2026-10-27T16:00:00Z', local_time: '13:00', odds: {} },
]

describe('bilhetes prontos', () => {
  it('encaixa odds reais, descarta jogos inválidos e repetidos e calcula totais', () => {
    const { bilhetes } = buildReadyTickets(
      {
        observacoes: ['x'],
        bilhetes: [
          {
            titulo: 'Médio',
            risco: 'medio',
            resumo: 'r',
            selecoes: [
              { fixture_id: 1, mercado: 'Lazio vence', codigo: 'fora', probabilidade_estimada: 48, justificativa: 'j' },
              { fixture_id: 1, mercado: 'Mais de 2.5', codigo: 'mais_2_5', probabilidade_estimada: 55, justificativa: 'repetido' },
              { fixture_id: 99, mercado: 'Inventado', codigo: 'casa', probabilidade_estimada: 60, justificativa: 'j' },
              { fixture_id: 2, mercado: 'Ambos marcam', codigo: 'ambos_sim', probabilidade_estimada: 60, justificativa: 'j' },
            ],
          },
          {
            titulo: 'Baixo',
            risco: 'baixo',
            resumo: 'r',
            selecoes: [{ fixture_id: 1, mercado: 'Mais de 2.5', codigo: 'mais_2_5', probabilidade_estimada: 55, justificativa: 'j' }],
          },
        ],
      },
      fixtures,
    )
    expect(bilhetes.map((b) => b.risco)).toEqual(['baixo', 'medio'])
    expect(bilhetes[0].odd_total).toBe(1.8) // odd encontrada pelo rótulo antigo
    const medio = bilhetes[1]
    expect(medio.selecoes.map((s) => s.fixture_id)).toEqual([2, 1]) // ordenado por horário, sem repetidos/inválidos
    expect(medio.selecoes[1].odd).toBe(2.05)
    expect(medio.odd_total).toBeNull() // Arsenal x Chelsea sem odd informada
    expect(medio.probabilidade_combinada).toBe(28.8)
  })
})
