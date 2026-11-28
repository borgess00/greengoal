// Histórico público dos bilhetes prontos (só dias que já passaram: os
// bilhetes de hoje continuam exclusivos para assinantes).
import { createServerFn } from '@tanstack/react-start'
import { addDays, currentGradeDate } from '@/lib/grade'
import type { ReadyTicketsContent } from '@/lib/ready-tickets'
import { settleReadyTicket, summarizeHistory, type HistoryTicket } from '@/lib/ticket-history'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { fixturesFor } from './slips.server'

let cache: { at: number; key: string; value: Awaited<ReturnType<typeof build>> } | null = null

async function build(today: string) {
  const db = supabaseAdmin()
  const { data } = await db
    .from('daily_tickets')
    .select('grade_date, content')
    .eq('status', 'done')
    .lt('grade_date', today)
    .gte('grade_date', addDays(today, -120))
    .order('grade_date', { ascending: false })
  const days = (data ?? []) as Array<{ grade_date: string; content: ReadyTicketsContent | null }>
  const all = days.flatMap((d) => (d.content?.bilhetes ?? []).map((t) => ({ date: d.grade_date, t })))
  const fixtures = await fixturesFor(all.map(({ t }) => ({ selections: t.selecoes.map((s) => ({ fixture_id: s.fixture_id, market: 'casa' as const, odd: null })) })))
  const list: HistoryTicket[] = all.map(({ date, t }) => settleReadyTicket(t, date, fixtures))
  return { summary: summarizeHistory(list), recent: list.slice(0, 40) }
}

export const getTicketHistory = createServerFn({ method: 'GET' }).handler(async () => {
  const today = currentGradeDate()
  if (cache && cache.key === today && Date.now() - cache.at < 10 * 60_000) return cache.value
  const value = await build(today)
  cache = { at: Date.now(), key: today, value }
  return value
})
