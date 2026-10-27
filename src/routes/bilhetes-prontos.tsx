import { createFileRoute, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Layers, Lock, RefreshCw, ShieldAlert, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { RISK_LABELS } from '@/lib/analysis'
import { errorMessage, formatDateTime, formatNumber } from '@/lib/format'
import { addDays, currentGradeDate, formatGradeDate, isValidDate, relativeGradeLabel } from '@/lib/grade'
import type { ReadyTicket } from '@/lib/ready-tickets'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { generateReadyTickets, getReadyTickets } from '@/server/ready-tickets.functions'

export const Route = createFileRoute('/bilhetes-prontos')({
  validateSearch: z.object({ data: z.string().refine(isValidDate).optional().catch(undefined) }),
  head: () =>
    seo({
      title: 'Bilhetes prontos do dia',
      description: 'Bilhetes montados a partir das análises do dia, separados por nível de risco, com odds e probabilidades estimadas. Recurso para assinantes. 18+.',
      path: '/bilhetes-prontos',
    }),
  component: BilhetesProntosPage,
})

const RISK_STYLE: Record<ReadyTicket['risco'], { badge: string; bar: string }> = {
  baixo: { badge: 'bg-green-100 text-green-800', bar: 'bg-green-500' },
  medio: { badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  'medio-alto': { badge: 'bg-orange-100 text-orange-800', bar: 'bg-orange-500' },
}

function BilhetesProntosPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/bilhetes-prontos' })
  const location = useLocation()
  const date = search.data ?? currentGradeDate()
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  const q = useQuery({
    queryKey: ['ready-tickets', date, user?.id ?? 'anon'],
    queryFn: () => getReadyTickets({ data: { date } }),
    enabled: !authLoading,
    staleTime: 60_000,
  })

  const generate = useMutation({
    mutationFn: () => generateReadyTickets({ data: { date } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`${r.tickets} bilhete(s) gerado(s).`)
      else toast.error(r.error)
      queryClient.invalidateQueries({ queryKey: ['ready-tickets'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const setDate = (d: string) => navigate({ search: { data: d === currentGradeDate() ? undefined : d } })
  const rel = relativeGradeLabel(date)
  const data = q.data

  return (
    <>
      <PageHeader eyebrow="Assinantes" title="Bilhetes prontos" description="Montados a partir das análises do dia e separados por nível de risco. Informação estatística, não garantia de resultado.">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="white" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 truncate rounded-full bg-white/10 px-4 py-2 text-center font-semibold ring-1 ring-white/20 sm:flex-none">
            {rel && <span className="mr-1 text-brand-light">{rel} ·</span>}
            {formatGradeDate(date)}
          </div>
          <Button size="icon" variant="white" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </PageHeader>

      <div className="container-page py-8">
        {authLoading || q.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : q.isError ? (
          <EmptyState icon={Ticket} title="Não foi possível carregar os bilhetes" description={errorMessage(q.error)} action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>} />
        ) : data?.access === 'login' || data?.access === 'locked' ? (
          <EmptyState
            icon={Lock}
            title="Recurso exclusivo para assinantes"
            description="Os bilhetes prontos do dia ficam disponíveis com qualquer plano ativo."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link to="/planos">Assine para liberar</Link>
                </Button>
                {data.access === 'login' && (
                  <Button asChild variant="outline">
                    <Link to="/auth" search={{ redirect: location.href }}>
                      Entrar
                    </Link>
                  </Button>
                )}
              </div>
            }
          />
        ) : data?.access === 'granted' && data.content?.bilhetes.length ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {data.content.bilhetes.length} bilhete(s) · {data.content.fixtures_considered} partida(s) analisada(s) · gerado em {formatDateTime(data.content.generated_at)}
              </p>
              {data.isAdmin && (
                <Button variant="outline" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                  <RefreshCw className={generate.isPending ? 'animate-spin' : ''} /> Gerar de novo
                </Button>
              )}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {data.content.bilhetes.map((t, i) => (
                <TicketCard key={i} ticket={t} />
              ))}
            </div>
            {data.content.observacoes.length > 0 && (
              <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
                  <ShieldAlert className="size-4" /> Observações
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {data.content.observacoes.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Ticket}
            title={data?.access === 'granted' && data.status === 'generating' ? 'Os bilhetes estão sendo gerados' : 'Os bilhetes deste dia ainda não foram publicados'}
            description="Os bilhetes são montados depois que as análises do dia ficam prontas. Volte mais tarde."
            action={
              data?.access === 'granted' && data.isAdmin ? (
                <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                  <RefreshCw className={generate.isPending ? 'animate-spin' : ''} /> Gerar bilhetes agora
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to="/jogos" search={{ data: search.data }}>
                    Ver jogos do dia
                  </Link>
                </Button>
              )
            }
          />
        )}

        <p className="mt-8 rounded-xl bg-muted/70 p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Como ler:</strong> a odd total multiplica as odds informadas pela fonte no momento da análise e muda até o início dos jogos. A
          “chance combinada” multiplica as probabilidades estimadas, supondo jogos independentes — é uma estimativa, não uma certeza. Bilhetes informativos: não há garantia de
          lucro.
        </p>
        <RiskNotice className="mt-6" />
      </div>
    </>
  )
}

function TicketCard({ ticket }: { ticket: ReadyTicket }) {
  const style = RISK_STYLE[ticket.risco]
  return (
    <article className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className={cn('absolute inset-y-0 left-0 w-1.5', style.bar)} aria-hidden />
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5 pl-6">
        <div>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', style.badge)}>{RISK_LABELS[ticket.risco]}</span>
          <h2 className="mt-2 font-display text-xl font-bold text-brand-dark">{ticket.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{ticket.resumo}</p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="rounded-xl bg-brand-dark px-3 py-2 text-white">
            <p className="text-[10px] font-semibold tracking-wide uppercase opacity-80">Odd total</p>
            <p className="font-display text-xl font-bold tabular">{ticket.odd_total != null ? formatNumber(ticket.odd_total) : '—'}</p>
          </div>
          <div className="rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
            <p className="text-[10px] font-semibold tracking-wide uppercase opacity-80">Chance comb.</p>
            <p className="font-display text-xl font-bold tabular">{ticket.probabilidade_combinada != null ? `${formatNumber(ticket.probabilidade_combinada, 1)}%` : '—'}</p>
          </div>
        </div>
      </header>
      <ol className="divide-y">
        {ticket.selecoes.map((s) => (
          <li key={s.fixture_id} className="p-5 pl-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3" /> {s.horario} · {s.liga}
                </p>
                <Link to="/jogo/$id" params={{ id: String(s.fixture_id) }} className="font-semibold hover:underline">
                  {s.jogo}
                </Link>
                <p className="mt-0.5 text-sm font-semibold text-primary">{s.mercado}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-lg font-bold tabular">{s.odd != null ? formatNumber(s.odd) : '—'}</p>
                <p className="text-[11px] text-muted-foreground">{s.odd != null ? `odd · ${s.casa_de_apostas}` : 'odd não informada'}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground/85">{s.justificativa}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {s.probabilidade_estimada != null && <Badge variant="secondary">Estimativa: {s.probabilidade_estimada}%</Badge>}
              {s.probabilidade_implicita != null && <Badge variant="outline">Implícita na odd: {formatNumber(s.probabilidade_implicita, 1)}%</Badge>}
            </div>
          </li>
        ))}
      </ol>
      <footer className="flex items-center gap-2 border-t bg-muted/40 px-6 py-3 text-xs text-muted-foreground">
        <Layers className="size-3.5" /> {ticket.selecoes.length} seleç{ticket.selecoes.length === 1 ? 'ão' : 'ões'} · bilhete informativo, sem garantia de lucro
      </footer>
    </article>
  )
}
