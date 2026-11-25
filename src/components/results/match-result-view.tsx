import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/hooks/use-auth'
import { errorMessage } from '@/lib/format'
import type { MatchEvent, StatGroup, StatLine } from '@/lib/match-result'
import { cn } from '@/lib/utils'
import { collectResultForFixture, getMatchResult } from '@/server/results.functions'

export function useMatchResult(id: number, enabled = true) {
  return useQuery({ queryKey: ['match-result', id], queryFn: () => getMatchResult({ data: { id } }), enabled, staleTime: 10 * 60_000 })
}

const fmt = (v: number | null, suffix = '') => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`)

/** Linha comparativa: números nas pontas e duas barras que se encontram no meio. */
function CompareLine({ l }: { l: StatLine }) {
  const h = l.home ?? 0
  const a = l.away ?? 0
  const max = Math.max(h, a, 1)
  const lead = h === a ? null : h > a ? 'home' : 'away'
  return (
    <div className="py-2">
      <div className="mb-1.5 grid grid-cols-[3rem_1fr_3rem] items-center text-sm">
        <span className={cn('font-display font-bold tabular', lead === 'home' ? 'text-brand-dark' : 'text-muted-foreground')}>{fmt(l.home, l.suffix)}</span>
        <span className="text-center text-xs font-semibold text-muted-foreground">{l.label}</span>
        <span className={cn('text-right font-display font-bold tabular', lead === 'away' ? 'text-brand-dark' : 'text-muted-foreground')}>{fmt(l.away, l.suffix)}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5" aria-hidden>
        <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-muted">
          <span className="h-full rounded-full bg-series-home" style={{ width: `${(h / max) * 100}%` }} />
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="h-full rounded-full bg-series-away" style={{ width: `${(a / max) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

export function ResultStats({ groups }: { groups: StatGroup[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title} className="rounded-xl border bg-card p-4">
          <h4 className="mb-1 text-center font-display font-bold text-brand-dark">{g.title}</h4>
          {g.lines.map((l) => (
            <CompareLine key={l.label} l={l} />
          ))}
        </div>
      ))}
    </div>
  )
}

const ICON: Record<MatchEvent['kind'], string> = { goal: '⚽', penalty: '⚽', own_goal: '⚽', missed_penalty: '✕', yellow: '🟨', red: '🟥' }
const NOTE: Partial<Record<MatchEvent['kind'], string>> = { penalty: ' (pên.)', own_goal: ' (contra)', missed_penalty: ' (pênalti perdido)' }

/** Gols e cartões dos dois times, lado a lado. */
export function ResultEvents({ events, className }: { events: MatchEvent[]; className?: string }) {
  if (!events.length) return null
  const side = (s: 'home' | 'away') => events.filter((e) => e.side === s)
  return (
    <div className={cn('grid grid-cols-2 gap-6 text-xs', className)}>
      {(['home', 'away'] as const).map((s) => (
        <ul key={s} className={cn('space-y-1', s === 'home' ? 'text-right' : 'text-left')}>
          {side(s).map((e, i) => (
            <li key={i} className="text-muted-foreground">
              {s === 'away' && <span aria-hidden>{ICON[e.kind]} </span>}
              <span className="font-semibold text-foreground">{e.player}</span> {e.minute}
              {NOTE[e.kind]}
              {s === 'home' && <span aria-hidden> {ICON[e.kind]}</span>}
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}

/** Bloco completo para partidas encerradas (estatísticas finais), com coleta manual para o admin. */
export function FinishedMatchStats({ fixtureId }: { fixtureId: number }) {
  const r = useMatchResult(fixtureId)
  const { me } = useMe()
  const qc = useQueryClient()
  const collect = useMutation({
    mutationFn: () => collectResultForFixture({ data: { fixtureId } }),
    onSuccess: (x) => {
      toast.success(`Resultado coletado (${x.apiCalls} consultas).`)
      qc.invalidateQueries({ queryKey: ['match-result', fixtureId] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (r.isLoading) return <Skeleton className="h-56 rounded-xl" />
  if (!r.data?.available || !r.data.groups.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-center text-sm text-muted-foreground">
        <p>As estatísticas finais desta partida ainda não foram coletadas. Elas entram na próxima atualização automática.</p>
        {me?.isAdmin && (
          <Button size="sm" className="mt-3" onClick={() => collect.mutate()} disabled={collect.isPending}>
            <RefreshCw className={collect.isPending ? 'animate-spin' : ''} /> Coletar agora (admin)
          </Button>
        )}
      </div>
    )
  }
  return <ResultStats groups={r.data.groups} />
}
