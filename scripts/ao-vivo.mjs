// Placar ao vivo do GreenGoal (opcional). Roda no GitHub Actions a cada ~15 min
// durante os horários de jogo e atualiza status, minuto e placar das partidas
// da grade que estão acontecendo. Sem dependências (Node 22, fetch nativo).
//
// Gasto de cota por execução: 1 consulta (/fixtures?live=all) + 1 consulta a
// cada 20 partidas que saíram do "ao vivo" desde a última execução.
// Só roda quando app_settings.live_enabled = true (Admin) — e o workflow só
// roda quando a variável do repositório AO_VIVO = on.
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY
// (opcional API_FOOTBALL_BASE_URL para testes).

const SB = process.env.SUPABASE_URL?.replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const AF = process.env.API_FOOTBALL_KEY
const AF_BASE = process.env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io'
if (!SB || !KEY || !AF) {
  console.log('Variáveis ausentes (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY).')
  process.exit(1)
}

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers ?? {}) } })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

async function af(path) {
  const r = await fetch(`${AF_BASE}${path}`, { headers: { 'x-apisports-key': AF }, signal: AbortSignal.timeout(20_000) })
  if (!r.ok) throw new Error(`API-Football ${r.status}`)
  const j = await r.json()
  const errs = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors))
  if (errs?.length) throw new Error(`API-Football: ${errs.join('; ')}`)
  return { list: j.response ?? [], remaining: Number(r.headers.get('x-ratelimit-requests-remaining') ?? NaN) }
}

async function log(status, details) {
  await sb('sync_runs', { method: 'POST', body: JSON.stringify({ kind: 'live', status, details }), headers: { Prefer: 'return=minimal' } }).catch(() => undefined)
}

const row = (f) => ({
  status_short: f.fixture.status.short,
  status_long: f.fixture.status.long,
  elapsed: f.fixture.status.elapsed,
  goals_home: f.goals.home,
  goals_away: f.goals.away,
  ht_home: f.score?.halftime?.home ?? null,
  ht_away: f.score?.halftime?.away ?? null,
  ft_home: f.score?.fulltime?.home ?? null,
  ft_away: f.score?.fulltime?.away ?? null,
  updated_at: new Date().toISOString(),
})

try {
  const [setting] = await sb('app_settings?key=eq.live_enabled&select=value')
  if (!(setting?.value === true || setting?.value === 'true')) {
    console.log('Placar ao vivo desligado no Admin (live_enabled). Nada a fazer.')
    process.exit(0)
  }

  // Partidas da grade que podem estar em andamento: começaram nas últimas 4 h.
  const now = Date.now()
  const from = new Date(now - 4 * 3600_000).toISOString()
  const to = new Date(now + 5 * 60_000).toISOString()
  const ours = await sb(`fixtures?select=id,status_short&kickoff_at=gte.${from}&kickoff_at=lte.${to}`)
  if (!ours.length) {
    console.log('Nenhuma partida da grade em horário de jogo.')
    process.exit(0)
  }
  const ids = new Set(ours.map((f) => f.id))

  const { list, remaining } = await af('/fixtures?live=all')
  let updated = 0
  const seen = new Set()
  for (const f of list) {
    const id = f.fixture?.id
    if (!ids.has(id)) continue
    seen.add(id)
    await sb(`fixtures?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(row(f)), headers: { Prefer: 'return=minimal' } })
    updated++
  }

  // Estavam ao vivo (ou deveriam ter começado) e sumiram da lista: busca o placar final.
  const gone = ours
    .filter((f) => !seen.has(f.id) && (LIVE.has(f.status_short) || f.status_short === 'NS'))
    .map((f) => f.id)
    .slice(0, 40)
  let finished = 0
  for (let i = 0; i < gone.length; i += 20) {
    const chunk = gone.slice(i, i + 20)
    const { list: done } = await af(`/fixtures?ids=${chunk.join('-')}`)
    for (const f of done) {
      if (f.fixture.status.short === 'NS') continue
      await sb(`fixtures?id=eq.${f.fixture.id}`, { method: 'PATCH', body: JSON.stringify(row(f)), headers: { Prefer: 'return=minimal' } })
      finished++
    }
  }

  const message = `${updated} ao vivo, ${finished} atualizada(s) fora do ao vivo`
  console.log(`Placar ao vivo: ${message}. Consultas restantes hoje: ${Number.isFinite(remaining) ? remaining : '?'}`)
  await log('ok', { message, api_remaining: Number.isFinite(remaining) ? remaining : null })
} catch (e) {
  const message = e instanceof Error ? e.message : String(e)
  console.log(`Placar ao vivo falhou: ${message}`)
  await log('error', { message })
  process.exit(1)
}
