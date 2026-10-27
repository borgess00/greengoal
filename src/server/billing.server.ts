// Regras de cobrança com o Asaas (exclusivo do servidor).
import { onlyDigits } from '@/lib/cpf'
import { spParts, spToday } from '@/lib/grade'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import {
  createCustomer,
  createSubscription,
  cycleForPlan,
  deleteSubscription,
  methodFromBillingType,
  subscriptionPayments,
  type AsaasPayment,
} from './asaas.server'

async function logBilling(status: 'ok' | 'error', details: Record<string, unknown>, userId: string | null) {
  await supabaseAdmin().from('sync_runs').insert({ kind: 'billing', status, details, started_by: userId })
}

export async function billingCustomer(userId: string) {
  const { data } = await supabaseAdmin().from('billing_customers').select('customer_ref, cpf_cnpj').eq('user_id', userId).maybeSingle()
  return data as { customer_ref: string; cpf_cnpj: string } | null
}

async function ensureCustomer(user: { id: string; email?: string | null }, cpfCnpj: string | undefined) {
  const existing = await billingCustomer(user.id)
  if (existing) return existing.customer_ref
  if (!cpfCnpj) throw new Error('Informe o CPF ou CNPJ para emitir a cobrança.')
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const name = (profile?.full_name as string | null) || (user.email ?? 'Cliente GreenGoal').split('@')[0]
  const c = await createCustomer({ name, email: user.email ?? '', cpfCnpj: onlyDigits(cpfCnpj), userId: user.id })
  await db.from('billing_customers').upsert({ user_id: user.id, provider: 'asaas', customer_ref: c.id, cpf_cnpj: onlyDigits(cpfCnpj) })
  return c.id
}

/** Cancela pedidos pendentes (não pagos) do usuário, aqui e no Asaas. */
export async function cancelPendingOrders(userId: string) {
  const db = supabaseAdmin()
  const { data } = await db.from('subscriptions').select('id, provider_ref').eq('user_id', userId).eq('status', 'pending').eq('provider', 'asaas')
  for (const s of data ?? []) {
    if (s.provider_ref) await deleteSubscription(s.provider_ref as string)
    await db.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', s.id)
    await db.from('payments').update({ status: 'canceled' }).eq('subscription_id', s.id).eq('status', 'pending')
  }
}

async function savePayment(p: AsaasPayment, sub: { id: string; user_id: string; plan_id: string }, status: string) {
  const { error } = await supabaseAdmin()
    .from('payments')
    .upsert(
      {
        user_id: sub.user_id,
        subscription_id: sub.id,
        plan_id: sub.plan_id,
        amount_cents: Math.round(p.value * 100),
        method: methodFromBillingType(p.billingType),
        status,
        provider: 'asaas',
        provider_ref: p.id,
        invoice_url: p.invoiceUrl ?? null,
        due_date: p.dueDate ?? null,
      },
      { onConflict: 'provider_ref' },
    )
  if (error) throw new Error(`Falha ao registrar cobrança: ${error.message}`)
}

/**
 * Cria a assinatura no Asaas e devolve o link da fatura (página segura do
 * Asaas, onde a pessoa paga por Pix ou cartão). O acesso só é liberado
 * quando o webhook confirmar o pagamento.
 */
export async function startAsaasCheckout(user: { id: string; email?: string | null }, planId: string, method: 'pix' | 'card', cpfCnpj?: string, firstDueDate?: string) {
  const db = supabaseAdmin()
  const { data: plan } = await db.from('plans').select('id, name, price_cents').eq('id', planId).eq('active', true).maybeSingle()
  if (!plan) throw new Error('Plano inválido.')

  const customer = await ensureCustomer(user, cpfCnpj)
  await cancelPendingOrders(user.id)

  const now = new Date()
  const { data: sub, error } = await db
    .from('subscriptions')
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      status: 'pending',
      current_period_start: now.toISOString(),
      current_period_end: new Date(now.getTime() + 60_000).toISOString(),
      provider: 'asaas',
    })
    .select('id, user_id, plan_id')
    .single()
  if (error || !sub) throw new Error('Não foi possível registrar o pedido.')

  try {
    const created = await createSubscription({
      customer,
      billingType: method === 'card' ? 'CREDIT_CARD' : 'PIX',
      value: plan.price_cents / 100,
      nextDueDate: firstDueDate ?? spToday(),
      cycle: cycleForPlan(plan.id as string),
      description: `GreenGoal — plano ${plan.name}`,
      externalReference: sub.id as string,
    })
    await db.from('subscriptions').update({ provider_ref: created.id }).eq('id', sub.id)
    const payments = await subscriptionPayments(created.id)
    const first = payments.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    if (first) await savePayment(first, sub as { id: string; user_id: string; plan_id: string }, 'pending')
    await logBilling('ok', { action: 'checkout', plan: plan.id, method, subscription: created.id }, user.id)
    return { subscriptionId: sub.id as string, invoiceUrl: first?.invoiceUrl ?? null }
  } catch (e) {
    await db.from('subscriptions').delete().eq('id', sub.id)
    await logBilling('error', { action: 'checkout', message: e instanceof Error ? e.message : String(e) }, user.id)
    throw e
  }
}

/** Para as próximas cobranças; o acesso continua até o fim do período pago. */
export async function cancelAsaas(userId: string) {
  const db = supabaseAdmin()
  const { data: sub } = await db
    .from('subscriptions')
    .select('id, provider, provider_ref')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!sub) throw new Error('Nenhuma assinatura ativa encontrada.')
  if (sub.provider === 'asaas' && sub.provider_ref) await deleteSubscription(sub.provider_ref as string)
  await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString() }).eq('id', sub.id)
  await logBilling('ok', { action: 'cancel', subscription: sub.provider_ref }, userId)
  return { ok: true }
}

/** Retoma a renovação: nova assinatura no Asaas a partir do vencimento atual. */
export async function resumeAsaas(user: { id: string; email?: string | null }) {
  const db = supabaseAdmin()
  const { data: sub } = await db
    .from('subscriptions')
    .select('id, user_id, plan_id, provider, current_period_end')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('cancel_at_period_end', true)
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle()
  if (!sub) throw new Error('Nenhuma assinatura cancelada para retomar.')
  if (sub.provider !== 'asaas') {
    await db.from('subscriptions').update({ cancel_at_period_end: false, canceled_at: null }).eq('id', sub.id)
    return { ok: true }
  }
  const customer = await billingCustomer(user.id)
  if (!customer) throw new Error('Cadastro de cobrança não encontrado.')
  const { data: plan } = await db.from('plans').select('id, name, price_cents').eq('id', sub.plan_id).single()
  const { data: last } = await db.from('payments').select('method').eq('subscription_id', sub.id).eq('status', 'paid').order('created_at', { ascending: false }).limit(1).maybeSingle()
  const created = await createSubscription({
    customer: customer.customer_ref,
    billingType: last?.method === 'card' ? 'CREDIT_CARD' : 'PIX',
    value: (plan!.price_cents as number) / 100,
    nextDueDate: spParts(sub.current_period_end as string).date,
    cycle: cycleForPlan(sub.plan_id as string),
    description: `GreenGoal — plano ${plan!.name}`,
    externalReference: sub.id as string,
  })
  await db.from('subscriptions').update({ provider_ref: created.id, cancel_at_period_end: false, canceled_at: null }).eq('id', sub.id)
  await logBilling('ok', { action: 'resume', subscription: created.id }, user.id)
  return { ok: true }
}

// ---------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])

/** Processa um evento do Asaas. Retorna uma descrição curta do que foi feito. */
export async function handleAsaasEvent(event: string, payment: AsaasPayment | undefined): Promise<string> {
  if (!payment?.id) return 'ignorado (sem cobrança)'
  const db = supabaseAdmin()
  const cols = 'id, user_id, plan_id, status, provider_ref'
  // 1) pela assinatura atual no Asaas; 2) pela cobrança já registrada (cobre
  // assinaturas antigas, ex.: após "retomar renovação"); 3) pela referência externa.
  let { data: sub } = payment.subscription
    ? await db.from('subscriptions').select(cols).eq('provider', 'asaas').eq('provider_ref', payment.subscription).maybeSingle()
    : { data: null }
  if (!sub) {
    const { data: pay } = await db.from('payments').select('subscription_id').eq('provider_ref', payment.id).maybeSingle()
    if (pay?.subscription_id) sub = (await db.from('subscriptions').select(cols).eq('id', pay.subscription_id).maybeSingle()).data
  }
  if (!sub && payment.externalReference && /^[0-9a-f-]{36}$/i.test(payment.externalReference)) {
    sub = (await db.from('subscriptions').select(cols).eq('provider', 'asaas').eq('id', payment.externalReference).maybeSingle()).data
  }
  if (!sub) return 'ignorado (assinatura desconhecida)'
  const s = sub as { id: string; user_id: string; plan_id: string; status: string; provider_ref: string }

  if (PAID_EVENTS.has(event)) {
    const { data: result, error } = await db.rpc('asaas_confirm_payment', {
      _subscription_id: sub.id,
      _payment_ref: payment.id,
      _amount_cents: Math.round(payment.value * 100),
      _method: methodFromBillingType(payment.billingType),
      _invoice_url: payment.invoiceUrl ?? null,
      _due_date: payment.dueDate ?? null,
    })
    if (error) throw new Error(`Falha ao confirmar pagamento: ${error.message}`)
    if (result === 'extended') {
      // Troca de plano: encerra as outras assinaturas ativas do usuário.
      const { data: others } = await db.from('subscriptions').select('id, provider, provider_ref').eq('user_id', s.user_id).eq('status', 'active').neq('id', s.id)
      for (const o of others ?? []) {
        if (o.provider === 'asaas' && o.provider_ref) await deleteSubscription(o.provider_ref as string).catch(() => undefined)
        await db.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', o.id)
      }
    }
    await logBilling('ok', { event, payment: payment.id, result }, s.user_id)
    return `pagamento ${result}`
  }

  if (event === 'PAYMENT_CREATED' || event === 'PAYMENT_UPDATED') {
    const { data: existing } = await db.from('payments').select('status').eq('provider_ref', payment.id).maybeSingle()
    if (!existing || existing.status === 'pending' || existing.status === 'overdue') await savePayment(payment, s, 'pending')
    return 'cobrança registrada'
  }
  if (event === 'PAYMENT_OVERDUE') {
    await db.from('payments').update({ status: 'overdue' }).eq('provider_ref', payment.id).neq('status', 'paid')
    return 'cobrança vencida'
  }
  if (event === 'PAYMENT_DELETED') {
    await db.from('payments').update({ status: 'canceled' }).eq('provider_ref', payment.id).neq('status', 'paid')
    return 'cobrança removida'
  }
  if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED' || event === 'PAYMENT_CHARGEBACK_DISPUTE') {
    await db.from('payments').update({ status: 'refunded' }).eq('provider_ref', payment.id)
    await db
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString(), current_period_end: new Date().toISOString(), cancel_at_period_end: false })
      .eq('id', s.id)
      .eq('status', 'active')
    await deleteSubscription(s.provider_ref).catch(() => undefined)
    await logBilling('ok', { event, payment: payment.id, result: 'acesso encerrado' }, s.user_id)
    return 'estorno: acesso encerrado'
  }
  return `ignorado (${event})`
}
