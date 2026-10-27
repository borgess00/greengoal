// Jogos do dia: dia do calendário no fuso America/Sao_Paulo (00h00 às 23h59).

export const TIMEZONE = 'America/Sao_Paulo'

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export interface SpParts {
  date: string // YYYY-MM-DD
  hour: number
  minute: number
  time: string // HH:MM
}

export function spParts(input: Date | string): SpParts {
  const d = typeof input === 'string' ? new Date(input) : input
  const map: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(d)) map[p.type] = p.value
  const hour = Number(map.hour) % 24
  const minute = Number(map.minute)
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour,
    minute,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  }
}

/** Soma dias a uma data YYYY-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const dt = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === date
}

/** Dia (horário de Brasília) a que pertence um início de partida. */
export function gradeDateFor(kickoff: Date | string): string {
  return spParts(kickoff).date
}

/** Dia de hoje no horário de Brasília. */
export function currentGradeDate(now: Date = new Date()): string {
  return spParts(now).date
}

/** Data calendário de hoje em São Paulo (para limites diários). */
export function spToday(now: Date = new Date()): string {
  return spParts(now).date
}

const longDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

export function formatGradeDate(date: string): string {
  const s = longDate.format(new Date(`${date}T12:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
export function formatShortDate(date: string): string {
  return shortDate.format(new Date(`${date}T12:00:00Z`))
}

/** Rótulo relativo (Hoje, Amanhã, Ontem) para a grade. */
export function relativeGradeLabel(date: string, now: Date = new Date()): string | null {
  const today = currentGradeDate(now)
  if (date === today) return 'Hoje'
  if (date === addDays(today, 1)) return 'Amanhã'
  if (date === addDays(today, -1)) return 'Ontem'
  return null
}
