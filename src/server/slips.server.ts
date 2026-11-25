// Liquidação dos bilhetes salvos em "Meus bilhetes" (somente servidor).
import { settleSelection, settleSlip, slipOdd, type SlipFixture, type SlipSelection, type SlipStatus } from '@/lib/slips'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

export const SLIP_FIXTURE_COLUMNS =
  'id, kickoff_at, league_name, home_team_name, home_team_logo, away_team_name, away_team_logo, status_short, goals_home, goals_away, ft_home, ft_away'

export interface SlipRow {
  id: string
  user_id: string
  title: string | null
  selections: SlipSelection[]
  stake_units: number
  odd_total: number | null
  status: SlipStatus
  source: 'manual' | 'ready'
  settled_at: string | null
  created_at: string
}

/** Lê as partidas citadas nos bilhetes, num mapa por id. */
export async function fixturesFor(slips: Array<{ selections: SlipSelection[] }>) {
  const ids = [...new Set(slips.flatMap((s) => (Array.isArray(s.selections) ? s.selections.map((x) => Number(x.fixture_id)) : [])).filter(Number.isFinite))]
  if (!ids.length) return new Map<number, SlipFixture>()
  const { data } = await supabaseAdmin().from('fixtures').select(SLIP_FIXTURE_COLUMNS).in('id', ids)
  return new Map((data ?? []).map((f) => [f.id as number, f as SlipFixture]))
}

/**
 * Confere os bilhetes abertos pelo placar e grava o resultado. Idempotente:
 * só mexe em bilhetes cujo status mudou.
 */
export async function settleSlips(slips: SlipRow[], fixtures?: Map<number, SlipFixture>) {
  const open = slips.filter((s) => s.status === 'open')
  if (!open.length) return slips
  const map = fixtures ?? (await fixturesFor(open))
  const db = supabaseAdmin()
  const out: SlipRow[] = []
  for (const s of slips) {
    if (s.status !== 'open') {
      out.push(s)
      continue
    }
    const statuses = s.selections.map((sel) => settleSelection(sel, map.get(Number(sel.fixture_id))))
    const status = settleSlip(statuses)
    if (status === 'open') {
      out.push(s)
      continue
    }
    const odd_total = slipOdd(s.selections, statuses)
    const settled_at = new Date().toISOString()
    await db.from('user_slips').update({ status, odd_total, settled_at }).eq('id', s.id).eq('status', 'open')
    out.push({ ...s, status, odd_total, settled_at })
  }
  return out
}

/** Usado pela automação: confere todos os bilhetes abertos do site. */
export async function settleAllOpenSlips() {
  const { data } = await supabaseAdmin().from('user_slips').select('*').eq('status', 'open').limit(5000)
  const rows = (data ?? []) as SlipRow[]
  const settled = await settleSlips(rows)
  return settled.filter((s) => s.status !== 'open').length
}
