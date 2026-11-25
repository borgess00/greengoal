// Testes de ponta a ponta das estatísticas dinâmicas, busca, favoritos e
// navegação do celular. Rodar depois de e2e/run.mjs (que cria as partidas e
// coleta os dados de duas delas) contra o mesmo Supabase local + mock.
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
const EMAIL = `stats+${Date.now()}@example.com`
const PASSWORD = 'Senha12345'

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

const { data: withData } = await admin.from('fixture_data').select('fixture_id')
const { data: fixtures } = await admin.from('fixtures').select('id, home_team_id, home_team_name, away_team_name, form_home').order('kickoff_at')
const withIds = new Set(withData.map((r) => r.fixture_id))
const covered = fixtures.find((f) => withIds.has(f.id))
const missing = fixtures.find((f) => !withIds.has(f.id))
assert.ok(covered, 'rode e2e/run.mjs antes: precisa de uma partida com dados coletados')

const { data: created } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Stats Teste' } })
const userId = created.user.id

const browser = await chromium.launch()
async function newPage(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport })
  await ctx.addInitScript(() => localStorage.setItem('greengoal:age-confirmed', 'yes'))
  return ctx.newPage()
}
async function login(page) {
  await page.goto(`${BASE}/auth`)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('E-mail').first().fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'))
}

await step('Visitante vê só a forma recente; números detalhados ficam bloqueados', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/jogo/${covered.id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: 'Forma recente' }).waitFor()
  await page.getByText('Estatísticas completas para assinantes').waitFor()
  assert.equal(await page.getByText('Comparativo por jogo').count(), 0)
  assert.equal(await page.getByRole('img', { name: /Forma recente, do mais recente/ }).count(), 2)
  await page.context().close()
})

await step('Cartões dos jogos mostram a forma recente', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/jogos`)
  await page.waitForLoadState('networkidle')
  const badges = page.getByRole('img', { name: /Forma recente/ })
  assert.ok((await badges.count()) >= 2, 'esperava a forma nos cartões')
  await page.context().close()
})

await step('Início mostra o destaque do dia com números e radar', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: 'Cada mercado, testado por vários ângulos' }).waitFor()
  await page.getByText(/Dados reais de .* x .*, hoje às/).waitFor()
  await page.getByText(/\d+\/\d+ nos últimos \d+ jogos/).first().waitFor()
  await page.getByText('Destaque do dia', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Radar comparativo' }).waitFor()
  await page.getByRole('img', { name: /Radar comparativo/ }).waitFor()
  await page.getByText('Destaque do dia', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/stats-inicio.png`, fullPage: true })
  await page.context().close()
})

await step('Assinante vê o painel: abas, recorte 5/10, gráfico com tooltip, radar e leitura', async () => {
  await admin.rpc('demo_checkout', { _user_id: userId, _plan_id: 'monthly', _method: 'pix' })
  const page = await newPage()
  await login(page)
  await page.goto(`${BASE}/jogo/${covered.id}`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Comparativo por jogo').waitFor()
  // Recorte: últimos 10 → forma com 10 resultados; últimos 5 → 5.
  const forms = page.getByRole('img', { name: /Forma recente, do mais recente/ })
  const count10 = (await forms.first().getAttribute('aria-label')).split(': ')[1].split(',').length
  await page.getByRole('radio', { name: 'Últimos 5' }).click()
  const count5 = (await forms.first().getAttribute('aria-label')).split(': ')[1].split(',').length
  assert.equal(count10, 10)
  assert.equal(count5, 5)
  await page.getByRole('radio', { name: 'Últimos 10' }).click()
  // Tooltip ao passar o mouse sobre uma barra do gráfico.
  const chart = page.getByRole('img', { name: 'Gols marcados por jogo de cada equipe' })
  await chart.scrollIntoViewIfNeeded()
  await chart.locator('rect[fill="transparent"]').last().hover()
  await page.getByText(/gol\(s\)$/).first().waitFor({ timeout: 5000 })
  await page.getByRole('heading', { name: 'Leitura da partida' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/stats-resumo.png`, fullPage: true })
  for (const tab of ['Gols', 'Finalizações', 'Escanteios', 'Cartões']) {
    await page.getByRole('tab', { name: tab }).click()
    await page.getByRole('tabpanel').getByRole('img').first().waitFor()
  }
  await page.getByRole('tab', { name: 'Escanteios' }).click()
  await page.screenshot({ path: `${SHOTS}/stats-escanteios.png`, fullPage: false })
  // Mercados por ângulo: cartões com "x/y nos últimos 10 jogos" e filtro por time.
  await page.getByRole('tab', { name: 'Mercados' }).click()
  await page.getByRole('heading', { name: 'Mercados por ângulo' }).waitFor()
  await page.getByRole('tabpanel').getByText(/\d+\/\d+ nos últimos \d+ jogos/).first().waitFor()
  await page.getByRole('radio', { name: covered.away_team_name }).click()
  const titles = await page.getByRole('tabpanel').locator('p.truncate.text-xs').allTextContents()
  assert.ok(titles.length > 0 && titles.every((t) => t === covered.away_team_name), `filtro por time: ${titles}`)
  await page.context().close()
})

await step('Busca encontra jogos por time e aguenta caracteres especiais', async () => {
  const page = await newPage()
  const team = covered.home_team_name
  await page.goto(`${BASE}/busca?q=${encodeURIComponent(team.slice(0, 5))}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: new RegExp(`${team} x`) }).first().waitFor()
  await page.goto(`${BASE}/busca?q=${encodeURIComponent('a,b)(*%')}`)
  await page.waitForLoadState('networkidle')
  assert.equal(await page.getByText('Não foi possível buscar agora').count(), 0)
  await page.context().close()
})

await step('Favoritos: seguir um time na partida e ver os jogos dele', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/favoritos`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Entre para salvar seus favoritos').waitFor()
  await login(page)
  await page.goto(`${BASE}/jogo/${covered.id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: `Adicionar ${covered.home_team_name} aos favoritos` }).click()
  await page.getByRole('button', { name: `Remover ${covered.home_team_name} dos favoritos` }).waitFor()
  await page.goto(`${BASE}/favoritos`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: `Deixar de seguir ${covered.home_team_name}` }).waitFor()
  await page.getByRole('link', { name: new RegExp(`${covered.home_team_name} x`) }).first().waitFor()
  const { data: rows } = await admin.from('favorite_teams').select('team_id').eq('user_id', userId)
  assert.deepEqual(rows.map((r) => r.team_id), [covered.home_team_id])
  await page.screenshot({ path: `${SHOTS}/favoritos.png`, fullPage: true })
  await page.getByRole('button', { name: `Deixar de seguir ${covered.home_team_name}` }).click()
  await page.getByText('Você ainda não segue nenhum time').waitFor()
  await page.context().close()
})

await step('Celular: barra inferior aparece e navega; no computador fica escondida', async () => {
  const page = await newPage({ width: 390, height: 844 })
  await page.goto(`${BASE}/jogo/${covered.id}`)
  await page.waitForLoadState('networkidle')
  const nav = page.getByRole('navigation', { name: 'Navegação rápida' })
  await nav.waitFor()
  await page.screenshot({ path: `${SHOTS}/stats-celular.png`, fullPage: false })
  await nav.getByRole('link', { name: 'Favoritos' }).click()
  await page.waitForURL(/\/favoritos/)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'rolagem horizontal no celular')
  const desk = await newPage()
  await desk.goto(`${BASE}/`)
  await desk.waitForLoadState('networkidle')
  assert.equal(await desk.getByRole('navigation', { name: 'Navegação rápida' }).isVisible(), false)
  await page.context().close()
  await desk.context().close()
})

await step('Automação sem chave da IA coleta estatísticas e grava a forma', async () => {
  // Garante uma partida sem dados (o teste pode rodar mais de uma vez).
  const target = missing ?? fixtures[fixtures.length - 1]
  if (!missing) await admin.from('fixture_data').delete().eq('fixture_id', target.id)
  const missingFx = target
  const env = { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }
  const out = execFileSync('npx', ['tsx', 'scripts/automacao.ts'], { env, encoding: 'utf8' })
  assert.match(out, /Estatísticas coletadas: [1-9]/, out)
  assert.match(out, /Chave da IA ausente/, out)
  const { data: fd } = await admin.from('fixture_data').select('fixture_id').eq('fixture_id', missingFx.id)
  assert.equal(fd.length, 1, 'a partida sem dados deveria ter sido coletada')
  const { data: fx } = await admin.from('fixtures').select('form_home, form_away').eq('id', missingFx.id).single()
  assert.match(fx.form_home ?? '', /^[VED]{1,10}$/)
})

await browser.close()
await admin.auth.admin.deleteUser(userId)
const failed = results.filter((r) => r[0] !== 'ok')
console.log(`\n${results.length - failed.length}/${results.length} cenários de estatísticas passaram`)
process.exit(failed.length ? 1 : 0)
