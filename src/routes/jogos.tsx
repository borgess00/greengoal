import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, Flag, Moon, Sun } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { RiskNotice } from '@/components/common/risk-notice'
import { FixtureCard, FixtureCardSkeleton } from '@/components/fixtures/fixture-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select-native'
import { getGradeFixtures } from '@/server/fixtures.functions'
import { addDays, currentGradeDate, formatGradeDate, isValidDate, PERIOD_LABELS, relativeGradeLabel, type Period } from '@/lib/grade'
import { seo } from '@/lib/seo'
import type { FixtureRow } from '@/lib/types'

const searchSchema = z.object({
  data: z.string().refine(isValidDate).optional().catch(undefined),
  liga: z.coerce.number().int().positive().optional().catch(undefined),
  ordem: z.enum(['asc', 'desc']).optional().catch(undefined),
})

const gradeQuery = (date?: string) =>
  queryOptions({
    queryKey: ['grade', date ?? 'atual'],
    queryFn: () => getGradeFixtures({ data: { date } }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

export const Route = createFileRoute('/jogos')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ data: search.data }),
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(gradeQuery(deps.data)),
  head: () =>
    seo({
      title: 'Jogos do dia',
      description: 'Partidas do dia com campeonato, horário de Brasília e link para a análise. Grade separada em Tarde e Noite, com filtro por campeonato.',
      path: '/jogos',
    }),
  component: JogosPage,
})

function JogosPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/jogos' })
  const { data, isLoading, isFetching, isError, refetch } = useQuery({ ...gradeQuery(search.data), placeholderData: keepPreviousData })
  const date = data?.date ?? search.data ?? currentGradeDate()
  const order = search.ordem ?? 'asc'

  const leagues = React.useMemo(() => {
    const map = new Map<number, string>()
    for (const f of data?.fixtures ?? []) map.set(f.league_id, f.league_name)
    const priority = new Map((data?.leagues ?? []).map((l) => [l.id, l.priority]))
    return [...map.entries()].sort((a, b) => (priority.get(a[0]) ?? 999) - (priority.get(b[0]) ?? 999) || a[1].localeCompare(b[1], 'pt-BR'))
  }, [data])

  const filtered = React.useMemo(() => {
    const list = (data?.fixtures ?? []).filter((f) => !search.liga || f.league_id === search.liga)
    return [...list].sort((a, b) => (order === 'asc' ? 1 : -1) * (Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at)))
  }, [data, search.liga, order])

  const groups: Record<Period, FixtureRow[]> = { tarde: [], noite: [] }
  for (const f of filtered) groups[f.period].push(f)

  const setDate = (d: string) => navigate({ search: (s) => ({ ...s, data: d === currentGradeDate() ? undefined : d, liga: undefined }) })
  const rel = relativeGradeLabel(date)

  return (
    <>
      <PageHeader eyebrow="Grade diária · horário de Brasília" title="Jogos do dia" description="Partidas dos campeonatos acompanhados. Toque em um jogo para ver as estatísticas e a análise.">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="white" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 truncate rounded-full sm:flex-none bg-white/10 px-4 py-2 text-center font-semibold ring-1 ring-white/20 backdrop-blur">
            {rel && <span className="mr-1 text-brand-light">{rel} ·</span>}
            {formatGradeDate(date)}
          </div>
          <Button size="icon" variant="white" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </PageHeader>

      <div className="container-page py-8">
        <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" value={date} onChange={(e) => isValidDate(e.target.value) && setDate(e.target.value)} className="sm:w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="liga">Campeonato</Label>
            <NativeSelect id="liga" value={search.liga ?? ''} onChange={(e) => navigate({ search: (s) => ({ ...s, liga: e.target.value ? Number(e.target.value) : undefined }) })}>
              <option value="">Todos os campeonatos ({data?.fixtures.length ?? 0})</option>
              {leagues.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({data?.fixtures.filter((f) => f.league_id === id).length})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ordem">Ordenar por horário</Label>
            <Button id="ordem" variant="outline" className="h-11 rounded-lg" onClick={() => navigate({ search: (s) => ({ ...s, ordem: order === 'asc' ? 'desc' : undefined }) })}>
              <ArrowDownUp /> {order === 'asc' ? 'Mais cedo primeiro' : 'Mais tarde primeiro'}
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-secondary/60 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-secondary-foreground">
            <strong>Como a grade funciona:</strong> Tarde de {PERIOD_LABELS.tarde.range}; Noite de {PERIOD_LABELS.noite.range}. Jogos antes das 08h pertencem à grade do dia anterior.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/escanteios" search={{ data: search.data }}>
              <Flag /> Radar de escanteios
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <FixtureCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <EmptyState icon={CalendarDays} title="Não foi possível carregar os jogos" description="Verifique sua conexão e tente novamente." action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />
        ) : !filtered.length ? (
          <EmptyState
            icon={CalendarDays}
            title={search.liga ? 'Nenhum jogo deste campeonato nesta data' : 'Nenhum jogo nesta data'}
            description={
              data?.configured === false
                ? 'O banco de dados ainda não está conectado.'
                : 'Não há partidas armazenadas para esta grade. A lista é atualizada quando a grade do dia é carregada.'
            }
            action={
              search.liga ? (
                <Button variant="outline" onClick={() => navigate({ search: (s) => ({ ...s, liga: undefined }) })}>
                  Ver todos os campeonatos
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            {(['tarde', 'noite'] as const).map((p) => (
              <section key={p} className="mb-10" aria-labelledby={`periodo-${p}`}>
                <div className="mb-4 flex items-baseline gap-3 border-b pb-2">
                  {p === 'tarde' ? <Sun className="size-5 self-center text-amber-500" /> : <Moon className="size-5 self-center text-brand-dark" />}
                  <h2 id={`periodo-${p}`} className="font-display text-2xl font-bold text-brand-dark">
                    {PERIOD_LABELS[p].title}
                  </h2>
                  <span className="text-sm text-muted-foreground">{PERIOD_LABELS[p].range}</span>
                  <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular text-muted-foreground">{groups[p].length}</span>
                </div>
                {groups[p].length ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groups[p].map((f) => (
                      <FixtureCard key={f.id} fixture={f} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">Sem jogos neste período.</p>
                )}
              </section>
            ))}
          </div>
        )}
        <RiskNotice />
      </div>
    </>
  )
}
