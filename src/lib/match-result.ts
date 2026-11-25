// Estatísticas finais e eventos (gols, cartões) das partidas encerradas, já
// traduzidos e agrupados para exibição. Código puro.

import type { ApiFixtureTeamStatistics } from './api-football-types'

export interface ApiEvent {
  time: { elapsed: number | null; extra?: number | null }
  team: { id: number; name?: string }
  player?: { id?: number | null; name?: string | null } | null
  assist?: { id?: number | null; name?: string | null } | null
  type: string // Goal | Card | subst | Var
  detail?: string | null // Normal Goal | Penalty | Own Goal | Missed Penalty | Yellow Card | Red Card ...
}

export interface StatLine {
  label: string
  home: number | null
  away: number | null
  suffix?: string
}

export interface StatGroup {
  title: string
  lines: StatLine[]
}

const GROUPS: Array<{ title: string; items: Array<{ type: string; label: string; suffix?: string }> }> = [
  {
    title: 'Finalizações',
    items: [
      { type: 'Total Shots', label: 'Finalizações' },
      { type: 'Shots on Goal', label: 'No alvo' },
      { type: 'Shots off Goal', label: 'Para fora' },
      { type: 'Blocked Shots', label: 'Bloqueadas' },
      { type: 'Shots insidebox', label: 'Dentro da área' },
      { type: 'Shots outsidebox', label: 'Fora da área' },
      { type: 'expected_goals', label: 'Gols esperados (xG)' },
    ],
  },
  {
    title: 'Jogo',
    items: [
      { type: 'Ball Possession', label: 'Posse de bola', suffix: '%' },
      { type: 'Corner Kicks', label: 'Escanteios' },
      { type: 'Offsides', label: 'Impedimentos' },
      { type: 'Fouls', label: 'Faltas' },
      { type: 'Yellow Cards', label: 'Cartões amarelos' },
      { type: 'Red Cards', label: 'Cartões vermelhos' },
      { type: 'Goalkeeper Saves', label: 'Defesas do goleiro' },
      { type: 'Total passes', label: 'Passes' },
      { type: 'Passes %', label: 'Precisão dos passes', suffix: '%' },
    ],
  },
]

// Contagens que a fonte manda como null quando são zero.
const ZERO_WHEN_NULL = new Set(['Corner Kicks', 'Offsides', 'Fouls', 'Yellow Cards', 'Red Cards', 'Goalkeeper Saves', 'Blocked Shots', 'Shots off Goal'])

function value(entry: ApiFixtureTeamStatistics | undefined, type: string): number | null {
  const s = entry?.statistics.find((x) => x.type === type)
  if (!s) return null
  if (s.value == null) return ZERO_WHEN_NULL.has(type) ? 0 : null
  const n = typeof s.value === 'number' ? s.value : Number(String(s.value).replace('%', ''))
  return Number.isFinite(n) ? n : null
}

export function statGroups(stats: ApiFixtureTeamStatistics[] | null | undefined, homeId: number, awayId: number): StatGroup[] {
  const home = stats?.find((s) => s.team.id === homeId)
  const away = stats?.find((s) => s.team.id === awayId)
  if (!home || !away) return []
  return GROUPS.map((g) => ({
    title: g.title,
    lines: g.items
      .map((i) => ({ label: i.label, home: value(home, i.type), away: value(away, i.type), suffix: i.suffix }))
      .filter((l) => l.home != null || l.away != null),
  })).filter((g) => g.lines.length)
}

export interface MatchEvent {
  minute: string // "62'" ou "90+3'"
  side: 'home' | 'away'
  kind: 'goal' | 'own_goal' | 'penalty' | 'missed_penalty' | 'yellow' | 'red'
  player: string
  assist: string | null
}

export function matchEvents(events: ApiEvent[] | null | undefined, homeId: number, awayId: number): MatchEvent[] {
  const out: MatchEvent[] = []
  for (const e of events ?? []) {
    const side = e.team?.id === homeId ? 'home' : e.team?.id === awayId ? 'away' : null
    if (!side || e.time?.elapsed == null) continue
    const minute = `${e.time.elapsed}${e.time.extra ? `+${e.time.extra}` : ''}'`
    const detail = e.detail ?? ''
    let kind: MatchEvent['kind'] | null = null
    if (e.type === 'Goal') kind = /own/i.test(detail) ? 'own_goal' : /missed/i.test(detail) ? 'missed_penalty' : /penalty/i.test(detail) ? 'penalty' : 'goal'
    else if (e.type === 'Card') kind = /red/i.test(detail) ? 'red' : /yellow/i.test(detail) ? 'yellow' : null
    if (!kind) continue
    // Gol contra: a fonte registra no time que se beneficiou.
    out.push({ minute, side, kind, player: e.player?.name ?? '—', assist: e.assist?.name ?? null })
  }
  return out
}
