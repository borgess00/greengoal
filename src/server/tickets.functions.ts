// Conferência de bilhete (assinantes, conferido no servidor).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { FINISHED, VOID } from '@/lib/fixture-status'
import { checkTicket, findFixture, parseTicket, TICKET_MAX_CHARS, TICKET_MIN_CHARS, type TicketFixture } from '@/lib/tickets'
import { requireSubscriber } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { footballConfigured, refreshFixtures } from './football.server'

const COLUMNS = 'id, kickoff_at, league_name, home_team_name, away_team_name, status_short, goals_home, goals_away, ft_home, ft_away'
const WINDOW_DAYS = 10

async function loadFixtures() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString()
  const { data, error } = await supabaseAdmin().from('fixtures').select(COLUMNS).gte('kickoff_at', since).order('kickoff_at').limit(5000)
  if (error) throw new Error('Falha ao consultar partidas.')
  return (data ?? []) as TicketFixture[]
}

export const checkTicketFn = createServerFn({ method: 'POST' })
  .middleware([requireSubscriber])
  .validator((d: { input: string }) =>
    z
      .object({
        input: z
          .string()
          .trim()
          .min(TICKET_MIN_CHARS, `Digite pelo menos ${TICKET_MIN_CHARS} caracteres.`)
          .max(TICKET_MAX_CHARS, `Limite de ${TICKET_MAX_CHARS} caracteres.`),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let fixtures = await loadFixtures()

    // Atualiza pela API as partidas encontradas que já começaram e ainda não constam encerradas.
    const now = Date.now()
    const stale = new Set<number>()
    for (const l of parseTicket(data.input).lines) {
      if (!l.pick || !l.teamA || !l.teamB) continue
      const m = findFixture(l.teamA, l.teamB, fixtures)
      if (m && Date.parse(m.fixture.kickoff_at) < now && !FINISHED.has(m.fixture.status_short) && !VOID.has(m.fixture.status_short)) {
        stale.add(m.fixture.id)
      }
    }
    let refreshed = 0
    if (stale.size && footballConfigured()) {
      try {
        refreshed = (await refreshFixtures([...stale])).updated
        if (refreshed) fixtures = await loadFixtures()
      } catch {
        // Sem atualização: confere com o que está armazenado.
      }
    }

    const { results, truncated, summary } = checkTicket(data.input, fixtures)
    const { data: saved, error } = await supabaseAdmin()
      .from('tickets')
      .insert({ user_id: context.user.id, input: data.input, results: results as never, summary: { ...summary, truncated } as never })
      .select('id, created_at')
      .single()
    if (error) throw new Error('Não foi possível salvar a conferência.')
    return { id: saved.id as string, created_at: saved.created_at as string, results, summary, truncated, refreshed }
  })
