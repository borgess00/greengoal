const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const formatBRL = (cents: number) => brl.format(cents / 100)

const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))

export const formatNumber = (n: number | null | undefined, digits = 2) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export function daysUntil(iso: string, now = Date.now()) {
  return Math.ceil((Date.parse(iso) - now) / 86400_000)
}

export function errorMessage(e: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string') return e
  return fallback
}
