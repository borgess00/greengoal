// "Meus bilhetes": mercados disponíveis, liquidação automática pelo placar do
// tempo regulamentar e desempenho. Código puro (sem I/O), coberto por testes.

import { FINISHED, VOID } from './fixture-status'
import { evaluatePick, type Pick } from './tickets'

/** Mercados que o site sabe conferir sozinho (todos pelo placar final). */
export const SLIP_MARKETS = [
  { code: 'casa', group: 'Resultado', label: (h: string) => `Vitória do ${h}`, pick: { kind: 'home' } },
  { code: 'empate', group: 'Resultado', label: () => 'Empate', pick: { kind: 'draw' } },
  { code: 'fora', group: 'Resultado', label: (_h: string, a: string) => `Vitória do ${a}`, pick: { kind: 'away' } },
  { code: '1X', group: 'Dupla chance', label: (h: string) => `${h} ou empate`, pick: { kind: 'double', options: ['home', 'draw'] } },
  { code: 'X2', group: 'Dupla chance', label: (_h: string, a: string) => `${a} ou empate`, pick: { kind: 'double', options: ['draw', 'away'] } },
  { code: '12', group: 'Dupla chance', label: () => 'Qualquer time vence (sem empate)', pick: { kind: 'double', options: ['home', 'away'] } },
  { code: 'ambos_sim', group: 'Ambos marcam', label: () => 'Ambos marcam: sim', pick: { kind: 'btts', yes: true } },
  { code: 'ambos_nao', group: 'Ambos marcam', label: () => 'Ambos marcam: não', pick: { kind: 'btts', yes: false } },
  { code: 'mais_0_5', group: 'Gols', label: () => 'Mais de 0,5 gols', pick: { kind: 'over', line: 0.5 } },
  { code: 'mais_1_5', group: 'Gols', label: () => 'Mais de 1,5 gols', pick: { kind: 'over', line: 1.5 } },
  { code: 'mais_2_5', group: 'Gols', label: () => 'Mais de 2,5 gols', pick: { kind: 'over', line: 2.5 } },
  { code: 'mais_3_5', group: 'Gols', label: () => 'Mais de 3,5 gols', pick: { kind: 'over', line: 3.5 } },
  { code: 'menos_1_5', group: 'Gols', label: () => 'Menos de 1,5 gols', pick: { kind: 'under', line: 1.5 } },
  { code: 'menos_2_5', group: 'Gols', label: () => 'Menos de 2,5 gols', pick: { kind: 'under', line: 2.5 } },
  { code: 'menos_3_5', group: 'Gols', label: () => 'Menos de 3,5 gols', pick: { kind: 'under', line: 3.5 } },
] as const satisfies ReadonlyArray<{ code: string; group: string; label: (h: string, a: string) => string; pick: Pick }>

export type SlipMarketCode = (typeof SLIP_MARKETS)[number]['code']
export const SLIP_MARKET_CODES = SLIP_MARKETS.map((m) => m.code) as SlipMarketCode[]

export function isSlipMarket(code: string): code is SlipMarketCode {
  return (SLIP_MARKET_CODES as string[]).includes(code)
}

export function marketLabel(code: SlipMarketCode, home: string, away: string) {
  return SLIP_MARKETS.find((m) => m.code === code)!.label(home, away)
}

/** Seleção como fica salva no banco. */
export interface SlipSelection {
  fixture_id: number
  market: SlipMarketCode
  odd: number | null
}

export type SelectionStatus = 'open' | 'won' | 'lost' | 'void'
export type SlipStatus = 'open' | 'won' | 'lost' | 'void'

export interface SlipFixture {
  id: number
  kickoff_at: string
  league_name: string
  home_team_name: string
  home_team_logo?: string | null
  away_team_name: string
  away_team_logo?: string | null
  status_short: string
  goals_home: number | null
  goals_away: number | null
  ft_home: number | null
  ft_away: number | null
}

/** Placar do tempo regulamentar (prorrogação e pênaltis não contam). */
function finalScore(f: SlipFixture) {
  if (f.ft_home != null && f.ft_away != null) return { home: f.ft_home, away: f.ft_away }
  if (f.goals_home != null && f.goals_away != null) return { home: f.goals_home, away: f.goals_away }
  return null
}

export function settleSelection(sel: SlipSelection, fixture: SlipFixture | undefined): SelectionStatus {
  if (!fixture) return 'open'
  if (VOID.has(fixture.status_short)) return 'void'
  if (!FINISHED.has(fixture.status_short)) return 'open'
  const score = finalScore(fixture)
  if (!score) return 'open'
  const market = SLIP_MARKETS.find((m) => m.code === sel.market)
  if (!market) return 'void'
  return evaluatePick(market.pick as Pick, score.home, score.away) ? 'won' : 'lost'
}

/** Um erro derruba o bilhete; anuladas contam como odd 1; todas anuladas = anulado. */
export function settleSlip(statuses: SelectionStatus[]): SlipStatus {
  if (statuses.includes('lost')) return 'lost'
  if (statuses.includes('open')) return 'open'
  if (statuses.every((s) => s === 'void')) return 'void'
  return 'won'
}

/** Odd total: produto das odds informadas (anuladas valem 1). Null se faltar alguma. */
export function slipOdd(selections: Array<{ odd: number | null }>, statuses?: SelectionStatus[]): number | null {
  let total = 1
  for (let i = 0; i < selections.length; i++) {
    if (statuses?.[i] === 'void') continue
    const o = selections[i].odd
    if (o == null) return null
    total *= o
  }
  return Math.round(total * 100) / 100
}

export interface SlipPerformance {
  total: number
  open: number
  won: number
  lost: number
  void: number
  /** % de acerto entre os bilhetes decididos (ganhos + perdidos). */
  hitRate: number | null
  /** Resultado em unidades (só bilhetes decididos com odd conhecida). */
  units: number | null
  /** Retorno sobre o valor apostado, em % (mesma base das unidades). */
  roi: number | null
}

export function performance(slips: Array<{ status: SlipStatus; odd_total: number | null; stake_units: number }>): SlipPerformance {
  const count = (s: SlipStatus) => slips.filter((x) => x.status === s).length
  const decided = slips.filter((s) => s.status === 'won' || s.status === 'lost')
  const withOdd = decided.filter((s) => s.status === 'lost' || s.odd_total != null)
  const units = withOdd.reduce((a, s) => a + (s.status === 'won' ? s.stake_units * ((s.odd_total ?? 1) - 1) : -s.stake_units), 0)
  const staked = withOdd.reduce((a, s) => a + s.stake_units, 0)
  return {
    total: slips.length,
    open: count('open'),
    won: count('won'),
    lost: count('lost'),
    void: count('void'),
    hitRate: decided.length ? Math.round((count('won') / decided.length) * 100) : null,
    units: withOdd.length ? Math.round(units * 100) / 100 : null,
    roi: staked ? Math.round((units / staked) * 1000) / 10 : null,
  }
}
