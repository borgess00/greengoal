import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Ban, Check, Circle, HelpCircle, History, X } from 'lucide-react'
import { AnimatedNumber } from '@/components/common/animated-number'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatGradeDate } from '@/lib/grade'
import { TIER_LABEL, TIER_RANGE } from '@/lib/ready-tickets'
import { seo } from '@/lib/seo'
import type { HistoryStatus, HistoryTicket } from '@/lib/ticket-history'
import { cn } from '@/lib/utils'
import { getTicketHistory } from '@/server/history.functions'

const historyQuery = queryOptions({ queryKey: ['ticket-history'], queryFn: () => getTicketHistory(), staleTime: 10 * 60_000 })

export const Route = createFileRoute('/historico')({
  loader: ({ context }) => context.queryClient.prefetchQuery(historyQuery),
  head: () =>
    seo({
      title: 'Histórico dos bilhetes prontos',
      description: 'Taxa de acerto real dos bilhetes prontos do GreenGoal, por faixa de odd e por mês, conferida pelo placar. Resultados passados não garantem resultados futuros.',
      path: '/historico',
    }),
  component: HistoricoPage,
})

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`
const fmtOdd = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const units = (u: number | null) => (u == null ? '—' : `${u > 0 ? '+' : ''}${u.toLocaleString('pt-BR')}u`)

const STATUS: Record<HistoryStatus, { label: string; cls: string }> = {
  won: { label: 'Ganho', cls: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300' },
  lost: { label: 'Perdido', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  void: { label: 'Anulado', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  open: { label: 'Em aberto', cls: 'bg-muted text-muted-foreground' },
  unverifiable: { label: 'Sem conferência', cls: 'bg-muted text-muted-foreground' },
}

function HistoricoPage() {
  const { data } = useQuery(historyQuery)
  const s = data?.summary
  return (
    <>
      <PageHeader
        eyebrow="Transparência"
        title="Histórico dos bilhetes prontos"
        description="Todos os bilhetes prontos dos dias que já passaram, conferidos pelo placar do tempo normal. Mostramos os acertos e os erros — passado não garante resultado futuro."
      />
      <div className="container-page space-y-8 py-8">
        {!s ? (
          <Skeleton className="h-60 rounded-2xl" />
        ) : !s.total ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
            <History className="size-8 text-primary" />
            <p className="font-display text-lg font-bold text-brand-dark">O histórico começa a aparecer amanhã</p>
            <p className="max-w-md text-sm text-muted-foreground">Os bilhetes prontos de cada dia entram aqui depois que o dia passa e os jogos são conferidos.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Bilhetes conferidos', s.decided],
                ['Ganhos', s.won],
                ['Taxa de acerto', s.rate != null ? `${s.rate}%` : '—'],
                ['Resultado (1u por bilhete)', units(s.units)],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <p className="text-xs font-semibold text-muted-foreground">{l}</p>
                  <p className="font-display text-3xl font-bold text-brand-dark tabular">
                    <AnimatedNumber value={v as string | number} />
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="mb-4 font-display text-lg font-bold text-brand-dark">Por faixa de odd</h2>
                <ul className="space-y-4">
                  {s.byTier.map((t) => (
                    <li key={t.tier}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold">
                          {TIER_LABEL[t.tier]} <span className="text-xs font-normal text-muted-foreground">({TIER_RANGE[t.tier]})</span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular">
                          {t.won}/{t.won + t.lost} · {t.rate != null ? `${t.rate}%` : '—'} · {units(t.units)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="bar-grow h-full rounded-full bg-primary" style={{ width: `${t.rate ?? 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="mb-4 font-display text-lg font-bold text-brand-dark">Por mês</h2>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 text-left font-semibold">Mês</th>
                      <th className="pb-2 font-semibold">Ganhos</th>
                      <th className="pb-2 font-semibold">Perdidos</th>
                      <th className="pb-2 text-right font-semibold">Acerto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.byMonth.map((m) => (
                      <tr key={m.month}>
                        <td className="py-2 font-semibold">{monthLabel(m.month)}</td>
                        <td className="py-2 text-center tabular">{m.won}</td>
                        <td className="py-2 text-center tabular">{m.lost}</td>
                        <td className="py-2 text-right font-display font-bold tabular">{m.rate != null ? `${m.rate}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.unverifiable > 0 && <p className="mt-3 text-xs text-muted-foreground">{s.unverifiable} bilhete(s) com mercados que o site não confere sozinho (ex.: escanteios) ficaram fora da taxa.</p>}
              </section>
            </div>

            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-brand-dark">Bilhetes recentes</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {data.recent.map((t, i) => (
                  <HistoryCard key={`${t.date}-${i}`} t={t} />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="flex flex-col items-start gap-3 rounded-2xl border border-primary/30 bg-secondary p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-secondary-foreground">Os bilhetes de hoje ficam com os assinantes e entram no histórico quando o dia acaba.</p>
          <Button asChild>
            <Link to="/bilhetes-prontos">Ver bilhetes de hoje</Link>
          </Button>
        </div>
        <RiskNotice />
      </div>
    </>
  )
}

function Icon({ s }: { s: HistoryTicket['selections'][number]['status'] }) {
  if (s === 'won') return <Check className="size-4 text-result-win" />
  if (s === 'lost') return <X className="size-4 text-result-loss" />
  if (s === 'void') return <Ban className="size-4 text-amber-500" />
  if (s === 'unverifiable') return <HelpCircle className="size-4 text-muted-foreground" />
  return <Circle className="size-3 text-muted-foreground" />
}

function HistoryCard({ t }: { t: HistoryTicket }) {
  const st = STATUS[t.status]
  return (
    <article className="enter-up rounded-2xl border bg-card p-4 shadow-soft">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {formatGradeDate(t.date)} · {TIER_LABEL[t.tier]}
          </p>
          <p className="truncate font-display font-bold text-brand-dark">{t.title}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', st.cls)}>{st.label}</span>
      </header>
      <ul className="mt-3 space-y-1.5 text-sm">
        {t.selections.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <Icon s={s.status} />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{s.market}</span> <span className="text-muted-foreground">· {s.game}</span>
            </span>
            <span className="text-xs text-muted-foreground tabular">{s.score ?? ''}</span>
            <span className="w-10 text-right font-display text-xs font-bold tabular">{fmtOdd(s.odd)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
        Odd total <strong className="font-display text-sm text-brand-dark tabular">{fmtOdd(t.odd)}</strong>
      </p>
    </article>
  )
}
