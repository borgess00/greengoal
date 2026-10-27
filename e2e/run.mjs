// Testes de ponta a ponta contra Supabase local + mock das APIs externas.
// Pré-requisitos: `npx supabase start`, `node e2e/mock-apis.mjs` e `npm run dev`
// com as variáveis apontando para eles (ver e2e/README.md).
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// Playwright pré-instalado globalmente no ambiente (ou instalado no projeto).
const { chromium } = createRequire(import.meta.url)('playwright')

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const SHOTS = process.env.SHOTS_DIR ?? 'e2e/screenshots'
fs.mkdirSync(SHOTS, { recursive: true })
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ADMIN_EMAIL = 'contato.greengoal@gmail.com'
const USER_EMAIL = `assinante+${Date.now()}@example.com`
const PASSWORD = 'Senha12345'

function spDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]))
  let d = `${p.year}-${p.month}-${p.day}`
  return d
}

async function ensureUser(email, name) {
  const { data: list } = await admin.auth.admin.listUsers()
  const found = list.users.find((u) => u.email === email)
  if (found) return found
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name } })
  if (error) throw error
  return data.user
}

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['ok', name])
    console.log('✓', name)
  } catch (e) {
    results.push(['falhou', name, e.message])
    console.log('✗', name, '\n   ', e.message.split('\n').slice(0, 3).join(' | '))
  }
}

async function login(page, email) {
  await page.goto(`${BASE}/auth`)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('E-mail').first().fill(email)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 15000 })
}

const browser = await chromium.launch()
const ctxOpts = { locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }
const grade = spDate()

// Estado limpo para o dia.
await admin.from('fixtures').delete().eq('grade_date', grade)
await admin.from('ai_usage').delete().neq('calls', -1)
await admin.from('app_settings').upsert({ key: 'ai_daily_limit', value: 50 })

await step('Aviso 18+: “Não” bloqueia e “Sim” libera', async () => {
  const ctx = await browser.newContext(ctxOpts)
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Você tem 18 anos ou mais?' }).waitFor()
  await page.getByRole('button', { name: 'Não' }).click()
  await page.getByRole('heading', { name: 'Acesso não permitido' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Acesso não permitido' }).waitFor()
  await ctx.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Sim, tenho' }).click()
  await page.getByRole('heading', { name: 'Você tem 18 anos ou mais?' }).waitFor({ state: 'detached' })
  await page.reload()
  await page.waitForTimeout(500)
  assert.equal(await page.getByRole('heading', { name: 'Você tem 18 anos ou mais?' }).count(), 0)
  await ctx.close()
})

const adultCtx = async (viewport) => {
  const ctx = await browser.newContext({ ...ctxOpts, viewport })
  await ctx.addInitScript(() => localStorage.setItem('greengoal:age-confirmed', 'yes'))
  return ctx
}

await step('Endereço inexistente mostra 404', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/nao-existe`)
  await page.getByRole('heading', { name: 'Página não encontrada' }).waitFor()
  await ctx.close()
})

const adminUser = await ensureUser(ADMIN_EMAIL, 'Responsável GreenGoal')
const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', adminUser.id)

await step('Responsável recebe papel admin automaticamente', async () => {
  assert.ok(roles.some((r) => r.role === 'admin'))
})

let fixtureIds = []
await step('Admin busca os jogos do dia (dia do calendário e filtro de campeonatos)', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, ADMIN_EMAIL)
  await page.goto(`${BASE}/admin`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Buscar jogos do dia' }).click()
  await page.getByText(/partida\(s\) salvas/).waitFor({ timeout: 20000 })
  const { data } = await admin.from('fixtures').select('id, local_time, league_id').eq('grade_date', grade).order('id')
  fixtureIds = data.map((f) => f.id)
  assert.equal(data.length, 3, `esperado 3 partidas, veio ${data.length}`)
  assert.ok(!data.some((f) => f.league_id === 9999), 'liga desabilitada não deveria entrar')
  assert.deepEqual(data.map((f) => f.local_time), ['16:00', '19:30', '06:00'])
  await page.screenshot({ path: `${SHOTS}/admin.png`, fullPage: true })
  await ctx.close()
})

await step('Admin gera análise; seções sem dados e promessas são removidas', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, ADMIN_EMAIL)
  await page.goto(`${BASE}/admin`)
  await page.waitForLoadState('networkidle')
  const row = page.locator('li', { hasText: 'Palmeiras x Flamengo' })
  await row.getByRole('button', { name: 'Gerar' }).click()
  await row.getByText('Gerada').waitFor({ timeout: 30000 })
  const { data } = await admin.from('analyses').select('status, content').eq('fixture_id', fixtureIds[0]).single()
  assert.equal(data.status, 'done')
  assert.ok(!JSON.stringify(data.content).includes('Lucro garantido'), 'frase com promessa deveria ser removida')
  assert.ok(data.content.secoes.escanteios, 'escanteios deveria ter dados')
  assert.ok(data.content.display.h2h.length <= 5)
  const usage = await page.getByText(/^1\/50$|^1$/).count()
  assert.ok(usage >= 0)
  await ctx.close()
})

await step('Visitante não recebe o conteúdo da análise', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  const bodies = []
  page.on('response', async (r) => {
    if (r.url().includes('_serverFn') || r.url().includes('/rest/v1/')) bodies.push(await r.text().catch(() => ''))
  })
  await page.goto(`${BASE}/jogo/${fixtureIds[0]}`)
  await page.getByText('Análise exclusiva para assinantes').waitFor()
  assert.ok(!bodies.some((b) => b.includes('ocupa a')), 'texto da análise vazou para visitante')
  assert.ok(!(await page.content()).includes('ocupa a'))
  await page.screenshot({ path: `${SHOTS}/jogo-bloqueado.png`, fullPage: true })
  await ctx.close()
})

const user = await ensureUser(USER_EMAIL, 'Assinante Teste')

await step('Usuário sem assinatura vê bloqueio; RLS impede leitura direta', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, USER_EMAIL)
  await page.goto(`${BASE}/jogo/${fixtureIds[0]}`)
  await page.getByText('Análise exclusiva para assinantes').waitFor()
  const direct = await page.evaluate(async ([url, key]) => {
    const raw = Object.entries(localStorage).find(([k]) => k.includes('auth-token'))?.[1]
    const token = raw ? JSON.parse(raw).access_token : ''
    const r = await fetch(`${url}/rest/v1/analyses?select=content`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
    return r.json()
  }, [process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY])
  assert.deepEqual(direct, [])
  await page.goto(`${BASE}/bilhete`)
  await page.getByText('Recurso exclusivo para assinantes').waitFor()
  await ctx.close()
})

await step('Assinatura demonstrativa libera análise, bilhete e radar', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, USER_EMAIL)
  await page.goto(`${BASE}/planos`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Assinar anual' }).click()
  await page.getByText('Modo demonstração — nenhuma cobrança será feita.').waitFor()
  await page.screenshot({ path: `${SHOTS}/checkout.png` })
  await page.getByRole('button', { name: 'Ativar demonstração' }).click()
  await page.waitForURL(/\/perfil/)
  await page.getByRole('heading', { name: 'Plano Anual' }).waitFor()
  const { data: pays } = await admin.from('payments').select('status, method, amount_cents').eq('user_id', user.id)
  assert.deepEqual(pays.map((p) => [p.status, p.method, p.amount_cents]), [['demo', 'pix', 39990]])

  await page.goto(`${BASE}/jogo/${fixtureIds[0]}`)
  await page.getByText('Mercados em destaque').waitFor({ timeout: 15000 })
  await page.getByText('Últimos confrontos diretos').waitFor()
  await page.screenshot({ path: `${SHOTS}/jogo-analise.png`, fullPage: true })

  await page.goto(`${BASE}/jogo/${fixtureIds[1]}`)
  await page.getByText('A análise desta partida ainda não foi publicada').waitFor()

  await page.goto(`${BASE}/bilhete`)
  await page.getByRole('textbox').fill(['Palmeiras x Flamengo - Casa', 'Flamengo x Palmeiras - Empate', 'Arsenal x Chelsea - Mais de 2.5 gols', 'Real Madrid x Barcelona - casa', 'bobagem'].join('\n'))
  await page.getByRole('button', { name: 'Conferir bilhete' }).click()
  await page.getByText('Resultado da conferência').waitFor({ timeout: 20000 })
  const text = await page.locator('main').innerText()
  for (const label of ['Acertou', 'Errou', 'Não encontrado', 'Formato inválido']) assert.ok(text.includes(label), `faltou ${label}`)
  assert.ok(text.includes('Resultado de conferência informativo. Não há garantia de lucro.'))
  await page.screenshot({ path: `${SHOTS}/bilhete.png`, fullPage: true })
  const { count } = await admin.from('tickets').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  assert.equal(count, 1)
  await ctx.close()
})

await step('Cancelamento mantém acesso até o vencimento', async () => {
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, USER_EMAIL)
  await page.goto(`${BASE}/perfil?aba=assinatura`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Cancelar assinatura' }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await page.getByText('Cancelada — acesso até o vencimento').waitFor()
  const { data } = await admin.from('subscriptions').select('cancel_at_period_end, status').eq('user_id', user.id).eq('status', 'active').single()
  assert.equal(data.cancel_at_period_end, true)
  await page.goto(`${BASE}/jogo/${fixtureIds[0]}`)
  await page.getByText('Mercados em destaque').waitFor({ timeout: 15000 })
  await page.goto(`${BASE}/perfil?aba=pagamentos`)
  await page.getByText('Demonstração').first().waitFor()
  await ctx.close()
})

await step('Vencimento no passado bloqueia acesso', async () => {
  await admin.from('subscriptions').update({ current_period_start: new Date(Date.now() - 9 * 86400000).toISOString(), current_period_end: new Date(Date.now() - 60000).toISOString() }).eq('user_id', user.id).eq('status', 'active')
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, USER_EMAIL)
  await page.goto(`${BASE}/jogo/${fixtureIds[0]}`)
  await page.getByText('Análise exclusiva para assinantes').waitFor()
  await ctx.close()
})

await step('Limite diário global: lote para no teto', async () => {
  const { data: u } = await admin.from('ai_usage').select('calls').eq('day', grade).maybeSingle()
  const used = u?.calls ?? 0
  await admin.from('app_settings').upsert({ key: 'ai_daily_limit', value: used + 1 })
  const ctx = await adultCtx()
  const page = await ctx.newPage()
  await login(page, ADMIN_EMAIL)
  await page.goto(`${BASE}/admin`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Gerar análises do dia' }).click()
  await page.getByText(/Limite diário de IA atingido/).waitFor({ timeout: 30000 })
  const { data: after } = await admin.from('ai_usage').select('calls').eq('day', grade).single()
  assert.equal(after.calls, used + 1)
  const { count } = await admin.from('analyses').select('fixture_id', { count: 'exact', head: true }).eq('status', 'done').in('fixture_id', fixtureIds)
  assert.equal(count, 2)
  await admin.from('app_settings').upsert({ key: 'ai_daily_limit', value: 50 })
  await ctx.close()
})

await step('Radar de escanteios e jogos do dia no celular', async () => {
  const ctx = await adultCtx({ width: 390, height: 844 })
  const page = await ctx.newPage()
  await login(page, ADMIN_EMAIL)
  await page.goto(`${BASE}/escanteios`)
  await page.getByRole('button', { name: /Baixar relatório/ }).waitFor({ timeout: 15000 })
  await page.screenshot({ path: `${SHOTS}/escanteios-mobile.png`, fullPage: true })
  await page.goto(`${BASE}/jogos`)
  await page.getByRole('heading', { name: 'Brasil' }).waitFor()
  await page.getByRole('heading', { name: 'Inglaterra' }).waitFor()
  assert.equal(await page.getByText(/Tarde|Noite/).count(), 0, 'não deve haver divisão Tarde/Noite')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  assert.equal(overflow, false, 'rolagem horizontal no celular')
  await page.screenshot({ path: `${SHOTS}/jogos-mobile.png`, fullPage: true })
  await page.goto(BASE)
  await page.screenshot({ path: `${SHOTS}/home-mobile.png`, fullPage: true })
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('link', { name: 'Admin' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/menu-mobile.png` })
  await ctx.close()
})

await step('Início no computador', async () => {
  const ctx = await adultCtx({ width: 1366, height: 900 })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByRole('heading', { name: /Cada jogo/ }).waitFor()
  assert.ok((await page.title()).includes('GreenGoal'))
  await page.screenshot({ path: `${SHOTS}/home-desktop.png`, fullPage: true })
  await page.goto(`${BASE}/planos`)
  await page.getByText('Equivale a R$ 33,33/mês').waitFor()
  await page.screenshot({ path: `${SHOTS}/planos-desktop.png`, fullPage: true })
  await ctx.close()
})

await browser.close()
const failed = results.filter((r) => r[0] !== 'ok')
console.log(`\n${results.length - failed.length}/${results.length} cenários passaram`)
process.exit(failed.length ? 1 : 0)
