// Assinaturas — MODO DEMONSTRAÇÃO. Nenhuma cobrança é feita.
// Pagamento real exige um provedor (ex.: Stripe, Mercado Pago) com
// ativação confirmada por webhook verificado; isso ainda não existe aqui.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

export const startCheckout = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { planId: string; method: 'card' | 'pix' }) =>
    z.object({ planId: z.enum(['weekly', 'monthly', 'annual']), method: z.enum(['card', 'pix']) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: subId, error } = await supabaseAdmin().rpc('demo_checkout', {
      _user_id: context.user.id,
      _plan_id: data.planId,
      _method: data.method,
    })
    if (error) throw new Error('Não foi possível ativar a assinatura demonstrativa.')
    return { subscriptionId: subId as string, demo: true }
  })

async function setCancelFlag(userId: string, value: boolean) {
  const { data, error } = await supabaseAdmin()
    .from('subscriptions')
    .update({ cancel_at_period_end: value, canceled_at: value ? new Date().toISOString() : null })
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .select('id, current_period_end')
  if (error) throw new Error('Não foi possível atualizar a assinatura.')
  if (!data?.length) throw new Error('Nenhuma assinatura ativa encontrada.')
  return data[0]
}

/** Cancela a renovação: o acesso continua até o vencimento. */
export const cancelSubscription = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .handler(async ({ context }) => setCancelFlag(context.user.id, true))

export const resumeSubscription = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .handler(async ({ context }) => setCancelFlag(context.user.id, false))
