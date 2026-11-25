// "Meus bilhetes": montar, salvar, listar (já conferidos) e apagar.
// Leitura e exclusão com o token da pessoa (RLS); a criação passa por aqui,
// que valida partidas, mercados e odds antes de gravar.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ApiOdds } from '@/lib/api-football-types'
import { impliedMarkets } from '@/lib/facts'
import { NOT_STARTED } from '@/lib/fixture-status'
import { addDays, currentGradeDate } from '@/lib/grade'
import { oddsByCode } from '@/lib/ready-tickets'
import { isSlipMarket, marketLabel, settleSelection, slipOdd, SLIP_MARKET_CODES, type SelectionStatus, type SlipFixture, type SlipMarketCode, type SlipStatus } from '@/lib/slips'
import { requireAuth } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { fixturesFor, settleSlips, SLIP_FIXTURE_COLUMNS, type SlipRow } from './slips.server'

const PENDING = 'Meus bilhetes ainda não foi ativado no banco (falta rodar a atualização do Supabase).'

export interface SlipView {
  id: string
  title: string | null
  status: SlipStatus
  stake: number
  odd: number | null
  source: 'manual' | 'ready'
  createdAt: string
  settledAt: string | null
  selections: Array<{
    fixtureId: number
    market: SlipMarketCode
    label: string
    odd: number | null
    status: SelectionStatus
    fixture: (SlipFixture & { score: string | null }) | null
  }>
}

function view(s: SlipRow, fixtures: Map<number, SlipFixture>): SlipView {
  return {
    id: s.id,
    title: s.title,
    status: s.status,
    stake: Number(s.stake_units),
    odd: s.odd_total == null ? null : Number(s.odd_total),
    source: s.source,
    createdAt: s.created_at,
    settledAt: s.settled_at,
    selections: s.selections.map((sel) => {
      const f = fixtures.get(Number(sel.fixture_id))
      const h = f?.ft_home ?? f?.goals_home
      const a = f?.ft_away ?? f?.goals_away
      return {
        fixtureId: Number(sel.fixture_id),
        market: sel.market,
        label: f ? marketLabel(sel.market, f.home_team_name, f.away_team_name) : sel.market,
        odd: sel.odd ?? null,
        status: settleSelection(sel, f),
        fixture: f ? { ...f, score: h != null && a != null ? `${h} x ${a}` : null } : null,
      }
    }),
  }
}

export const listMySlips = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db.from('user_slips').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) return { ready: false as const, message: PENDING, slips: [] as SlipView[] }
    const rows = (data ?? []) as SlipRow[]
    const fixtures = await fixturesFor(rows)
    const settled = await settleSlips(rows, fixtures)
    return { ready: true as const, slips: settled.map((s) => view(s, fixtures)) }
  })

const selectionInput = z.object({
  fixtureId: z.number().int().positive(),
  market: z.string().refine(isSlipMarket, 'Mercado inválido'),
  odd: z.number().min(1.01).max(1000).nullish(),
})

export const createSlip = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { title?: string; stake?: number; source?: 'manual' | 'ready'; selections: Array<{ fixtureId: number; market: string; odd?: number | null }> }) =>
    z
      .object({
        title: z.string().trim().max(80).optional(),
        stake: z.number().min(0.1).max(100).optional(),
        source: z.enum(['manual', 'ready']).optional(),
        selections: z.array(selectionInput).min(1, 'Adicione pelo menos uma seleção.').max(20, 'No máximo 20 seleções por bilhete.'),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ids = data.selections.map((s) => s.fixtureId)
    if (new Set(ids).size !== ids.length) throw new Error('Use no máximo uma seleção por partida.')
    const db = supabaseAdmin()
    const { data: fx, error } = await db.from('fixtures').select(SLIP_FIXTURE_COLUMNS).in('id', ids)
    if (error) throw new Error('Não foi possível validar as partidas.')
    const byId = new Map((fx ?? []).map((f) => [f.id as number, f as SlipFixture]))
    for (const s of data.selections) {
      const f = byId.get(s.fixtureId)
      if (!f) throw new Error('Partida não encontrada.')
      if (!NOT_STARTED.has(f.status_short) || Date.parse(f.kickoff_at) <= Date.now()) {
        throw new Error(`${f.home_team_name} x ${f.away_team_name} já começou: monte bilhetes só com jogos que ainda não começaram.`)
      }
    }
    const selections = data.selections.map((s) => ({ fixture_id: s.fixtureId, market: s.market as SlipMarketCode, odd: s.odd ?? null }))
    const { data: row, error: insError } = await db
      .from('user_slips')
      .insert({
        user_id: context.user.id,
        title: data.title || null,
        stake_units: data.stake ?? 1,
        selections,
        odd_total: slipOdd(selections),
        source: data.source ?? 'manual',
      })
      .select('id')
      .single()
    if (insError) throw new Error(/Limite/.test(insError.message) ? insError.message : PENDING)
    return { id: row.id as string }
  })

export const deleteSlip = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from('user_slips').delete().eq('id', data.id)
    if (error) throw new Error('Não foi possível apagar o bilhete.')
    return { ok: true }
  })

/** Partidas que ainda não começaram (hoje e amanhã, se já carregadas) para montar bilhetes. */
export const getSlipFixtures = createServerFn({ method: 'GET' }).handler(async () => {
  const date = currentGradeDate()
  const { data } = await supabaseAdmin()
    .from('fixtures')
    .select(`${SLIP_FIXTURE_COLUMNS}, league_logo, local_time, grade_date`)
    .in('grade_date', [date, addDays(date, 1)])
    .in('status_short', [...NOT_STARTED])
    .gt('kickoff_at', new Date().toISOString())
    .order('kickoff_at')
    .limit(400)
  return (data ?? []) as Array<SlipFixture & { league_logo: string | null; local_time: string; grade_date: string }>
})

/** Odds da fonte para os mercados conferíveis de uma partida (quando houver). */
export const getSlipOdds = createServerFn({ method: 'GET' })
  .validator((d: { fixtureId: number }) => z.object({ fixtureId: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin().from('fixture_data').select('odds:payload->odds').eq('fixture_id', data.fixtureId).maybeSingle()
    const quotes = oddsByCode(impliedMarkets((row?.odds as ApiOdds | null) ?? null))
    const out: Partial<Record<SlipMarketCode, number>> = {}
    for (const code of SLIP_MARKET_CODES) {
      const q = quotes[code as keyof typeof quotes]
      if (q) out[code] = q.odd
    }
    return { odds: out, bookmaker: Object.values(quotes)[0]?.bookmaker ?? null }
  })
