// Histórico público dos bilhetes prontos: confere cada bilhete já disputado
// pelo placar e resume a taxa de acerto por faixa de odd e por mês.
// Mercados que o site não confere sozinho (codigo "outro", ex.: escanteios)
// deixam o bilhete como "sem conferência" — nunca são contados como acerto.

import { ticketTier, type OddTier, type ReadyTicket } from './ready-tickets'
import { isSlipMarket, settleSelection, settleSlip, type SelectionStatus, type SlipFixture } from './slips'

export type HistoryStatus = 'won' | 'lost' | 'void' | 'open' | 'unverifiable'

export interface HistoryTicket {
  date: string
  title: string
  tier: OddTier
  odd: number | null
  status: HistoryStatus
  selections: Array<{ game: string; market: string; odd: number | null; status: SelectionStatus | 'unverifiable'; score: string | null }>
}

export function settleReadyTicket(t: ReadyTicket, date: string, fixtures: Map<number, SlipFixture>): HistoryTicket {
  const selections = t.selecoes.map((s) => {
    const f = fixtures.get(s.fixture_id)
    const h = f?.ft_home ?? f?.goals_home
    const a = f?.ft_away ?? f?.goals_away
    const score = h != null && a != null ? `${h} x ${a}` : null
    const status: SelectionStatus | 'unverifiable' = isSlipMarket(s.codigo) ? settleSelection({ fixture_id: s.fixture_id, market: s.codigo, odd: s.odd }, f) : 'unverifiable'
    return { game: s.jogo, market: s.mercado, odd: s.odd, status, score }
  })
  const verifiable = selections.map((s) => s.status).filter((s): s is SelectionStatus => s !== 'unverifiable')
  let status: HistoryStatus
  if (verifiable.includes('lost')) status = 'lost' // um erro já decide, mesmo com mercado não conferível
  else if (selections.some((s) => s.status === 'unverifiable')) status = 'unverifiable'
  else status = settleSlip(verifiable)
  return { date, title: t.titulo, tier: ticketTier(t), odd: t.odd_total, status, selections }
}

export interface TierSummary {
  tier: OddTier
  won: number
  lost: number
  /** % de acerto entre ganhos + perdidos (null sem bilhetes decididos). */
  rate: number | null
  /** Resultado com 1 unidade por bilhete, só bilhetes decididos com odd total. */
  units: number | null
}

export function summarizeHistory(list: HistoryTicket[]) {
  const decided = list.filter((t) => t.status === 'won' || t.status === 'lost')
  const rate = (arr: HistoryTicket[]) => {
    const d = arr.filter((t) => t.status === 'won' || t.status === 'lost')
    return d.length ? Math.round((d.filter((t) => t.status === 'won').length / d.length) * 100) : null
  }
  const units = (arr: HistoryTicket[]) => {
    const d = arr.filter((t) => (t.status === 'won' && t.odd != null) || t.status === 'lost')
    if (!d.length) return null
    return Math.round(d.reduce((s, t) => s + (t.status === 'won' ? (t.odd as number) - 1 : -1), 0) * 100) / 100
  }
  const tiers: OddTier[] = ['baixa', 'media', 'alta', 'altissima']
  const byTier: TierSummary[] = tiers.map((tier) => {
    const arr = list.filter((t) => t.tier === tier)
    return { tier, won: arr.filter((t) => t.status === 'won').length, lost: arr.filter((t) => t.status === 'lost').length, rate: rate(arr), units: units(arr) }
  })
  const months = new Map<string, HistoryTicket[]>()
  for (const t of list) months.set(t.date.slice(0, 7), [...(months.get(t.date.slice(0, 7)) ?? []), t])
  return {
    total: list.length,
    decided: decided.length,
    won: decided.filter((t) => t.status === 'won').length,
    lost: decided.filter((t) => t.status === 'lost').length,
    unverifiable: list.filter((t) => t.status === 'unverifiable').length,
    rate: rate(list),
    units: units(list),
    byTier,
    byMonth: [...months.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, arr]) => ({ month, won: arr.filter((t) => t.status === 'won').length, lost: arr.filter((t) => t.status === 'lost').length, rate: rate(arr) })),
  }
}
