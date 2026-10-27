import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, Flag, Globe } from 'lucide-react'
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
import { countryLabel, groupFixtures } from '@/lib/fixture-groups'
import { addDays, currentGradeDate, formatGradeDate, isValidDate, relativeGradeLabel } from '@/lib/grade'
import { seo } from '@/lib/seo'

const searchSchema = z.object({
  data: z.string().refine(isValidDate).optional().catch(undefined),
  pais: z.string().max(60).optional().catch(undefined),
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
      description: 'Partidas do dia com campeonato, horário de Brasília e link para a análise. Organizadas por país e competição, com filtros.',
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

  const priority = React.useMemo(() => new Map((data?.leagues ?? []).map((l) => [l.id, l.priority])), [data])
  const all = data?.fixtures ?? []

  const countries = React.useMemo(() => groupFixtures(all, priority).map((g) => ({ name: g.country, total: g.total })), [all, priority])

  // Competições disponíveis (respeitando o país escolhido).
  const leagues = React.useMemo(
    () =>
      groupFixtures(all, priority)
        .filter((g) => !search.pais || g.country === search.pais)
        .flatMap((g) => g.leagues.map((l) => ({ id: l.leagueId, name: l.leagueName, country: g.country, total: l.fixtures.length }))),
    [all, priority, search.pais],
  )

  const filtered = React.useMemo(
    () => all.filter((f) => (!search.pais || countryLabel(f.league_country) === search.pais) && (!search.liga || f.league_id === search.liga)),
    [all, search.pais, search.liga],
  )
  const groups = React.useMemo(() => groupFixtures(filtered, priority, order), [filtered, priority, order])

  const setDate = (d: string) => navigate({ search: (s) => ({ ...s, data: d === currentGradeDate() ? undefined : d, pais: undefined, liga: undefined }) })
  const rel = relativeGradeLabel(date)

  return (
    <>
      <PageHeader eyebrow="Horário de Brasília" title="Jogos do dia" description="Partidas do dia organizadas por país e competição. Toque em um jogo para ver as estatísticas e a análise.">
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
        <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" value={date} onChange={(e) => isValidDate(e.target.value) && setDate(e.target.value)} className="sm:w-44" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pais">País</Label>
            <NativeSelect id="pais" value={search.pais ?? ''} onChange={(e) => navigate({ search: (s) => ({ ...s, pais: e.target.value || undefined, liga: undefined }) })}>
              <option value="">Todos os países ({all.length})</option>
              {countries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.total})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="liga">Liga / competição</Label>
            <NativeSelect id="liga" value={search.liga ?? ''} onChange={(e) => navigate({ search: (s) => ({ ...s, liga: e.target.value ? Number(e.target.value) : undefined }) })}>
              <option value="">Todas as competições</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {search.pais ? l.name : `${l.name} · ${l.country}`} ({l.total})
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
            <strong>{filtered.length} {filtered.length === 1 ? 'jogo' : 'jogos'}</strong> em {groups.length} {groups.length === 1 ? 'país' : 'países'} · todos os horários são de Brasília.
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
            title={search.liga || search.pais ? 'Nenhum jogo com estes filtros nesta data' : 'Nenhum jogo nesta data'}
            description={
              data?.configured === false
                ? 'O banco de dados ainda não está conectado.'
                : 'Não há partidas armazenadas para esta data. A lista é atualizada quando os jogos do dia são carregados.'
            }
            action={
              search.liga || search.pais ? (
                <Button variant="outline" onClick={() => navigate({ search: (s) => ({ ...s, pais: undefined, liga: undefined }) })}>
                  Ver todos os jogos
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            {groups.map((g) => (
              <section key={g.country} className="mb-10" aria-labelledby={`pais-${g.country}`}>
                <div className="mb-4 flex items-center gap-3 border-b pb-2">
                  <Globe className="size-5 text-primary" />
                  <h2 id={`pais-${g.country}`} className="font-display text-2xl font-bold text-brand-dark">
                    {g.country}
                  </h2>
                  <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular text-muted-foreground">{g.total}</span>
                </div>
                <div className="space-y-6">
                  {g.leagues.map((l) => (
                    <div key={l.leagueId}>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
                        {l.leagueLogo && <img src={l.leagueLogo} alt="" width={18} height={18} className="size-[18px] object-contain" loading="lazy" />}
                        {l.leagueName}
                        <span className="font-semibold normal-case">· {l.fixtures.length}</span>
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {l.fixtures.map((f) => (
                          <FixtureCard key={f.id} fixture={f} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <RiskNotice />
      </div>
    </>
  )
}
