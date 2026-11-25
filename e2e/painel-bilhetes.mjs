// Testes de ponta a ponta do Painel, partidas encerradas, tema claro/escuro
// e "Meus bilhetes". Rodar depois de e2e/run.mjs, contra o mesmo Supabase
// local + mock (ver e2e/README.md).
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { chromium } = createRequire(import.meta.url)('playwright')
const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const SHOTS = process.env.SHOTS_DIR ?? 'e2e/screenshots'
fs.mkdirSync(SHOTS, { recursive: true })
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PASSWORD = 'Senha12345'
const FREE = `gratis+${Date.now()}@example.com`
const PRO = `pro+${Date.now()}@example.com`
const MARKET_WORDS = ['gols no jogo', 'Ambos marcam', 'não sofre gol', 'escanteios no jogo', 'cartões no jogo']

const results = []
async function step(name, fn) {
  try {
    await fn()
    results.push(['ok', name])
    console.log('✓', name)
  } catch (e) {
    results.push(['falhou', name])
    console.log('✗', name, '\n   ', e.message.split('\n').slice(0, 4).join(' | '))
  }
}

// Coleta resultados e estatísticas (automação sem chave da IA) e coloca os
// jogos ainda não encerrados de hoje no futuro, para poder montar bilhetes.
execFileSync('npx', ['tsx', 'scripts/automacao.ts'], { env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }, encoding: 'utf8' })
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const { data: todays } = await admin.from('fixtures').select('id, status_short, home_team_name, away_team_name').eq('grade_date', today).order('id')
const finished = todays.find((f) => f.status_short === 'FT')
const upcoming = todays.filter((f) => f.status_short !== 'FT')
for (const [i, f] of upcoming.entries()) {
  const t = new Date(Date.now() + (2 + i) * 3600_000)
  await admin.from('fixtures').update({ kickoff_at: t.toISOString(), status_short: 'NS', goals_home: null, goals_away: null, ft_home: null, ft_away: null, local_time: t.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) }).eq('id', f.id)
}
assert.ok(finished && upcoming.length, 'esperava partidas encerradas e por jogar hoje (rode e2e/run.mjs antes)')

const users = {}
for (const email of [FREE, PRO]) {
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Teste Painel' } })
  users[email] = data.user.id
}
await admin.rpc('demo_checkout', { _user_id: users[PRO], _plan_id: 'monthly', _method: 'pix' })

const browser = await chromium.launch()
async function newPage({ viewport = { width: 1366, height: 900 }, theme } = {}) {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport })
  await ctx.addInitScript((t) => {
    localStorage.setItem('greengoal:age-confirmed', 'yes')
    if (t) localStorage.setItem('greengoal:theme', t)
  }, theme ?? null)
  return ctx.newPage()
}
async function login(page, email) {
  await page.goto(`${BASE}/auth`)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('E-mail').first().fill(email)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
}

await step('Painel do visitante: linhas que se cumpriram aparecem, o mercado fica oculto', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/painel`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Mercado oculto (Pro)').first().waitFor({ timeout: 20000 })
  await page.getByText(/\d+\/\d+ nos últimos \d+ jogos/).first().waitFor()
  const text = await page.locator('main').innerText()
  for (const w of MARKET_WORDS) assert.ok(!text.includes(w), `mercado vazou para visitante: ${w}`)
  await page.getByText('Odds de referência: Bet365').first().waitFor()
  await page.getByRole('heading', { name: 'Resultados' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/painel-visitante.png`, fullPage: true })
  await page.context().close()
})

await step('Painel do assinante revela os mercados', async () => {
  const page = await newPage()
  await login(page, PRO)
  await page.goto(`${BASE}/painel`)
  await page.waitForLoadState('networkidle')
  await page.getByText(new RegExp(MARKET_WORDS.join('|'))).first().waitFor({ timeout: 20000 })
  assert.equal(await page.getByText('Mercado oculto (Pro)').count(), 0)
  await page.context().close()
})

await step('Tema: escuro por padrão, claro opcional e lembrado', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/painel`)
  await page.waitForLoadState('networkidle')
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'deveria abrir no escuro')
  await page.getByRole('button', { name: 'Ativar modo claro' }).first().click()
  assert.ok(!(await page.evaluate(() => document.documentElement.classList.contains('dark'))))
  await page.reload()
  await page.waitForLoadState('networkidle')
  assert.ok(!(await page.evaluate(() => document.documentElement.classList.contains('dark'))), 'escolha deveria ficar salva')
  await page.getByRole('button', { name: 'Ativar modo escuro' }).first().waitFor()
  await page.context().close()
})

await step('Partidas encerradas: filtro, placar, gols e estatísticas finais', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/jogos?status=encerrados`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('radio', { name: /Encerradas/ }).waitFor()
  await page.getByText('Encerrado', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Finalizações' }).waitFor({ timeout: 15000 })
  await page.getByText(/Atacante .* 23'/).first().waitFor()
  await page.screenshot({ path: `${SHOTS}/partidas-encerradas.png` })
  await page.goto(`${BASE}/jogo/${finished.id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: 'Estatísticas da partida' }).waitFor()
  await page.getByText('Posse de bola').first().waitFor()
  await page.context().close()
})

await step('Meus bilhetes: monta, salva e confere sozinho quando o jogo acaba', async () => {
  const page = await newPage()
  await login(page, FREE)
  // Partida com odds da fonte (coleta completa).
  const { data: withOdds } = await admin.from('fixture_data').select('fixture_id, odds:payload->odds').in('fixture_id', upcoming.map((f) => f.id))
  const target = upcoming.find((f) => withOdds.find((r) => r.fixture_id === f.id && r.odds)) ?? upcoming[0]
  await page.goto(`${BASE}/jogos?status=proximos&jogo=${target.id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: 'Montar bilhete' }).click()
  await page.getByRole('button', { name: /^Mais de 1,5 gols\s*1,30/ }).click()
  await page.getByRole('button', { name: /Abrir bilhete com 1/ }).click()
  await page.getByLabel('Nome (opcional)').fill('Teste automático')
  await page.screenshot({ path: `${SHOTS}/montar-bilhete.png` })
  await page.getByRole('button', { name: 'Salvar em Meus bilhetes' }).click()
  await page.waitForURL(/\/meus-bilhetes/)
  await page.getByText('Teste automático').waitFor()
  await page.getByText('Aberto', { exact: true }).waitFor()
  const { data: rows } = await admin.from('user_slips').select('status, selections, odd_total').eq('user_id', users[FREE])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].selections[0].market, 'mais_1_5')
  assert.equal(Number(rows[0].odd_total), 1.3, 'odd da fonte preenchida')
  // O jogo termina 2 x 1: mais de 1,5 gols bate.
  await admin.from('fixtures').update({ status_short: 'FT', goals_home: 2, goals_away: 1, ft_home: 2, ft_away: 1 }).eq('id', target.id)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /Ganhos 1/ }).click()
  await page.getByText('Ganho', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Desempenho' }).click()
  await page.getByText('100%').first().waitFor()
  await page.screenshot({ path: `${SHOTS}/meus-bilhetes.png`, fullPage: true })
  const { data: after } = await admin.from('user_slips').select('status, settled_at').eq('user_id', users[FREE]).single()
  assert.equal(after.status, 'won')
  assert.ok(after.settled_at)
  await page.context().close()
})

await step('Não aceita bilhete com jogo que já começou', async () => {
  const page = await newPage()
  await login(page, FREE)
  const r = await page.evaluate(async ([url, key, id]) => {
    const raw = Object.entries(localStorage).find(([k]) => k.includes('auth-token'))?.[1]
    const token = raw ? JSON.parse(raw).access_token : ''
    // Inserção direta pela API do banco: bloqueada (só o servidor grava).
    const r = await fetch(`${url}/rest/v1/user_slips`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ user_id: 'x', selections: [{ fixture_id: id, market: 'casa' }] }) })
    return r.status
  }, [process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, finished.id])
  assert.ok(r >= 400, `inserção direta deveria falhar (status ${r})`)
  await page.goto(`${BASE}/jogos?status=encerrados`)
  await page.waitForLoadState('networkidle')
  assert.equal(await page.getByRole('tab', { name: 'Montar bilhete' }).count(), 0, 'jogo encerrado não oferece bilhete')
  await page.context().close()
})

await step('Celular: barra inferior com Painel e Meus bilhetes', async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${BASE}/painel`)
  await page.waitForLoadState('networkidle')
  const nav = page.getByRole('navigation', { name: 'Navegação rápida' })
  await nav.getByRole('link', { name: 'Meus bilhetes' }).click()
  await page.waitForURL(/\/meus-bilhetes/)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'rolagem horizontal')
  await page.screenshot({ path: `${SHOTS}/meus-bilhetes-celular.png` })
  await page.context().close()
})

await browser.close()
for (const id of Object.values(users)) await admin.auth.admin.deleteUser(id)
const failed = results.filter((r) => r[0] !== 'ok')
console.log(`\n${results.length - failed.length}/${results.length} cenários do painel e bilhetes passaram`)
process.exit(failed.length ? 1 : 0)
