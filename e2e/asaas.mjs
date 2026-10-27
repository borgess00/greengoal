// Testes de ponta a ponta do pagamento pelo Asaas (contra o Asaas simulado
// de e2e/mock-apis.mjs). O servidor do site precisa estar rodando com:
//   ASAAS_API_KEY=teste-local ASAAS_BASE_URL=http://localhost:4010/asaas/v3
//   ASAAS_WEBHOOK_TOKEN=<o mesmo valor exportado aqui>
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'

const { chromium } = createRequire(import.meta.url)('playwright')
const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const MOCK = process.env.MOCK_URL ?? 'http://localhost:4010'
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EMAIL = `pagante+${Date.now()}@example.com`
const PASSWORD = 'Senha12345'

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['ok', name])
    console.log('✓', name)
  } catch (e) {
    results.push(['falhou', name])
    console.log('✗', name, '\n   ', e.message.split('\n').slice(0, 3).join(' | '))
  }
}

const { data: created } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Pagante Teste' } })
const userId = created.user.id

async function webhook(event, payment, token = TOKEN) {
  const r = await fetch(`${BASE}/api/asaas/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'asaas-access-token': token },
    body: JSON.stringify({ event, payment }),
  })
  return { status: r.status, body: await r.text() }
}
const sub = async () => (await admin.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single()).data

const browser = await chromium.launch()
const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
await ctx.addInitScript(() => localStorage.setItem('greengoal:age-confirmed', 'yes'))
const page = await ctx.newPage()
let payment

await step('Contratação: CPF, Pix e redirecionamento para a fatura do Asaas', async () => {
  await page.goto(`${BASE}/auth`)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('E-mail').first().fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
  await page.goto(`${BASE}/planos`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Assinar mensal' }).click()
  await page.getByRole('dialog').getByText('Pagamento seguro pelo Asaas').waitFor()
  await page.getByLabel('CPF ou CNPJ do pagador').fill('11111111111')
  assert.ok(await page.getByRole('button', { name: /Ir para o pagamento/ }).isDisabled(), 'CPF inválido deveria bloquear')
  await page.getByLabel('CPF ou CNPJ do pagador').fill('52998224725')
  await page.getByRole('button', { name: /Ir para o pagamento/ }).click()
  await page.waitForURL(/\/fatura\//, { timeout: 20000 })
  const s = await sub()
  assert.equal(s.status, 'pending')
  assert.equal(s.provider, 'asaas')
  assert.ok(s.provider_ref?.startsWith('sub_'))
  const { data: pays } = await admin.from('payments').select('status, invoice_url, amount_cents, method').eq('subscription_id', s.id)
  assert.deepEqual(pays.map((p) => [p.status, p.amount_cents, p.method]), [['pending', 4190, 'pix']])
  const state = await (await fetch(`${MOCK}/__asaas`)).json()
  payment = state.last
  assert.equal(state.subs[s.provider_ref].cycle, 'MONTHLY')
  const { data: has } = await admin.rpc('has_active_subscription', { _user_id: userId })
  assert.equal(has, false, 'sem pagamento não pode liberar acesso')
})

await step('Webhook: token errado é recusado', async () => {
  const r = await webhook('PAYMENT_RECEIVED', payment, 'token-errado')
  assert.equal(r.status, 401)
  assert.equal((await sub()).status, 'pending')
})

await step('Webhook: pagamento confirmado libera 30 dias (e não duplica)', async () => {
  const r = await webhook('PAYMENT_RECEIVED', { ...payment, status: 'RECEIVED' })
  assert.equal(r.status, 200, r.body)
  const s = await sub()
  assert.equal(s.status, 'active')
  const days = (Date.parse(s.current_period_end) - Date.now()) / 86400000
  assert.ok(days > 29 && days < 31, `dias: ${days}`)
  const again = await webhook('PAYMENT_CONFIRMED', payment)
  assert.ok(again.body.includes('duplicate'), again.body)
  assert.equal((await sub()).current_period_end, s.current_period_end)
  const { data: has } = await admin.rpc('has_active_subscription', { _user_id: userId })
  assert.equal(has, true)
})

await step('Minha conta mostra assinatura Asaas; cancelar para a renovação', async () => {
  await page.goto(`${BASE}/perfil?aba=assinatura`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Renovação automática pelo Asaas').waitFor()
  await page.getByRole('button', { name: 'Cancelar assinatura' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await page.getByText('Cancelada — acesso até o vencimento').waitFor()
  const s = await sub()
  assert.equal(s.cancel_at_period_end, true)
  const state = await (await fetch(`${MOCK}/__asaas`)).json()
  assert.equal(state.subs[s.provider_ref].deleted, true, 'assinatura deveria ser removida no Asaas')
})

await step('Retomar renovação cria nova assinatura a partir do vencimento', async () => {
  const before = (await sub()).provider_ref
  await page.getByRole('button', { name: 'Retomar renovação' }).click()
  await page.getByText('Renovação automática pelo Asaas').waitFor()
  const s = await sub()
  assert.equal(s.cancel_at_period_end, false)
  assert.notEqual(s.provider_ref, before)
  const state = await (await fetch(`${MOCK}/__asaas`)).json()
  const due = state.subs[s.provider_ref].nextDueDate
  assert.ok(Date.parse(due) > Date.now() + 28 * 86400000, `primeira cobrança deveria ser no vencimento: ${due}`)
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? 'e2e/screenshots'}/asaas-perfil.png`, fullPage: true })
})

await step('Estorno encerra o acesso', async () => {
  const r = await webhook('PAYMENT_REFUNDED', payment)
  assert.equal(r.status, 200, r.body)
  const { data: has } = await admin.rpc('has_active_subscription', { _user_id: userId })
  assert.equal(has, false)
  const { data: p } = await admin.from('payments').select('status').eq('provider_ref', payment.id).single()
  assert.equal(p.status, 'refunded')
})

await browser.close()
const failed = results.filter((r) => r[0] !== 'ok')
console.log(`\n${results.length - failed.length}/${results.length} cenários de pagamento passaram`)
process.exit(failed.length ? 1 : 0)
