// Bilhetes prontos do dia: formato da resposta da IA, encaixe das odds
// reais (quando a fonte informa) e cálculos derivados. Código puro.

import type { RiskLevel } from './analysis'
import type { ImpliedMarket } from './facts'

export const MARKET_CODES = [
  'casa',
  'empate',
  'fora',
  '1X',
  'X2',
  '12',
  'ambos_sim',
  'ambos_nao',
  'mais_1_5',
  'menos_1_5',
  'mais_2_5',
  'menos_2_5',
  'mais_3_5',
  'menos_3_5',
  'outro',
] as const

export type MarketCode = (typeof MARKET_CODES)[number]

/** Faixas de odd total dos bilhetes prontos. */
export const ODD_TIERS = ['baixa', 'media', 'alta', 'altissima'] as const
export type OddTier = (typeof ODD_TIERS)[number]
export const TIER_LABEL: Record<OddTier, string> = { baixa: 'Odd baixa', media: 'Odd média', alta: 'Odd alta', altissima: 'Odd altíssima' }
export const TIER_RANGE: Record<OddTier, string> = { baixa: 'até 2,00', media: 'de 2,01 a 5,00', alta: 'de 5,01 a 15,00', altissima: 'acima de 15,00' }

/** Faixa pela odd total real (quando todas as seleções têm odd). */
export function tierForOdd(odd: number): OddTier {
  if (odd <= 2) return 'baixa'
  if (odd <= 5) return 'media'
  if (odd <= 15) return 'alta'
  return 'altissima'
}

/** Bilhetes antigos (antes das faixas) usavam nível de risco. */
const LEGACY_TIER: Record<string, OddTier> = { baixo: 'baixa', medio: 'media', 'medio-alto': 'alta' }
export function ticketTier(t: { faixa?: string; risco?: string }): OddTier {
  if (t.faixa && (ODD_TIERS as readonly string[]).includes(t.faixa)) return t.faixa as OddTier
  return LEGACY_TIER[t.risco ?? ''] ?? 'media'
}

export interface AiTicketSelection {
  fixture_id: number
  mercado: string
  codigo: MarketCode
  probabilidade_estimada: number | null
  justificativa: string
}

export interface AiTicket {
  titulo: string
  faixa: OddTier
  resumo: string
  selecoes: AiTicketSelection[]
}

export interface AiTicketsResponse {
  bilhetes: AiTicket[]
  observacoes: string[]
}

export const AI_TICKETS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bilhetes', 'observacoes'],
  properties: {
    bilhetes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'faixa', 'resumo', 'selecoes'],
        properties: {
          titulo: { type: 'string' },
          faixa: { type: 'string', enum: [...ODD_TIERS] },
          resumo: { type: 'string' },
          selecoes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['fixture_id', 'mercado', 'codigo', 'probabilidade_estimada', 'justificativa'],
              properties: {
                fixture_id: { type: 'integer' },
                mercado: { type: 'string' },
                codigo: { type: 'string', enum: [...MARKET_CODES] },
                probabilidade_estimada: { type: ['number', 'null'] },
                justificativa: { type: 'string' },
              },
            },
          },
        },
      },
    },
    observacoes: { type: 'array', items: { type: 'string' } },
  },
} as const

export function isAiTicketsResponse(v: unknown): v is AiTicketsResponse {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.bilhetes) && Array.isArray(o.observacoes)
}

// Mapeia rótulos antigos (análises salvas antes dos códigos) para códigos.
const LABEL_TO_CODE: Record<string, MarketCode> = {
  'Resultado final|Casa': 'casa',
  'Resultado final|Empate': 'empate',
  'Resultado final|Fora': 'fora',
  'Dupla chance|1X': '1X',
  'Dupla chance|X2': 'X2',
  'Dupla chance|12': '12',
  'Ambos marcam|Sim': 'ambos_sim',
  'Ambos marcam|Não': 'ambos_nao',
  'Gols — linha 2.5|Mais de 2.5': 'mais_2_5',
  'Gols — linha 2.5|Menos de 2.5': 'menos_2_5',
}

export interface OddQuote {
  odd: number
  implied: number
  bookmaker: string
}

/** Tabela código -> odd a partir das odds salvas na análise. */
export function oddsByCode(markets: ImpliedMarket[] | undefined | null): Partial<Record<MarketCode, OddQuote>> {
  const out: Partial<Record<MarketCode, OddQuote>> = {}
  for (const m of markets ?? []) {
    for (const o of m.options) {
      const code = ((o as { code?: string }).code ?? LABEL_TO_CODE[`${m.market}|${o.label}`]) as MarketCode | undefined
      if (code && MARKET_CODES.includes(code)) out[code] = { odd: o.odd, implied: o.implied, bookmaker: m.bookmaker }
    }
  }
  return out
}

export interface TicketFixtureInfo {
  id: number
  home: string
  away: string
  league: string
  kickoff_at: string
  local_time: string
  odds: Partial<Record<MarketCode, OddQuote>>
}

export interface ReadySelection {
  fixture_id: number
  jogo: string
  liga: string
  horario: string
  kickoff_at: string
  mercado: string
  codigo: MarketCode
  probabilidade_estimada: number | null
  odd: number | null
  probabilidade_implicita: number | null
  casa_de_apostas: string | null
  justificativa: string
}

export interface ReadyTicket {
  titulo: string
  faixa: OddTier
  /** Só em bilhetes antigos, gerados antes das faixas de odd. */
  risco?: RiskLevel
  resumo: string
  selecoes: ReadySelection[]
  /** Produto das odds; null se alguma seleção não tiver odd informada. */
  odd_total: number | null
  /** Produto das probabilidades estimadas (supõe independência entre jogos). */
  probabilidade_combinada: number | null
}

export interface ReadyTicketsContent {
  date: string
  bilhetes: ReadyTicket[]
  observacoes: string[]
  model: string
  generated_at: string
  fixtures_considered: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Valida a resposta da IA contra as partidas enviadas, descarta seleções
 * inválidas ou repetidas no mesmo jogo, encaixa odds reais e calcula totais.
 */
export function buildReadyTickets(ai: AiTicketsResponse, fixtures: TicketFixtureInfo[]): { bilhetes: ReadyTicket[]; observacoes: string[] } {
  const byId = new Map(fixtures.map((f) => [f.id, f]))
  const bilhetes: ReadyTicket[] = []
  for (const t of ai.bilhetes.slice(0, 12)) {
    const seen = new Set<number>()
    const selecoes: ReadySelection[] = []
    for (const s of t.selecoes) {
      const f = byId.get(Number(s.fixture_id))
      if (!f || seen.has(f.id)) continue
      seen.add(f.id)
      const code = MARKET_CODES.includes(s.codigo) ? s.codigo : 'outro'
      const quote = code !== 'outro' ? f.odds[code] : undefined
      const prob = typeof s.probabilidade_estimada === 'number' && s.probabilidade_estimada > 0 && s.probabilidade_estimada < 100 ? Math.round(s.probabilidade_estimada) : null
      selecoes.push({
        fixture_id: f.id,
        jogo: `${f.home} x ${f.away}`,
        liga: f.league,
        horario: f.local_time,
        kickoff_at: f.kickoff_at,
        mercado: s.mercado.slice(0, 120),
        codigo: code,
        probabilidade_estimada: prob,
        odd: quote?.odd ?? null,
        probabilidade_implicita: quote?.implied ?? null,
        casa_de_apostas: quote?.bookmaker ?? null,
        justificativa: s.justificativa.slice(0, 500),
      })
    }
    if (!selecoes.length) continue
    selecoes.sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))
    const allOdds = selecoes.every((s) => s.odd != null)
    const allProbs = selecoes.every((s) => s.probabilidade_estimada != null)
    const odd_total = allOdds ? round2(selecoes.reduce((a, s) => a * (s.odd as number), 1)) : null
    bilhetes.push({
      titulo: t.titulo.slice(0, 80),
      // Com todas as odds reais, a faixa vem da odd total (e não do rótulo da IA).
      faixa: odd_total != null ? tierForOdd(odd_total) : ticketTier(t),
      resumo: t.resumo.slice(0, 600),
      selecoes,
      odd_total,
      probabilidade_combinada: allProbs ? Math.round(selecoes.reduce((a, s) => a * ((s.probabilidade_estimada as number) / 100), 1) * 1000) / 10 : null,
    })
  }
  const order: Record<OddTier, number> = { baixa: 0, media: 1, alta: 2, altissima: 3 }
  bilhetes.sort((a, b) => order[a.faixa] - order[b.faixa] || (a.odd_total ?? 0) - (b.odd_total ?? 0))
  return { bilhetes, observacoes: ai.observacoes.map((o) => o.slice(0, 300)).slice(0, 8) }
}
