// Servidor de TESTE LOCAL que imita a API-Football e a OpenAI.
// Dados fictícios e determinísticos, usados apenas pelos testes de ponta a
// ponta (e2e). Nunca aponte o ambiente de produção para este servidor.
//
// Uso: node e2e/mock-apis.mjs  (porta 4010)
//   API_FOOTBALL_BASE_URL=http://localhost:4010/football
//   OPENAI_BASE_URL=http://localhost:4010/openai/v1
//   ANTHROPIC_BASE_URL=http://localhost:4010/anthropic
import http from 'node:http'

const PORT = Number(process.env.MOCK_PORT ?? 4010)
const calls = []
const asaas = { n: 1, subs: {}, last: null }

const TEAMS = {
  1: 'Palmeiras', 2: 'Flamengo', 3: 'Arsenal', 4: 'Chelsea', 5: 'Botafogo', 6: 'Grêmio', 7: 'Time Fora da Lista', 8: 'Outro Time',
}
const team = (id) => ({ id, name: TEAMS[id], logo: null })

function fixtureFor(id, dateIso, leagueId, home, away, status = 'NS', score = null) {
  return {
    fixture: { id, referee: 'Wilton Pereira Sampaio', timezone: 'America/Sao_Paulo', date: dateIso, venue: { name: 'Estádio Teste' }, status: { short: status, long: status, elapsed: status === 'FT' ? 90 : null } },
    league: { id: leagueId, name: leagueId === 39 ? 'Premier League' : leagueId === 71 ? 'Serie A' : 'Liga Fora', country: leagueId === 39 ? 'England' : 'Brazil', logo: null, season: 2026, round: 'Regular Season - 30' },
    teams: { home: team(home), away: team(away) },
    goals: { home: score?.[0] ?? null, away: score?.[1] ?? null },
    score: { halftime: { home: null, away: null }, fulltime: { home: score?.[0] ?? null, away: score?.[1] ?? null } },
  }
}

// Partidas por data (horário de Brasília): 16:00, 19:30 e 06:00,
// além de uma liga desabilitada que deve ser descartada.
function fixturesOn(date) {
  const n = Number(date.replaceAll('-', '')) % 100000
  const at = (d, utc) => `${d}T${utc}:00+00:00`
  const next = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
  return [
    fixtureFor(n * 10 + 1, at(date, '19:00'), 71, 1, 2, 'FT', [2, 1]),
    fixtureFor(n * 10 + 2, at(date, '22:30'), 39, 3, 4),
    fixtureFor(n * 10 + 3, at(date, '09:00'), 71, 5, 6), // 06:00 em Brasília: pertence ao próprio dia
    fixtureFor(n * 10 + 4, at(date, '20:00'), 9999, 7, 8),
  ].map((f) => f)
    .concat(date === next ? [] : [])
}

const byId = new Map()
function remember(list) {
  for (const f of list) byId.set(f.fixture.id, f)
  return list
}

function lastFixtures(teamId, n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const opp = teamId === 1 ? 5 : 1
    const home = i % 2 === 0
    const gf = (teamId + i) % 3
    const ga = (i * 2 + teamId) % 2
    out.push(fixtureFor(900000 + teamId * 100 + i, new Date(Date.UTC(2026, 9, 20 - i * 4, 20)).toISOString(), 71, home ? teamId : opp, home ? opp : teamId, 'FT', home ? [gf, ga] : [ga, gf]))
  }
  return remember(out)
}

function matchStats(fixtureId) {
  const f = byId.get(fixtureId)
  if (!f) return []
  const s = (t, k) => [
    { type: 'Corner Kicks', value: 3 + ((fixtureId + k) % 5) },
    { type: 'Total Shots', value: 9 + ((fixtureId + k) % 7) },
    { type: 'Shots on Goal', value: 3 + ((fixtureId + k) % 4) },
    { type: 'Fouls', value: 10 + (k % 4) },
    { type: 'Yellow Cards', value: (fixtureId + k) % 3 },
    { type: 'Red Cards', value: null },
    { type: 'Offsides', value: k % 3 },
    { type: 'Ball Possession', value: k ? '45%' : '55%' },
  ]
  return [
    { team: f.teams.home, statistics: s(f.teams.home, 0) },
    { team: f.teams.away, statistics: s(f.teams.away, 1) },
  ]
}

function football(path, q) {
  if (path === '/fixtures' && q.get('date')) return remember(fixturesOn(q.get('date')))
  if (path === '/fixtures' && q.get('ids')) {
    return q.get('ids').split('-').map(Number).map((id) => {
      const f = byId.get(id)
      if (!f) return null
      // Simula a partida já iniciada como encerrada quando consultada por id.
      if (f.fixture.status.short === 'NS' && Date.parse(f.fixture.date) < Date.now()) {
        return { ...f, fixture: { ...f.fixture, status: { short: 'FT', long: 'Match Finished', elapsed: 90 } }, goals: { home: 1, away: 1 }, score: { fulltime: { home: 1, away: 1 } } }
      }
      return f
    }).filter(Boolean)
  }
  if (path === '/fixtures' && q.get('id')) return football('/fixtures', new URLSearchParams({ ids: q.get('id') }))
  if (path === '/fixtures' && q.get('team')) return lastFixtures(Number(q.get('team')), Number(q.get('last') ?? 10))
  if (path === '/fixtures/headtohead') {
    const [a, b] = q.get('h2h').split('-').map(Number)
    return remember([0, 1, 2, 3, 4, 5].map((i) => fixtureFor(800000 + i, new Date(Date.UTC(2025, 8 - i, 10, 20)).toISOString(), 71, i % 2 ? b : a, i % 2 ? a : b, 'FT', [i % 3, (i + 1) % 2])))
  }
  if (path === '/fixtures/statistics') return matchStats(Number(q.get('fixture')))
  if (path === '/predictions') return [{ predictions: { percent: { home: '45%', draw: '30%', away: '25%' }, advice: 'Double chance : home or draw' }, comparison: { att: { home: '60%', away: '40%' } } }]
  if (path === '/teams/statistics') {
    return { form: 'WWDLW', fixtures: { played: { home: 8, away: 7, total: 15 }, wins: { home: 5, away: 3, total: 8 }, draws: { home: 2, away: 2, total: 4 }, loses: { home: 1, away: 2, total: 3 } }, goals: { for: { average: { home: '1.8', away: '1.1', total: '1.5' } }, against: { average: { home: '0.9', away: '1.3', total: '1.1' } } }, clean_sheet: { total: 5 }, failed_to_score: { total: 3 }, cards: { yellow: { '0-15': { total: 4 }, '16-30': { total: 6 } }, red: {} }, lineups: [{ formation: '4-3-3', played: 12 }] }
  }
  if (path === '/injuries') return [{ player: { id: 1, name: 'Jogador Lesionado', type: 'Missing Fixture', reason: 'Knee Injury' }, team: team(2) }]
  if (path === '/odds') return [{ bookmakers: [{ id: 8, name: 'Bet365', bets: [{ id: 1, name: 'Match Winner', values: [{ value: 'Home', odd: '2.10' }, { value: 'Draw', odd: '3.30' }, { value: 'Away', odd: '3.60' }] }, { id: 5, name: 'Goals Over/Under', values: [{ value: 'Over 1.5', odd: '1.30' }, { value: 'Under 1.5', odd: '3.40' }, { value: 'Over 2.5', odd: '1.95' }, { value: 'Under 2.5', odd: '1.85' }] }, { id: 8, name: 'Both Teams Score', values: [{ value: 'Yes', odd: '1.80' }, { value: 'No', odd: '2.00' }] }] }] }]
  if (path === '/standings') return [{ league: { standings: [[1, 2, 3, 4, 5, 6].map((id, i) => ({ rank: i + 1, team: team(id), points: 60 - i * 4, goalsDiff: 20 - i * 3, all: { played: 30 }, description: i === 0 ? 'Promotion - Libertadores' : null }))] } }]
  if (path === '/players') {
    const teamId = Number(q.get('team'))
    return [1, 2, 3, 4].map((k) => ({ player: { id: teamId * 10 + k, name: `Atacante ${TEAMS[teamId]} ${k}` }, statistics: [{ team: team(teamId), league: { id: null, season: 2026 }, games: { appearences: 12, minutes: 900, position: 'Attacker' }, shots: { total: 40 - k * 6, on: 18 - k * 3 }, goals: { total: 6 - k } }] }))
  }
  if (path === '/leagues') {
    const id = Number(q.get('id'))
    return id === 404 ? [] : [{ league: { id, name: `League ${id}`, logo: null }, country: { name: 'World' } }]
  }
  return []
}

function ticketsAnswer(user) {
  const ps = user.partidas
  const sel = (p, mercado, codigo, prob) => ({ fixture_id: p.fixture_id, mercado, codigo, probabilidade_estimada: prob, justificativa: `Base: ${p.resumo}` })
  const content = {
    bilhetes: [
      { titulo: 'Bilhete conservador', risco: 'baixo', resumo: 'Seleções de maior probabilidade. Lucro garantido.', selecoes: ps.slice(0, 2).map((p) => sel(p, 'Mais de 1.5 gols', 'mais_1_5', 70)) },
      { titulo: 'Bilhete equilibrado', risco: 'medio', resumo: 'Mistura resultado e gols.', selecoes: [sel(ps[0], 'Vitória do mandante', 'casa', 48), ...(ps[1] ? [sel(ps[1], 'Ambos marcam', 'ambos_sim', 55)] : []), { fixture_id: 999999, mercado: 'Inventado', codigo: 'casa', probabilidade_estimada: 90, justificativa: 'x' }] },
    ],
    observacoes: ['Escalações não confirmadas.'],
  }
  return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }], usage: { total_tokens: 2000 } }
}

function openai(body) {
  const user = JSON.parse(body.messages[1].content)
  if (user.partidas) return ticketsAnswer(user)
  const d = user.dados
  const s = user.suporte_por_secao
  const txt = (ok, t) => (ok ? t : null)
  const content = {
    secoes: {
      importancia: txt(s.importancia, `${d.partida.mandante} ocupa a ${d.classificacao.mandante?.posicao ?? '?'}ª posição. Jogo da ${d.partida.rodada}.`),
      confrontos: txt(s.confrontos, `Nos últimos ${d.confrontos_diretos.resumo?.matches} confrontos, o mandante venceu ${d.confrontos_diretos.resumo?.record.v}.`),
      forma: txt(s.forma, `O mandante soma ${d.forma_recente.mandante?.record.v} vitórias em ${d.forma_recente.mandante?.matches} jogos.`),
      probabilidade: txt(s.probabilidade, `O modelo da API aponta ${d.previsao_api_football?.percentuais?.casa}% para o mandante. Isso não é garantia.`),
      gols: txt(s.gols, `Média de ${d.forma_recente.mandante?.totalGoalsAvg} gols por jogo nos jogos do mandante.`),
      escanteios: txt(s.escanteios, `O mandante tem média de ${d.estatisticas_por_jogo.mandante?.avg.cornersFor} escanteios a favor.`),
      cartoes: txt(s.cartoes, `Média de ${d.estatisticas_por_jogo.mandante?.avg.yellow} amarelos do mandante.`),
      arbitro: txt(s.arbitro, `Árbitro: ${d.partida.arbitro}. Não há histórico do árbitro nos dados.`),
      finalizacoes: txt(s.finalizacoes, `${d.finalizadores_temporada.mandante[0]?.name} tem ${d.finalizadores_temporada.mandante[0]?.shotsPerGame} finalizações por jogo.`),
    },
    destaques: [{ mercado: 'Mais de 1.5 gols', leitura: 'Frequência alta na amostra recente. Lucro garantido nesta linha.', probabilidade_estimada: 68, frequencia_observada: `${d.forma_recente.mandante?.over['1.5']} de ${d.forma_recente.mandante?.matches} jogos`, risco: 'baixo', a_favor: 'Ataque regular.', contra: 'Amostra curta.' }],
    alertas: ['Escalações não confirmadas.'],
    resumo: 'Partida equilibrada pelos números disponíveis.',
    confianca_dados: 'media',
  }
  return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }], usage: { total_tokens: 1234 } }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try {
        handle()
      } catch (e) {
        console.error(e)
        res.statusCode = 500
        res.end(JSON.stringify({ error: String(e) }))
      }
    })
    const handle = () => {
      res.setHeader('content-type', 'application/json')
      if (url.pathname === '/__calls') return res.end(JSON.stringify(calls))
      if (url.pathname.startsWith('/football')) {
        if (!req.headers['x-apisports-key']) return res.end(JSON.stringify({ errors: { token: 'missing key' }, response: [] }))
        const path = url.pathname.replace('/football', '')
        // MOCK_FREE_PLAN=1 imita o plano Free: sem os parâmetros ids e last.
        const blocked = process.env.MOCK_FREE_PLAN === '1' && ['ids', 'last'].find((p) => url.searchParams.has(p))
        if (blocked) {
          calls.push('bloqueado:' + blocked)
          return res.end(JSON.stringify({ errors: { plan: `Free plans do not have access to the ${blocked[0].toUpperCase() + blocked.slice(1)} parameter.` }, response: [] }))
        }
        calls.push(path + url.search)
        res.setHeader('x-ratelimit-requests-remaining', String(7500 - calls.length))
        return res.end(JSON.stringify({ errors: [], response: football(path, url.searchParams) }))
      }
      if (url.pathname.startsWith('/asaas/v3')) {
        // Imita a API do Asaas (clientes, assinaturas e cobranças).
        if (!req.headers['access_token']) {
          res.statusCode = 401
          return res.end(JSON.stringify({ errors: [{ description: 'token ausente' }] }))
        }
        const path = url.pathname.replace('/asaas/v3', '')
        const data = body ? JSON.parse(body) : {}
        calls.push(`asaas:${req.method} ${path}`)
        if (req.method === 'POST' && path === '/customers') {
          if (!data.cpfCnpj) {
            res.statusCode = 400
            return res.end(JSON.stringify({ errors: [{ description: 'CPF/CNPJ obrigatório' }] }))
          }
          return res.end(JSON.stringify({ id: 'cus_' + (asaas.n++) }))
        }
        if (req.method === 'POST' && path === '/subscriptions') {
          const id = 'sub_' + (asaas.n++)
          const pay = { id: 'pay_' + (asaas.n++), customer: data.customer, subscription: id, value: data.value, billingType: data.billingType, status: 'PENDING', dueDate: data.nextDueDate, invoiceUrl: `http://localhost:${PORT}/fatura/${id}` }
          asaas.subs[id] = { ...data, id, payments: [pay] }
          asaas.last = pay
          return res.end(JSON.stringify({ id }))
        }
        const m = path.match(/^\/subscriptions\/([^/]+)(\/payments)?$/)
        if (m && req.method === 'GET' && m[2]) return res.end(JSON.stringify({ data: asaas.subs[m[1]]?.payments ?? [] }))
        if (m && req.method === 'DELETE') {
          if (asaas.subs[m[1]]) asaas.subs[m[1]].deleted = true
          return res.end(JSON.stringify({ deleted: true, id: m[1] }))
        }
        res.statusCode = 404
        return res.end('{}')
      }
      if (url.pathname === '/__asaas') return res.end(JSON.stringify(asaas))
      if (url.pathname.startsWith('/fatura/')) {
        res.setHeader('content-type', 'text/html; charset=utf-8')
        return res.end('<html><body><h1>Fatura Asaas (simulada)</h1></body></html>')
      }
      if (url.pathname === '/anthropic/v1/messages') {
        // Imita a Messages API da Anthropic (Claude) com saída estruturada.
        const req = JSON.parse(body)
        calls.push('anthropic')
        const ok = req.output_config?.format?.type === 'json_schema' && !JSON.stringify(req.output_config.format.schema).includes('"type":["')
        if (!req.model || !req.system || !ok) {
          res.statusCode = 400
          return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'pedido fora do formato esperado' } }))
        }
        const text = openai({ messages: [{ content: req.system }, req.messages[0]] }).choices[0].message.content
        return res.end(JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: req.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 6000, output_tokens: 1500 } }))
      }
      if (url.pathname === '/openai/v1/chat/completions') {
        calls.push('openai')
        return res.end(JSON.stringify(openai(JSON.parse(body))))
      }
      res.statusCode = 404
      res.end('{}')
    }
  })
  .listen(PORT, () => console.log(`mock em http://localhost:${PORT}`))
