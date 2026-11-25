import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, TicketCheck } from 'lucide-react'
import { toast } from 'sonner'
import { NOT_STARTED } from '@/lib/fixture-status'
import { slipDraft, useSlipDraft } from '@/lib/slip-store'
import { SLIP_MARKETS, type SlipMarketCode } from '@/lib/slips'
import { cn } from '@/lib/utils'
import { getSlipOdds } from '@/server/slips.functions'
import { openSlipDock } from './slip-dock'

export interface PickerFixture {
  id: number
  home_team_name: string
  away_team_name: string
  league_name: string
  kickoff_at: string
  status_short: string
}

const fmtOdd = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function canBet(f: PickerFixture) {
  return NOT_STARTED.has(f.status_short) && Date.parse(f.kickoff_at) > Date.now()
}

/** Adiciona um mercado da partida ao bilhete em montagem. */
export function addToSlip(f: PickerFixture, market: SlipMarketCode, odd: number | null) {
  const m = SLIP_MARKETS.find((x) => x.code === market)!
  const label = m.label(f.home_team_name, f.away_team_name)
  const ok = slipDraft.add({ fixtureId: f.id, market, label, odd, home: f.home_team_name, away: f.away_team_name, league: f.league_name, kickoff: f.kickoff_at })
  if (!ok) {
    toast.error('O bilhete já tem 20 seleções.')
    return
  }
  toast.success(`Adicionado: ${label}`, { action: { label: 'Ver bilhete', onClick: openSlipDock } })
}

/** Grade de mercados conferíveis da partida, com a odd da fonte quando houver. */
export function MarketPicker({ fixture, compact = false }: { fixture: PickerFixture; compact?: boolean }) {
  const draft = useSlipDraft()
  const odds = useQuery({ queryKey: ['slip-odds', fixture.id], queryFn: () => getSlipOdds({ data: { fixtureId: fixture.id } }), staleTime: 10 * 60_000 })
  const current = draft.find((d) => d.fixtureId === fixture.id)
  const chosen = current?.market
  // Se a seleção entrou antes de as odds carregarem, completa a odd depois.
  const lateOdd = current && current.odd == null ? (odds.data?.odds[current.market] ?? null) : null
  React.useEffect(() => {
    if (lateOdd != null) slipDraft.setOdd(fixture.id, lateOdd)
  }, [lateOdd, fixture.id])
  const groups = [...new Set(SLIP_MARKETS.map((m) => m.group))]

  if (!canBet(fixture)) {
    return <p className="text-sm text-muted-foreground">Esta partida já começou: só dá para montar bilhetes com jogos que ainda não começaram.</p>
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{g}</p>
          <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
            {SLIP_MARKETS.filter((m) => m.group === g).map((m) => {
              const odd = odds.data?.odds[m.code] ?? null
              const on = chosen === m.code
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => addToSlip(fixture, m.code, odd)}
                  aria-pressed={on}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/60 hover:bg-secondary',
                  )}
                >
                  <span className="min-w-0 truncate">{m.label(fixture.home_team_name, fixture.away_team_name)}</span>
                  <span className={cn('flex shrink-0 items-center gap-1 font-display tabular', on ? '' : 'text-primary')}>
                    {odd != null ? fmtOdd(odd) : on ? <TicketCheck className="size-4" /> : <Plus className="size-4" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        {odds.data?.bookmaker ? `Odds de referência: ${odds.data.bookmaker}. ` : 'Sem odds da fonte para este jogo: você pode digitar a sua no bilhete. '}
        Uma seleção por partida — escolher outro mercado troca a seleção.
      </p>
    </div>
  )
}
