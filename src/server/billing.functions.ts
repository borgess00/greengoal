// Assinaturas. Com ASAAS_API_KEY configurada, a cobrança é real (Asaas: Pix
// ou cartão, com renovação automática) e o acesso só é liberado pelo webhook
// verificado. Sem a chave, funciona em MODO DEMONSTRAÇÃO, sem cobrança.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isValidCpfCnpj, maskCpfCnpj } from '@/lib/cpf'
import { optionalAuth, requireAuth } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { asaasConfigured, asaasSandbox } from './asaas.server'
import { billingCustomer, cancelAsaas, cancelPendingOrders, resumeAsaas, startAsaasCheckout } from './billing.server'

export type BillingInfo = { mode: 'asaas' | 'demo'; sandbox: boolean; document: string | null }

/** Modo de cobrança e se o usuário já tem CPF/CNPJ cadastrado. */
export const getBillingInfo = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .handler(async ({ context }): Promise<BillingInfo> => {
    if (!asaasConfigured()) return { mode: 'demo', sandbox: false, document: null }
    const customer = context.auth ? await billingCustomer(context.auth.user.id) : null
    return { mode: 'asaas', sandbox: asaasSandbox(), document: customer ? maskCpfCnpj(customer.cpf_cnpj) : null }
  })

export type CheckoutResult = { mode: 'demo'; subscriptionId: string } | { mode: 'asaas'; subscriptionId: string; invoiceUrl: string | null }

export const startCheckout = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { planId: string; method: 'card' | 'pix'; cpfCnpj?: string }) =>
    z
      .object({
        planId: z.enum(['weekly', 'monthly', 'annual']),
        method: z.enum(['card', 'pix']),
        cpfCnpj: z
          .string()
          .trim()
          .refine(isValidCpfCnpj, 'CPF ou CNPJ inválido.')
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    if (asaasConfigured()) {
      const r = await startAsaasCheckout(context.user, data.planId, data.method, data.cpfCnpj)
      return { mode: 'asaas', ...r }
    }
    const { data: subId, error } = await supabaseAdmin().rpc('demo_checkout', {
      _user_id: context.user.id,
      _plan_id: data.planId,
      _method: data.method,
    })
    if (error) throw new Error('Não foi possível ativar a assinatura demonstrativa.')
    return { mode: 'demo', subscriptionId: subId as string }
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
  .handler(async ({ context }) => {
    if (asaasConfigured()) return cancelAsaas(context.user.id)
    return setCancelFlag(context.user.id, true)
  })

export const resumeSubscription = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (asaasConfigured()) return resumeAsaas(context.user)
    return setCancelFlag(context.user.id, false)
  })

/** Desiste de um pedido ainda não pago. */
export const cancelPendingOrder = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await cancelPendingOrders(context.user.id)
    return { ok: true }
  })
