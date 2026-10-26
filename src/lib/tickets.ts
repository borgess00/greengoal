// Conferência de bilhete: leitura do texto, busca das partidas e comparação
// do palpite com o placar do tempo regulamentar. Código puro (sem I/O),
// usado pelo servidor e coberto por testes.

import { FINISHED, VOID } from './fixture-status'

export const TICKET_MIN_CHARS = 3
export const TICKET_MAX_CHARS = 3000
export const TICKET_MAX_LINES = 30

export type Pick =
  | { kind: 'home' }
  | { kind: 'draw' }
  | { kind: 'away' }
  | { kind: 'double'; options: Array<'home' | 'draw' | 'away'> }
  | { kind: 'over'; line: number }
  | { kind: 'under'; line: number }
  | { kind: 'btts'; yes: boolean }

export type Outcome = 'won' | 'lost' | 'open' | 'not_found' | 'invalid'

export const OUTCOME_LABELS: Record<Outcome, string> = {
  won: 'Acertou',
  lost: 'Errou',
  open: 'Em aberto',
  not_found: 'Não encontrado',
  invalid: 'Formato inválido',
}

export interface ParsedLine {
  line: number
  raw: string
  teamA?: string
  teamB?: string
  pickText?: string
  pick?: Pick
  error?: string
}

export interface TicketFixture {
  id: number
  kickoff_at: string
  league_name: string
  home_team_name: string
  away_team_name: string
  status_short: string
  goals_home: number | null
  goals_away: number | null
  ft_home: number | null
  ft_away: number | null
}

export interface TicketResult {
  line: number
  raw: string
  outcome: Outcome
  pickLabel?: string
  detail?: string
  fixture?: {
    id: number
    kickoff_at: string
    league_name: string
    home: string
    away: string
    status: string
    score: string | null
  }
}

// ---------------------------------------------------------------------
// Normalização de nomes
// ---------------------------------------------------------------------

const STOP_TOKENS = new Set([
  'fc', 'cf', 'sc', 'ec', 'ac', 'afc', 'cd', 'ca', 'se', 'cr', 'club', 'clube', 'de', 'do', 'da', 'del',
  'the', 'esporte', 'futebol', 'football', 'calcio', 'sad', 'ss', 'us', 'as', 'rc', 'sv', 'fk', 'sk', 'bk',
])

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  const all = normalizeName(s).split(' ').filter(Boolean)
  const meaningful = all.filter((t) => !STOP_TOKENS.has(t))
  return meaningful.length ? meaningful : all
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const t = s.replace(/ /g, '')
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

function dice(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const A = bigrams(a)
  const B = bigrams(b)
  let inter = 0
  let total = 0
  for (const v of A.values()) total += v
  for (const v of B.values()) total += v
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0)
  return total ? (2 * inter) / total : 0
}

/** Similaridade entre o nome digitado e o nome oficial (0 a 1). */
export function teamSimilarity(typed: string, official: string): number {
  const a = tokens(typed).join(' ')
  const b = tokens(official).join(' ')
  if (!a || !b) return 0
  if (a === b) return 1
  // Todos os termos digitados aparecem no nome oficial (ex.: "Man City" x "Manchester City" não,
  // mas "Atletico Mineiro" x "Atletico-MG Mineiro" sim).
  const ta = a.split(' ')
  const tb = b.split(' ')
  const contained = ta.every((t) => tb.some((u) => u === t || (t.length >= 4 && u.startsWith(t))))
  if (contained) return 0.92
  const reverse = tb.every((t) => ta.some((u) => u === t || (t.length >= 4 && u.startsWith(t))))
  if (reverse) return 0.88
  return dice(a, b)
}

// ---------------------------------------------------------------------
// Leitura do texto
// ---------------------------------------------------------------------

const LINE_RE = /^(.+?)\s+(?:x|vs\.?|versus|×)\s+(.+?)\s*(?:-|–|—|:|\|)\s*(.+)$/i
const VALID_LINES = new Set([0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5])

export function parsePick(text: string): Pick | null {
  const t = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.+\- ]+/g, ' ')
    .replace(/(\d)\.(?!\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  const compact = t.replace(/\s+/g, '')

  if (/^(casa|1|mandante|vitoria (do )?mandante|vitoria casa)$/.test(t)) return { kind: 'home' }
  if (/^(empate|x)$/.test(t)) return { kind: 'draw' }
  if (/^(fora|2|visitante|vitoria (do )?visitante|vitoria fora)$/.test(t)) return { kind: 'away' }

  if (compact === '1x' || compact === 'x1') return { kind: 'double', options: ['home', 'draw'] }
  if (compact === 'x2' || compact === '2x') return { kind: 'double', options: ['draw', 'away'] }
  if (compact === '12' || compact === '21') return { kind: 'double', options: ['home', 'away'] }

  const ou = t.match(/^(mais de|acima de|over|\+|menos de|abaixo de|under|-)\s*(\d+(?:\.\d+)?)\s*(gols?)?$/)
  if (ou) {
    const line = Number(ou[2])
    const over = /^(mais de|acima de|over|\+)$/.test(ou[1])
    if (!VALID_LINES.has(line)) return null
    return over ? { kind: 'over', line } : { kind: 'under', line }
  }
  // Variante "over2.5" / "+2.5" sem espaço já coberta acima; "o2.5"/"u2.5":
  const short = compact.match(/^([ou])(\d+\.\d)(gols?)?$/)
  if (short) {
    const line = Number(short[2])
    if (!VALID_LINES.has(line)) return null
    return short[1] === 'o' ? { kind: 'over', line } : { kind: 'under', line }
  }

  if (/^(ambos|ambas)( (as )?(equipes|times))? (nao marcam|nao marcar)$/.test(t) || /^(btts|ambos marcam|ambas marcam) (nao|no)$/.test(t))
    return { kind: 'btts', yes: false }
  if (/^(ambos|ambas)( (as )?(equipes|times))? marcam( sim)?$/.test(t) || /^btts( sim| yes)?$/.test(t))
    return { kind: 'btts', yes: true }

  return null
}

export function pickLabel(pick: Pick, teamA?: string, teamB?: string): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
  switch (pick.kind) {
    case 'home':
      return teamA ? `Vitória ${teamA}` : 'Casa'
    case 'draw':
      return 'Empate'
    case 'away':
      return teamB ? `Vitória ${teamB}` : 'Fora'
    case 'double': {
      const k = pick.options.map((o) => (o === 'home' ? '1' : o === 'draw' ? 'X' : '2')).join('')
      return `Dupla chance ${k}`
    }
    case 'over':
      return `Mais de ${fmt(pick.line)} gols`
    case 'under':
      return `Menos de ${fmt(pick.line)} gols`
    case 'btts':
      return pick.yes ? 'Ambos marcam' : 'Ambos não marcam'
  }
}

export function parseTicket(input: string): { lines: ParsedLine[]; truncated: number } {
  const rows = input
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
  const limited = rows.slice(0, TICKET_MAX_LINES)
  const lines = limited.map<ParsedLine>((raw, i) => {
    const m = raw.replace(/^\d+[.)]\s*/, '').match(LINE_RE)
    if (!m) return { line: i + 1, raw, error: 'Use o formato: Time A x Time B - palpite' }
    const [, teamA, teamB, pickText] = m
    const pick = parsePick(pickText)
    if (!pick) return { line: i + 1, raw, teamA: teamA.trim(), teamB: teamB.trim(), pickText, error: `Palpite não reconhecido: “${pickText.trim()}”` }
    return { line: i + 1, raw, teamA: teamA.trim(), teamB: teamB.trim(), pickText, pick }
  })
  return { lines, truncated: Math.max(0, rows.length - limited.length) }
}

// ---------------------------------------------------------------------
// Busca da partida
// ---------------------------------------------------------------------

export const MATCH_THRESHOLD = 0.62

export interface FixtureMatch {
  fixture: TicketFixture
  swapped: boolean
  score: number
}

export function findFixture(teamA: string, teamB: string, fixtures: TicketFixture[], now: Date = new Date()): FixtureMatch | null {
  let best: FixtureMatch | null = null
  for (const f of fixtures) {
    const direct = Math.min(teamSimilarity(teamA, f.home_team_name), teamSimilarity(teamB, f.away_team_name))
    const swapped = Math.min(teamSimilarity(teamA, f.away_team_name), teamSimilarity(teamB, f.home_team_name))
    const isSwapped = swapped > direct
    const score = Math.max(direct, swapped)
    if (score < MATCH_THRESHOLD) continue
    if (
      !best ||
      score > best.score + 0.001 ||
      (Math.abs(score - best.score) <= 0.001 &&
        Math.abs(Date.parse(f.kickoff_at) - now.getTime()) < Math.abs(Date.parse(best.fixture.kickoff_at) - now.getTime()))
    ) {
      best = { fixture: f, swapped: isSwapped, score }
    }
  }
  return best
}

// ---------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------

/** Converte o palpite escrito como "Time A x Time B" para o mando real da partida. */
export function alignPick(pick: Pick, swapped: boolean): Pick {
  if (!swapped) return pick
  const flip = (o: 'home' | 'draw' | 'away') => (o === 'home' ? 'away' : o === 'away' ? 'home' : 'draw')
  switch (pick.kind) {
    case 'home':
      return { kind: 'away' }
    case 'away':
      return { kind: 'home' }
    case 'double':
      return { kind: 'double', options: pick.options.map(flip) }
    default:
      return pick
  }
}

export function evaluatePick(pick: Pick, home: number, away: number): boolean {
  const total = home + away
  const result: 'home' | 'draw' | 'away' = home > away ? 'home' : home < away ? 'away' : 'draw'
  switch (pick.kind) {
    case 'home':
    case 'draw':
    case 'away':
      return result === pick.kind
    case 'double':
      return pick.options.includes(result)
    case 'over':
      return total > pick.line
    case 'under':
      return total < pick.line
    case 'btts':
      return pick.yes ? home > 0 && away > 0 : !(home > 0 && away > 0)
  }
}

/** Placar do tempo regulamentar (90 min), base usual dos mercados conferidos. */
export function regulationScore(f: TicketFixture): { home: number; away: number } | null {
  if (f.ft_home != null && f.ft_away != null) return { home: f.ft_home, away: f.ft_away }
  if (f.status_short === 'FT' && f.goals_home != null && f.goals_away != null) return { home: f.goals_home, away: f.goals_away }
  return null
}

export function checkTicket(input: string, fixtures: TicketFixture[], now: Date = new Date()) {
  const { lines, truncated } = parseTicket(input)
  const results: TicketResult[] = lines.map((l) => {
    if (!l.pick || !l.teamA || !l.teamB) return { line: l.line, raw: l.raw, outcome: 'invalid', detail: l.error }
    const label = pickLabel(l.pick, l.teamA, l.teamB)
    const match = findFixture(l.teamA, l.teamB, fixtures, now)
    if (!match) {
      return { line: l.line, raw: l.raw, outcome: 'not_found', pickLabel: label, detail: 'Partida não localizada entre os jogos armazenados dos últimos dez dias.' }
    }
    const f = match.fixture
    const score = regulationScore(f)
    const fixture = {
      id: f.id,
      kickoff_at: f.kickoff_at,
      league_name: f.league_name,
      home: f.home_team_name,
      away: f.away_team_name,
      status: f.status_short,
      score: score ? `${score.home} x ${score.away}` : f.goals_home != null && f.goals_away != null ? `${f.goals_home} x ${f.goals_away}` : null,
    }
    if (VOID.has(f.status_short)) {
      return { line: l.line, raw: l.raw, outcome: 'open', pickLabel: label, fixture, detail: 'Partida adiada, cancelada ou interrompida.' }
    }
    if (!FINISHED.has(f.status_short) || !score) {
      return { line: l.line, raw: l.raw, outcome: 'open', pickLabel: label, fixture, detail: 'Partida ainda não encerrada.' }
    }
    const won = evaluatePick(alignPick(l.pick, match.swapped), score.home, score.away)
    return {
      line: l.line,
      raw: l.raw,
      outcome: won ? 'won' : 'lost',
      pickLabel: label,
      fixture,
      detail: f.status_short !== 'FT' ? 'Conferido pelo placar do tempo regulamentar.' : undefined,
    }
  })
  const summary = summarize(results)
  return { results, truncated, summary }
}

export function summarize(results: TicketResult[]) {
  const s: Record<Outcome, number> = { won: 0, lost: 0, open: 0, not_found: 0, invalid: 0 }
  for (const r of results) s[r.outcome]++
  return { ...s, total: results.length }
}
