// Tipos das linhas do banco usadas na interface.
import type { AnalysisContent } from './analysis'
import type { TicketResult, summarize } from './tickets'

export interface FixtureRow {
  id: number
  grade_date: string
  kickoff_at: string
  local_time: string
  league_id: number
  league_name: string
  league_country: string | null
  league_logo: string | null
  league_round: string | null
  season: number
  home_team_id: number
  home_team_name: string
  home_team_logo: string | null
  away_team_id: number
  away_team_name: string
  away_team_logo: string | null
  venue: string | null
  status_short: string
  status_long: string | null
  elapsed: number | null
  goals_home: number | null
  goals_away: number | null
  ft_home: number | null
  ft_away: number | null
  ht_home: number | null
  ht_away: number | null
  referee: string | null
  has_analysis: boolean
  updated_at: string
}

export interface LeagueRow {
  id: number
  name: string
  country: string | null
  category: string
  priority: number
  enabled: boolean
  core: boolean
  verified: boolean
  logo: string | null
  api_name: string | null
  api_country: string | null
}

export type AnalysisStatus = 'pending' | 'generating' | 'done' | 'error'

export interface AnalysisRow {
  fixture_id: number
  status: AnalysisStatus
  content: AnalysisContent | null
  model: string | null
  error: string | null
  generated_at: string | null
  updated_at: string
}

export interface PlanRow {
  id: 'weekly' | 'monthly' | 'annual' | string
  name: string
  price_cents: number
  duration_days: number
  sort_order: number
  badge: string | null
  monthly_equivalent_cents: number | null
}

export interface SubscriptionRow {
  id: string
  plan_id: string
  status: 'active' | 'canceled' | 'expired' | 'pending'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  provider: string
  created_at: string
}

export interface PaymentRow {
  id: string
  plan_id: string | null
  amount_cents: number
  currency: string
  method: 'card' | 'pix'
  status: 'demo' | 'pending' | 'paid' | 'failed' | 'refunded'
  provider: string
  created_at: string
}

export interface TicketRow {
  id: string
  input: string
  results: TicketResult[]
  summary: ReturnType<typeof summarize>
  created_at: string
}

export function isSubscriptionValid(s: Pick<SubscriptionRow, 'status' | 'current_period_end'> | null | undefined, now = Date.now()) {
  return !!s && s.status === 'active' && Date.parse(s.current_period_end) > now
}
