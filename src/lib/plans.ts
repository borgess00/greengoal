import type { PlanRow } from './types'

/** Espelho dos planos cadastrados no banco (usado se o banco não responder). */
export const FALLBACK_PLANS: PlanRow[] = [
  { id: 'weekly', name: 'Semanal', price_cents: 1390, duration_days: 7, sort_order: 1, badge: null, monthly_equivalent_cents: null },
  { id: 'monthly', name: 'Mensal', price_cents: 4190, duration_days: 30, sort_order: 2, badge: null, monthly_equivalent_cents: null },
  { id: 'annual', name: 'Anual', price_cents: 39990, duration_days: 365, sort_order: 3, badge: 'Melhor custo', monthly_equivalent_cents: 3333 },
]

export const PLAN_FEATURES = [
  'Análise completa de todas as partidas publicadas',
  'Bilhetes prontos do dia, por nível de risco e com odds',
  'Probabilidades, confrontos diretos e forma recente',
  'Gols, cartões, escanteios e finalizadores',
  'Conferência de bilhete com histórico',
  'Radar de escanteios da grade do dia',
  'Acesso pelo celular e computador',
]

export const PERIOD_LABEL: Record<string, string> = { weekly: '7 dias', monthly: '30 dias', annual: '365 dias' }
