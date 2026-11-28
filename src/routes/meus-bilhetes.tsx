import * as React from 'react'
import { createFileRoute, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Check, Circle, Plus, Search, TicketCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState } from '@/components/common/empty-state'
import { RiskNotice } from '@/components/common/risk-notice'
import { AnimatedNumber } from '@/components/common/animated-number'
import { TeamCrest } from '@/components/common/team-crest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ShareTicketButton } from '@/components/slips/share-ticket-button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select-native'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { isLive } from '@/lib/fixture-status'
import { errorMessage, formatDateTime } from '@/lib/format'
import { addDays, currentGradeDate, formatGradeDate, spParts } from '@/lib/grade'
import { seo } from '@/lib/seo'
import { performance, type SelectionStatus, type SlipStatus } from '@/lib/slips'
import { ODD_TIERS, TIER_LABEL, TIER_RANGE, tierForOdd, type OddTier } from '@/lib/ready-tickets'
import { cn } from '@/lib/utils'
import { deleteSlip, listMySlips, type SlipView } from '@/server/slips.functions'

const TABS = ['abertos', 'ganhos', 'perdidos', 'anulados', 'desempenho'] as const
type Tab = (typeof TABS)[number]
const TAB_STATUS: Record<Exclude<Tab, 'desempenho'>, SlipStatus> = {
  abertos: 'open',
  ganhos: 'won',
  perdidos: 'lost',
  anulados: 'void',
}

export const Route = createFileRoute('/meus-bilhetes')({
  validateSearch: z.object({ aba: z.enum(TABS).optional().catch(undefined) }),
  head: () =>
    seo({
      title: 'Meus bilhetes',
      description: 'Monte seus bilhetes no GreenGoal e acompanhe sozinho se bateram, com taxa de acerto e resultado em unidades.',
      path: '/meus-bilhetes',
    }),
  component: MeusBilhetesPage,
})

const fmtOdd = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

function MeusBilhetesPage() {
  const { aba = 'abertos' } = Route.useSearch()
  const navigate = useNavigate({ from: '/meus-bilhetes' })
  const { user, loading } = useAuth()
  const location = useLocation()
  const q = useQuery({
    queryKey: ['my-slips', user?.id],
    queryFn: () => listMySlips(),
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const [text, setText] = React.useState('')
  const [league, setLeague] = React.useState('')

  const slips = q.data?.slips ?? []
  const counts = {
    abertos: slips.filter((s) => s.status === 'open').length,
    ganhos: slips.filter((s) => s.status === 'won').length,
    perdidos: slips.filter((s) => s.status === 'lost').length,
    anulados: slips.filter((s) => s.status === 'void').length,
  }
  const leagues = [...new Set(slips.flatMap((s) => s.selections.map((x) => x.fixture?.league_name).filter(Boolean) as string[]))].sort()
  const term = text.trim().toLowerCase()
  const visible =
    aba === 'desempenho'
      ? []
      : slips.filter(
          (s) =>
            s.status === TAB_STATUS[aba] &&
            (!league || s.selections.some((x) => x.fixture?.league_name === league)) &&
            (!term || (s.title ?? '').toLowerCase().includes(term) || s.selections.some((x) => `${x.fixture?.home_team_name} ${x.fixture?.away_team_name} ${x.label}`.toLowerCase().includes(term))),
        )

  const tabBtn = (t: Tab, label: string, n?: number) => (
    <button
      key={t}
      type="button"
      role="tab"
      aria-selected={aba === t}
      onClick={() =>
        navigate({
          search: { aba: t === 'abertos' ? undefined : t },
          replace: true,
        })
      }
      className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition', aba === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-brand-dark')}
    >
      {label}
      {n != null && <span className="tabular opacity-80"> {n}</span>}
    </button>
  )

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-dark">Meus bilhetes</h1>
          <p className="mt-1 text-muted-foreground">Seus bilhetes salvos. Acompanhe os jogos e veja o resultado — a conferência é automática.</p>
        </div>
        <Button asChild>
          <Link to="/jogos" search={{ status: 'proximos' }}>
            <Plus /> Montar bilhete
          </Link>
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !user ? (
        <EmptyState
          icon={TicketCheck}
          title="Entre para montar e salvar bilhetes"
          description="Monte bilhetes com os jogos do dia e o GreenGoal confere sozinho quando as partidas acabarem. É grátis."
          action={
            <Button asChild>
              <Link to="/auth" search={{ redirect: location.href }}>
                Entrar ou criar conta
              </Link>
            </Button>
          }
        />
      ) : q.data && !q.data.ready ? (
        <EmptyState icon={TicketCheck} title="Meus bilhetes indisponível no momento" description={q.data.message} />
      ) : (
        <div className="space-y-5">
          <SummaryStrip slips={slips} />
          <div className="min-w-0 space-y-4">
            <div role="tablist" aria-label="Situação dos bilhetes" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:inline-flex sm:rounded-full sm:border sm:bg-card sm:p-1">
              {tabBtn('abertos', 'Abertos', counts.abertos)}
              {tabBtn('ganhos', 'Ganhos', counts.ganhos)}
              {tabBtn('perdidos', 'Perdidos', counts.perdidos)}
              {tabBtn('anulados', 'Anulados', counts.anulados)}
              {tabBtn('desempenho', 'Desempenho')}
            </div>

            {aba === 'desempenho' ? (
              <PerformancePanel slips={slips} loading={q.isLoading} />
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar nos bilhetes salvos…" aria-label="Buscar nos bilhetes salvos" className="h-10 pl-10" />
                  </div>
                  <NativeSelect aria-label="Competição" value={league} onChange={(e) => setLeague(e.target.value)} className="h-10 sm:w-56">
                    <option value="">Todas as competições</option>
                    {leagues.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {q.isLoading ? (
                  <Skeleton className="h-48 rounded-2xl" />
                ) : visible.length ? (
                  <div className="grid items-start gap-4 lg:grid-cols-2">
                    {visible.map((s) => (
                      <SlipCard key={s.id} s={s} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
                    <TicketCheck className="size-8 text-primary" />
                    <p className="font-display text-lg font-bold text-brand-dark">{aba === 'abertos' ? 'Seu próximo bilhete começa aqui' : 'Nada por aqui ainda'}</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                      {aba === 'abertos'
                        ? 'Abra uma partida, toque em “+ Bilhete” nos mercados e salve. O resultado aparece sozinho quando os jogos acabarem.'
                        : 'Os bilhetes aparecem nesta aba depois de conferidos.'}
                    </p>
                    {aba === 'abertos' && (
                      <Button asChild>
                        <Link to="/jogos" search={{ status: 'proximos' }}>
                          Explorar partidas
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <RiskNotice className="mt-8" />
    </div>
  )
}

const STATUS_STYLE: Record<SlipStatus, { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'bg-muted text-muted-foreground' },
  won: {
    label: 'Ganho',
    cls: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  },
  lost: {
    label: 'Perdido',
    cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  void: {
    label: 'Anulado',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  },
}

function SelIcon({ s }: { s: SelectionStatus }) {
  if (s === 'won')
    return (
      <span className="grid size-6 place-items-center rounded-full bg-result-win text-white" title="Acertou">
        <Check className="size-3.5" />
      </span>
    )
  if (s === 'lost')
    return (
      <span className="grid size-6 place-items-center rounded-full bg-result-loss text-white" title="Errou">
        <X className="size-3.5" />
      </span>
    )
  if (s === 'void')
    return (
      <span className="grid size-6 place-items-center rounded-full bg-amber-500 text-white" title="Anulada (jogo adiado ou cancelado)">
        <Ban className="size-3.5" />
      </span>
    )
  return (
    <span className="grid size-6 place-items-center rounded-full border-2 text-muted-foreground" title="Em aberto">
      <Circle className="size-2 fill-current" />
    </span>
  )
}

function SlipCard({ s }: { s: SlipView }) {
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: () => deleteSlip({ data: { id: s.id } }),
    onSuccess: () => {
      toast.success('Bilhete apagado.')
      qc.invalidateQueries({ queryKey: ['my-slips'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const st = STATUS_STYLE[s.status]
  const result =
    s.status === 'won' && s.odd != null ? `+${(s.stake * (s.odd - 1)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}u` : s.status === 'lost' ? `-${s.stake.toLocaleString('pt-BR')}u` : null
  return (
    <article className="enter-up rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-brand-dark">{s.title || `Bilhete com ${s.selections.length} ${s.selections.length === 1 ? 'seleção' : 'seleções'}`}</p>
          <p className="text-xs text-muted-foreground">
            Salvo em {formatDateTime(s.createdAt)}
            {s.source === 'ready' && ' · a partir de um bilhete pronto'}
          </p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', st.cls)}>{st.label}</span>
      </header>
      <ul className="mt-4 divide-y">
        {s.selections.map((x) => {
          const f = x.fixture
          const live = f && isLive(f.status_short)
          return (
            <li key={x.fixtureId} className="flex items-center gap-3 py-2.5">
              <SelIcon s={x.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{x.label}</p>
                {f ? (
                  <Link to="/jogo/$id" params={{ id: String(f.id) }} className="flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground">
                    <TeamCrest name={f.home_team_name} logo={f.home_team_logo} size={14} />
                    {f.home_team_name} x {f.away_team_name}
                    <TeamCrest name={f.away_team_name} logo={f.away_team_logo} size={14} />
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">Partida não encontrada</p>
                )}
              </div>
              <div className="text-right text-xs">
                <p className="font-display text-sm font-bold tabular">{fmtOdd(x.odd)}</p>
                <p className={cn('tabular', live ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {f?.score
                    ? `${live ? 'ao vivo ' : ''}${f.score}`
                    : f
                      ? new Date(f.kickoff_at).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Odd total <strong className="font-display text-base text-brand-dark tabular">{fmtOdd(s.odd)}</strong> · {s.stake.toLocaleString('pt-BR')} unidade(s)
          {result && <strong className={cn('ml-2 tabular', s.status === 'won' ? 'text-primary' : 'text-red-600 dark:text-red-400')}>{result}</strong>}
        </span>
        <span className="flex items-center gap-1">
          <ShareTicketButton
            filename={`bilhete-${s.id.slice(0, 8)}.png`}
            ticket={{
              title: s.title || `Bilhete com ${s.selections.length} ${s.selections.length === 1 ? 'seleção' : 'seleções'}`,
              subtitle: `Montado no GreenGoal · ${formatDateTime(s.createdAt)}`,
              status: s.status,
              odd: s.odd,
              selections: s.selections.map((x) => ({
                market: x.label,
                game: x.fixture ? `${x.fixture.home_team_name} x ${x.fixture.away_team_name}` : 'Partida',
                score: x.fixture?.score ?? null,
                odd: x.odd,
                status: x.status,
              })),
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={del.isPending}>
                <Trash2 /> Apagar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar este bilhete?</AlertDialogTitle>
                <AlertDialogDescription>Ele sai de Meus bilhetes e do seu desempenho. Não dá para desfazer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Manter</AlertDialogCancel>
                <AlertDialogAction onClick={() => del.mutate()}>Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </span>
      </footer>
    </article>
  )
}

/** Números no topo: situação dos bilhetes, desempenho e o que está em jogo hoje. */
function SummaryStrip({ slips }: { slips: SlipView[] }) {
  const today = currentGradeDate()
  const tomorrow = addDays(today, 1)
  const open = slips.filter((s) => s.status === 'open')
  const selections = open.flatMap((s) => s.selections.filter((x) => x.status === 'open' && x.fixture))
  const live = selections.filter((x) => isLive(x.fixture!.status_short)).length
  const startsToday = selections.filter((x) => spParts(x.fixture!.kickoff_at).date === today && !isLive(x.fixture!.status_short)).length
  const startsTomorrow = selections.filter((x) => spParts(x.fixture!.kickoff_at).date === tomorrow).length
  const p = performance(
    slips.map((s) => ({
      status: s.status,
      odd_total: s.odd,
      stake_units: s.stake,
    })),
  )
  const tiles: Array<[string, React.ReactNode, 'win' | 'loss' | undefined]> = [
    ['Abertos', open.length, undefined],
    ['Ganhos', p.won, 'win'],
    ['Perdidos', p.lost, 'loss'],
    ['Taxa de acerto', p.hitRate != null ? `${p.hitRate}%` : '—', undefined],
    ['Resultado', p.units != null ? `${p.units > 0 ? '+' : ''}${p.units.toLocaleString('pt-BR')}u` : '—', p.units != null ? (p.units >= 0 ? 'win' : 'loss') : undefined],
    ['ROI', p.roi != null ? `${p.roi.toLocaleString('pt-BR')}%` : '—', p.roi != null ? (p.roi >= 0 ? 'win' : 'loss') : undefined],
  ]
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="rounded-xl bg-muted/60 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
            <p className={cn('font-display text-xl font-bold tabular', tone === 'win' ? 'text-primary' : tone === 'loss' ? 'text-red-600 dark:text-red-400' : 'text-brand-dark')}>
              <AnimatedNumber value={value} />
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
        <span className="font-bold text-brand-dark">Sua rodada · {formatGradeDate(today)}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          <strong className={cn('tabular', live ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{live}</strong> ao vivo
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          <strong className="text-foreground tabular">{startsToday}</strong> começam hoje
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          <strong className="text-foreground tabular">{startsTomorrow}</strong> amanhã
        </span>
        <span className="ml-auto hidden text-muted-foreground sm:inline">Conferência pelo placar do tempo normal · adiado/cancelado anula a seleção</span>
      </div>
    </div>
  )
}

function PerformancePanel({ slips, loading }: { slips: SlipView[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-48 rounded-2xl" />
  // Por competição: quantos bilhetes de cada liga bateram (bilhetes de uma liga só).
  const byLeague = new Map<string, { won: number; lost: number }>()
  for (const s of slips) {
    if (s.status !== 'won' && s.status !== 'lost') continue
    const ls = [...new Set(s.selections.map((x) => x.fixture?.league_name).filter(Boolean) as string[])]
    const key = ls.length === 1 ? ls[0] : 'Múltiplas competições'
    const cur = byLeague.get(key) ?? { won: 0, lost: 0 }
    cur[s.status]++
    byLeague.set(key, cur)
  }
  // Por faixa de odd total (mesmas faixas dos bilhetes prontos).
  const byTier = new Map<OddTier, { won: number; lost: number }>()
  for (const sl of slips) {
    if ((sl.status !== 'won' && sl.status !== 'lost') || sl.odd == null) continue
    const t = tierForOdd(sl.odd)
    const cur = byTier.get(t) ?? { won: 0, lost: 0 }
    cur[sl.status]++
    byTier.set(t, cur)
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="mb-3 font-display text-lg font-bold text-brand-dark">Por faixa de odd</h3>
        {byTier.size ? (
          <ul className="space-y-3">
            {ODD_TIERS.filter((t) => byTier.has(t)).map((t) => {
              const v = byTier.get(t)!
              const rate = Math.round((v.won / (v.won + v.lost)) * 100)
              return (
                <li key={t} className="grid grid-cols-[minmax(0,1fr)_7rem_3rem] items-center gap-3 text-sm">
                  <span className="truncate font-semibold">
                    {TIER_LABEL[t]} <span className="text-xs font-normal text-muted-foreground">({TIER_RANGE[t]})</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                  </span>
                  <span className="text-right text-xs text-muted-foreground tabular">
                    {v.won}/{v.won + v.lost}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aparece quando houver bilhetes conferidos com todas as odds preenchidas.</p>
        )}
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="mb-3 font-display text-lg font-bold text-brand-dark">Por competição</h3>
        {byLeague.size ? (
          <ul className="space-y-3">
            {[...byLeague.entries()]
              .sort((a, b) => b[1].won + b[1].lost - (a[1].won + a[1].lost))
              .map(([name, v]) => {
                const rate = Math.round((v.won / (v.won + v.lost)) * 100)
                return (
                  <li key={name} className="grid grid-cols-[minmax(0,1fr)_7rem_3rem] items-center gap-3 text-sm">
                    <span className="truncate font-semibold">{name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                    </span>
                    <span className="text-right text-xs text-muted-foreground tabular">
                      {v.won}/{v.won + v.lost}
                    </span>
                  </li>
                )
              })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Seu desempenho por competição aparece quando os primeiros bilhetes forem conferidos.</p>
        )}
      </div>
    </div>
  )
}
