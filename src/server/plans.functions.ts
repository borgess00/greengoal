import { createServerFn } from '@tanstack/react-start'
import type { PlanRow } from '@/lib/types'
import { FALLBACK_PLANS } from '@/lib/plans'
import { supabasePublic } from '@/integrations/supabase/supabase.server'

export const getPlans = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) return FALLBACK_PLANS
  const { data, error } = await supabasePublic().from('plans').select('id, name, price_cents, duration_days, sort_order, badge, monthly_equivalent_cents').order('sort_order')
  if (error || !data?.length) return FALLBACK_PLANS
  return data as PlanRow[]
})
