// Testes de ponta a ponta das novidades: páginas de time e campeonato,
// comparador, histórico público, jogo quente, bilhete em imagem, aba
// Notificações, painel de negócio do Admin e script do placar ao vivo.
// Rodar depois de e2e/run.mjs e e2e/painel-bilhetes.mjs, contra o mesmo
// Supabase local + mock (ver e2e/README.md).
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
const FREE = `novo-gratis+${Date.now()}@example.com`
const PRO = `novo-pro+${Date.now()}@example.com`

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

// Automação sem IA: coleta estatísticas, resultados e classificações.
execFileSync('npx', ['tsx', 'scripts/automacao.ts'], { env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }, encoding: 'utf8' })
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - 86400_000))
const { data: todays } = await admin.from('fixtures').select('*').eq('grade_date', today).order('id')
const finished = todays.find((f) => f.status_short === 'FT')
const upcoming = todays.filter((f) => f.status_short !== 'FT')
for (const [i, f] of upcoming.entries()) {
  const t = new Date(Date.now() + (2 + i) * 3600_000)
  await admin.from('fixtures').update({ kickoff_at: t.toISOString(), status_short: 'NS', goals_home: null, goals_away: null }).eq('id', f.id)
}
assert.ok(finished && upcoming.length, 'esperava partidas encerradas e por jogar hoje (rode e2e/run.mjs antes)')
const game = upcoming[0]

const users = {}
for (const email of [FREE, PRO]) {
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Teste Novidades' } })
  users[email] = data.user.id
}
await admin.rpc('demo_checkout', { _user_id: users[PRO], _plan_id: 'monthly', _method: 'pix' })

const browser = await chromium.launch()
async function newPage({ viewport = { width: 1366, height: 900 } } = {}) {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport, acceptDownloads: true })
  await ctx.addInitScript(() => localStorage.setItem('greengoal:age-confirmed', 'yes'))
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

await step('Página do time: forma, próximos jogos e números Pro bloqueados para visitante', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/time/${game.home_team_id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { level: 1, name: game.home_team_name }).waitFor({ timeout: 20000 })
  await page.getByRole('heading', { name: 'Próximos jogos' }).waitFor()
  await page.getByText(/ficam no GreenGoal Pro/).waitFor()
  await page.getByRole('radio', { name: 'Últimos 5' }).click()
  await page.getByRole('heading', { name: /Médias dos últimos \d+ jogos/ }).waitFor()
  await page.screenshot({ path: `${SHOTS}/time.png`, fullPage: true })
  await page.context().close()
})

await step('Página do campeonato: classificação coletada e link para o time', async () => {
  const page = await newPage()
  await page.goto(`${BASE}/campeonato/${game.league_id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: 'Classificação' }).waitFor({ timeout: 20000 })
  const rows = page.locator('table tbody tr')
  assert.ok((await rows.count()) >= 2, 'esperava a tabela de classificação')
  await page.screenshot({ path: `${SHOTS}/campeonato.png`, fullPage: true })
  await rows.first().getByRole('link').click()
  await page.waitForURL(/\/time\/\d+/)
  await page.context().close()
})

await step('Comparar times: assinante busca dois times e vê o painel completo', async () => {
  const page = await newPage()
  await login(page, PRO)
  await page.goto(`${BASE}/comparar`)
  await page.waitForLoadState('networkidle')
  for (const [label, name] of [
    ['Primeiro time', game.home_team_name],
    ['Segundo time', finished.home_team_name],
  ]) {
    await page.getByLabel(label).fill(name.slice(0, 5))
    await page.getByRole('button', { name: new RegExp(name) }).first().click()
  }
  await page.waitForURL(/a=\d+.*b=\d+/)
  await page.getByText(/Gols/).first().waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${SHOTS}/comparar.png`, fullPage: true })
  await page.context().close()
})

await step('Histórico público: bilhetes de ontem conferidos pelo placar', async () => {
  const sel = (codigo, mercado) => ({
    fixture_id: finished.id,
    jogo: `${finished.home_team_name} x ${finished.away_team_name}`,
    liga: finished.league_name,
    horario: finished.local_time,
    kickoff_at: finished.kickoff_at,
    mercado,
    codigo,
    probabilidade_estimada: 70,
    odd: 1.5,
    probabilidade_implicita: 66.7,
    casa_de_apostas: 'Bet365',
    justificativa: 'Teste.',
  })
  const ticket = (titulo, s) => ({ titulo, faixa: 'baixa', resumo: 'Teste', selecoes: [s], odd_total: 1.5, probabilidade_combinada: 70 })
  await admin.from('daily_tickets').upsert({
    grade_date: yesterday,
    status: 'done',
    content: { date: yesterday, bilhetes: [ticket('Bilhete que bate', sel('mais_0_5', 'Mais de 0,5 gols')), ticket('Bilhete que não bate', sel('menos_1_5', 'Menos de 1,5 gols'))], observacoes: [], model: 'teste', generated_at: new Date().toISOString(), fixtures_considered: 1 },
  })
  const page = await newPage()
  await page.goto(`${BASE}/historico`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Taxa de acerto').waitFor({ timeout: 20000 })
  await page.getByText('Bilhete que bate').waitFor()
  await page.getByText('Ganho', { exact: true }).first().waitFor()
  await page.getByText('Perdido', { exact: true }).first().waitFor()
  await page.screenshot({ path: `${SHOTS}/historico.png`, fullPage: true })
  await page.context().close()
})

await step('Jogo quente aparece na partida', async () => {
  await admin.from('fixtures').update({ hot_markets: 4 }).eq('id', game.id)
  const page = await newPage()
  await page.goto(`${BASE}/jogo/${game.id}`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Jogo quente').first().waitFor({ timeout: 20000 })
  await page.context().close()
})

await step('Bilhete em imagem: Meus bilhetes gera o PNG', async () => {
  await admin.from('user_slips').insert({ user_id: users[PRO], title: 'Bilhete da imagem', selections: [{ fixture_id: game.id, market: 'mais_1_5', odd: 1.4 }], odd_total: 1.4 })
  const page = await newPage()
  await login(page, PRO)
  await page.goto(`${BASE}/meus-bilhetes`)
  await page.waitForLoadState('networkidle')
  const card = page.locator('article', { hasText: 'Bilhete da imagem' })
  await card.waitFor({ timeout: 20000 })
  await page.evaluate(() => {
    // Sem compartilhar nativo no navegador de teste: cai no download.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), card.getByRole('button', { name: 'Compartilhar bilhete como imagem' }).click()])
  const path = `${SHOTS}/bilhete-imagem.png`
  await dl.saveAs(path)
  const buf = fs.readFileSync(path)
  assert.equal(buf.subarray(1, 4).toString(), 'PNG')
  assert.equal(buf.readUInt32BE(16), 1080)
  const h = buf.readUInt32BE(20)
  assert.ok(h >= 1080 && h <= 1350, `altura inesperada: ${h}`)
  await page.context().close()
})

await step('Minha conta › Notificações: desligar e-mails grava no banco', async () => {
  const page = await newPage()
  await login(page, FREE)
  await page.goto(`${BASE}/perfil?aba=notificacoes`)
  await page.waitForLoadState('networkidle')
  const sw = page.getByRole('switch', { name: 'Receber e-mails do GreenGoal' })
  await sw.waitFor({ timeout: 20000 })
  assert.equal(await sw.getAttribute('aria-checked'), 'true')
  await sw.click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Receber e-mails do GreenGoal"]')?.getAttribute('aria-checked') === 'false')
  await page.getByRole('switch', { name: 'Jogos dos times favoritos' }).click()
  await page.waitForTimeout(800)
  const { data } = await admin.from('profiles').select('email_opt_out, notify_prefs').eq('id', users[FREE]).single()
  assert.equal(data.email_opt_out, true)
  assert.equal(data.notify_prefs.favoritos, false)
  await page.getByText('App no celular').waitFor()
  await page.screenshot({ path: `${SHOTS}/notificacoes.png`, fullPage: true })
  await page.context().close()
})

await step('Admin › Negócio: números, automações e gerador das chaves', async () => {
  const page = await newPage()
  await login(page, 'contato.greengoal@gmail.com')
  await page.goto(`${BASE}/admin`)
  await page.waitForLoadState('networkidle')
  await page.getByText('Assinantes ativos').waitFor({ timeout: 20000 })
  await page.getByRole('heading', { name: 'Cadastros por dia' }).waitFor()
  await page.getByRole('button', { name: 'Gerar chaves' }).click()
  const pub = await page.locator('input[readonly]').first().inputValue()
  assert.ok(/^[A-Za-z0-9_-]{80,90}$/.test(pub), `chave pública inesperada: ${pub}`)
  await page.screenshot({ path: `${SHOTS}/admin-negocio.png`, fullPage: true })
  await page.getByRole('tab', { name: /Coleta/ }).click()
  await page.getByText('Avisos e placar ao vivo').waitFor()
  await page.context().close()
})

await step('Placar ao vivo: desligado não faz nada; ligado atualiza status e placar', async () => {
  const env = { ...process.env, API_FOOTBALL_BASE_URL: process.env.API_FOOTBALL_BASE_URL }
  await admin.from('app_settings').upsert({ key: 'live_enabled', value: false })
  const off = execFileSync('node', ['scripts/ao-vivo.mjs'], { env, encoding: 'utf8' })
  assert.match(off, /desligado/)
  await admin.from('app_settings').upsert({ key: 'live_enabled', value: true })
  // Partida que o site acha que está no 2º tempo, mas já terminou na fonte.
  const liveFx = finished
  await admin.from('fixtures').update({ kickoff_at: new Date(Date.now() - 100 * 60_000).toISOString(), status_short: '2H' }).eq('id', liveFx.id)
  const on = execFileSync('node', ['scripts/ao-vivo.mjs'], { env, encoding: 'utf8' })
  assert.match(on, /Placar ao vivo:/)
  const { data: lf } = await admin.from('fixtures').select('status_short').eq('id', liveFx.id).single()
  assert.equal(lf.status_short, 'FT', `esperava a partida encerrada, ficou ${lf.status_short}`)
  const { data: run } = await admin.from('sync_runs').select('status').eq('kind', 'live').order('created_at', { ascending: false }).limit(1).single()
  assert.equal(run.status, 'ok')
  await admin.from('app_settings').upsert({ key: 'live_enabled', value: false })
})

await step('Avisos: chaves VAPID, layout dos e-mails e Discord sem repetir', async () => {
  const out = execFileSync('npx', ['tsx', 'e2e/notify-check.ts'], { env: process.env, encoding: 'utf8' })
  assert.match(out, /Discord publicado/)
})

await browser.close()
const ok = results.filter((r) => r[0] === 'ok').length
console.log(`\n${ok}/${results.length} cenários das novidades passaram`)
process.exit(ok === results.length ? 0 : 1)
