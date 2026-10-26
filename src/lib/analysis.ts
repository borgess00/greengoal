// Estrutura do conteúdo das análises (compartilhada entre servidor e tela).

import type { AnalysisDisplay, SectionSupport } from './facts'

export const SECTIONS = [
  { key: 'importancia', title: 'Importância do jogo', icon: 'trophy' },
  { key: 'confrontos', title: 'Confrontos diretos', icon: 'swords' },
  { key: 'forma', title: 'Forma recente', icon: 'activity' },
  { key: 'probabilidade', title: 'Probabilidade de resultado', icon: 'chart' },
  { key: 'gols', title: 'Gols', icon: 'goal' },
  { key: 'escanteios', title: 'Escanteios', icon: 'flag' },
  { key: 'cartoes', title: 'Cartões', icon: 'square' },
  { key: 'arbitro', title: 'Árbitro', icon: 'user' },
  { key: 'finalizacoes', title: 'Finalizações dos jogadores', icon: 'crosshair' },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']

export type RiskLevel = 'baixo' | 'medio' | 'medio-alto'

export const RISK_LABELS: Record<RiskLevel, string> = {
  baixo: 'Risco baixo',
  medio: 'Risco médio',
  'medio-alto': 'Risco médio-alto',
}

export interface Highlight {
  mercado: string
  leitura: string
  probabilidade_estimada: number | null
  frequencia_observada: string | null
  risco: RiskLevel
  a_favor: string
  contra: string
}

export interface AiAnalysis {
  secoes: Record<SectionKey, string | null>
  destaques: Highlight[]
  alertas: string[]
  resumo: string | null
  confianca_dados: 'alta' | 'media' | 'baixa'
}

export interface AnalysisContent extends AiAnalysis {
  display: AnalysisDisplay
  meta: {
    model: string
    generated_at: string
    sources: Record<string, boolean>
    removed_sections: SectionKey[]
  }
}

/** Remove seções sem dados de apoio, mesmo que a IA tenha escrito algo. */
export function pruneSections(ai: AiAnalysis, support: SectionSupport): { secoes: AiAnalysis['secoes']; removed: SectionKey[] } {
  const secoes = { ...ai.secoes }
  const removed: SectionKey[] = []
  for (const { key } of SECTIONS) {
    const text = secoes[key]
    if (!support[key] || !text || !text.trim()) {
      if (text && !support[key]) removed.push(key)
      secoes[key] = null
    }
  }
  return { secoes, removed }
}

const FORBIDDEN = /\b(lucro garantido|ganho garantido|aposta certa|green garantido|garantid[oa]s?|certeza absoluta|100% de chance|sem risco|imperd[ií]vel)\b/i

/** Rede de segurança: descarta frases que prometem resultado. */
export function scrubPromises(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !FORBIDDEN.test(s))
    .join(' ')
    .trim()
}

/** JSON Schema (modo estrito da OpenAI) da resposta da IA. */
export const AI_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['secoes', 'destaques', 'alertas', 'resumo', 'confianca_dados'],
  properties: {
    secoes: {
      type: 'object',
      additionalProperties: false,
      required: SECTIONS.map((s) => s.key),
      properties: Object.fromEntries(SECTIONS.map((s) => [s.key, { type: ['string', 'null'] }])),
    },
    destaques: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['mercado', 'leitura', 'probabilidade_estimada', 'frequencia_observada', 'risco', 'a_favor', 'contra'],
        properties: {
          mercado: { type: 'string' },
          leitura: { type: 'string' },
          probabilidade_estimada: { type: ['number', 'null'] },
          frequencia_observada: { type: ['string', 'null'] },
          risco: { type: 'string', enum: ['baixo', 'medio', 'medio-alto'] },
          a_favor: { type: 'string' },
          contra: { type: 'string' },
        },
      },
    },
    alertas: { type: 'array', items: { type: 'string' } },
    resumo: { type: ['string', 'null'] },
    confianca_dados: { type: 'string', enum: ['alta', 'media', 'baixa'] },
  },
} as const

export function isAiAnalysis(v: unknown): v is AiAnalysis {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (!o.secoes || typeof o.secoes !== 'object') return false
  for (const { key } of SECTIONS) {
    const s = (o.secoes as Record<string, unknown>)[key]
    if (s !== null && typeof s !== 'string') return false
  }
  return Array.isArray(o.destaques) && Array.isArray(o.alertas)
}

/** Normaliza a resposta da IA: limpa promessas, limita tamanho e valores. */
export function sanitizeAi(ai: AiAnalysis): AiAnalysis {
  const clean = (s: string | null) => {
    if (!s) return null
    const t = scrubPromises(s).slice(0, 1200)
    return t.length ? t : null
  }
  const secoes = Object.fromEntries(SECTIONS.map(({ key }) => [key, clean(ai.secoes[key])])) as AiAnalysis['secoes']
  const destaques = ai.destaques
    .slice(0, 8)
    .map((d) => ({
      ...d,
      mercado: scrubPromises(d.mercado).slice(0, 120),
      leitura: scrubPromises(d.leitura).slice(0, 600),
      a_favor: scrubPromises(d.a_favor).slice(0, 400),
      contra: scrubPromises(d.contra).slice(0, 400),
      probabilidade_estimada:
        typeof d.probabilidade_estimada === 'number' && d.probabilidade_estimada > 0 && d.probabilidade_estimada < 100
          ? Math.round(d.probabilidade_estimada)
          : null,
    }))
    .filter((d) => d.mercado && d.leitura)
  return {
    secoes,
    destaques,
    alertas: ai.alertas.map((a) => scrubPromises(a).slice(0, 300)).filter(Boolean).slice(0, 8),
    resumo: clean(ai.resumo),
    confianca_dados: ai.confianca_dados,
  }
}
