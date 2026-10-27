// Integração com o Asaas (exclusiva do servidor).
// ASAAS_API_KEY (segredo) define o modo real; sem ela o site usa o checkout
// demonstrativo. ASAAS_ENV = "sandbox" usa o ambiente de testes do Asaas.
// ASAAS_WEBHOOK_TOKEN (segredo) valida as notificações recebidas.

import { timingSafeEqual } from 'node:crypto'

export function asaasConfigured() {
  return !!process.env.ASAAS_API_KEY?.trim()
}

export function asaasSandbox() {
  const key = process.env.ASAAS_API_KEY?.trim() ?? ''
  return process.env.ASAAS_ENV?.trim() === 'sandbox' || key.includes('_hmlg_')
}

function baseUrl() {
  // ASAAS_BASE_URL só para testes locais (servidor simulado).
  const custom = process.env.ASAAS_BASE_URL?.trim()
  if (custom) return custom.replace(/\/+$/, '')
  return asaasSandbox() ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY?.trim()
  if (!key) throw new AsaasError('ASAAS_API_KEY não configurada nos segredos do servidor.', 500)
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      access_token: key,
      'Content-Type': 'application/json',
      'User-Agent': 'GreenGoal/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* corpo não-JSON */
  }
  if (!res.ok) {
    const errors = (json as { errors?: Array<{ description?: string }> } | null)?.errors
    const msg = errors?.map((e) => e.description).filter(Boolean).join('; ') || `Asaas respondeu ${res.status}`
    throw new AsaasError(msg, res.status)
  }
  return json as T
}

export interface AsaasPayment {
  id: string
  customer: string
  subscription?: string | null
  value: number
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED' | string
  status: string
  dueDate: string
  invoiceUrl?: string | null
  externalReference?: string | null
}

export function createCustomer(input: { name: string; email: string; cpfCnpj: string; userId: string }) {
  return call<{ id: string }>('POST', '/customers', {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    externalReference: input.userId,
  })
}

export type Cycle = 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export function createSubscription(input: {
  customer: string
  billingType: 'PIX' | 'CREDIT_CARD'
  value: number
  nextDueDate: string
  cycle: Cycle
  description: string
  externalReference: string
}) {
  return call<{ id: string }>('POST', '/subscriptions', input)
}

export async function subscriptionPayments(subscriptionId: string) {
  const r = await call<{ data?: AsaasPayment[] }>('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`)
  return r.data ?? []
}

/** Encerra a assinatura no Asaas (para as próximas cobranças). */
export async function deleteSubscription(subscriptionId: string) {
  try {
    await call('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`)
  } catch (e) {
    // Já removida no Asaas: segue o fluxo normalmente.
    if (e instanceof AsaasError && e.status === 404) return
    throw e
  }
}

export function cycleForPlan(planId: string): Cycle {
  return planId === 'weekly' ? 'WEEKLY' : planId === 'annual' ? 'YEARLY' : 'MONTHLY'
}

export function methodFromBillingType(t: string): 'pix' | 'card' | 'boleto' {
  return t === 'CREDIT_CARD' ? 'card' : t === 'BOLETO' ? 'boleto' : 'pix'
}

/** Compara o token do webhook em tempo constante. */
export function webhookTokenValid(received: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
  if (!expected || !received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
