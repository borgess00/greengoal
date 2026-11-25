import type { PlanRow } from './types'

/** Espelho dos planos cadastrados no banco (usado se o banco não responder). */
export const FALLBACK_PLANS: PlanRow[] = [
  { id: 'weekly', name: 'Semanal', price_cents: 1090, duration_days: 7, sort_order: 1, badge: null, monthly_equivalent_cents: null },
  { id: 'monthly', name: 'Mensal', price_cents: 4190, duration_days: 30, sort_order: 2, badge: null, monthly_equivalent_cents: null },
  { id: 'annual', name: 'Anual', price_cents: 39990, duration_days: 365, sort_order: 3, badge: 'Melhor custo', monthly_equivalent_cents: 3333 },
]

export const PLAN_FEATURES = [
  'Estatísticas completas: últimos 5 e 10 jogos, gráficos e radar',
  'Mercados por ângulo: casa/fora, competição e confronto direto',
  'Análise completa de todas as partidas publicadas',
  'Bilhetes prontos do dia, por nível de risco e com odds',
  'Probabilidades, confrontos diretos e forma recente',
  'Gols, cartões, escanteios e finalizadores',
  'Conferência de bilhete com histórico',
  'Radar de escanteios da grade do dia',
  'Acesso pelo celular e computador',
]

export const PERIOD_LABEL: Record<string, string> = { weekly: '7 dias', monthly: '30 dias', annual: '365 dias' }

/** O que qualquer pessoa usa sem assinar (tudo verdadeiro no site). */
export const FREE_FEATURES = [
  'Jogos do dia por país e competição, no horário de Brasília',
  'Forma recente (V/E/D) dos times',
  'Destaque do dia na página inicial',
  'Busca de jogos e times favoritos',
]

/** Economia do plano em relação a pagar o mesmo período no mensal. */
export function savingsVsMonthly(plan: PlanRow, monthly: PlanRow | undefined) {
  if (!monthly || plan.id === 'monthly' || plan.duration_days < monthly.duration_days) return null
  const equivalent = (monthly.price_cents / monthly.duration_days) * plan.duration_days
  const pct = Math.round((1 - plan.price_cents / equivalent) * 100)
  return pct > 0 ? pct : null
}
