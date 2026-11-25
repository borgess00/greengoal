import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowDownUp, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Flag, Globe, MapPin, UserRound } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/common/empty-state'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { FinishedMatchStats, ResultEvents, useMatchResult } from '@/components/results/match-result-view'
import { MarketPicker, canBet } from '@/components/slips/market-picker'
import { FormBadges } from '@/components/stats/form-badges'
import { FormDashes } from '@/components/stats/form-dashes'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/select-native'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { countryLabel, groupFixtures } from '@/lib/fixture-groups'
import { isFinished, isLive, statusLabel, VOID } from '@/lib/fixture-status'
import { addDays, currentGradeDate, formatGradeDate, isValidDate, relativeGradeLabel } from '@/lib/grade'
import { seo } from '@/lib/seo'
import type { FixtureRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getGradeFixtures } from '@/server/fixtures.functions'

const STATUS = ['todos', 'ao-vivo', 'proximos', 'encerrados'] as const
type StatusFilter = (typeof STATUS)[number]

const searchSchema = z.object({
  data: z.string().refine(isValidDate).optional().catch(undefined),
  pais: z.string().max(60).optional().catch(undefined),
  liga: z.coerce.number().int().positive().optional().catch(undefined),
  ordem: z.enum(['asc', 'desc']).optional().catch(undefined),
  status: z.enum(STATUS).optional().catch(undefined),
  jogo: z.coerce.number().int().positive().optional().catch(undefined),
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
      title: 'Partidas',
      description: 'Partidas do dia ao vivo, próximas e encerradas, com horário de Brasília, forma recente, resultados e estatísticas finais. Organizadas por país e competição.',
      path: '/jogos',
    }),
  component: JogosPage,
})

function statusOf(f: FixtureRow): Exclude<StatusFilter, 'todos'> | 'outro' {
  if (isLive(f.status_short)) return 'ao-vivo'
  if (isFinished(f.status_short)) return 'encerrados'
  if (VOID.has(f.status_short)) return 'outro'
  return 'proximos'
}

function JogosPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/jogos' })
  const { data, isLoading, isFetching, isError, refetch } = useQuery({ ...gradeQuery(search.data), placeholderData: keepPreviousData })
  const date = data?.date ?? search.data ?? currentGradeDate()
  const order = search.ordem ?? 'asc'
  const status = search.status ?? 'todos'

  const priority = React.useMemo(() => new Map((data?.leagues ?? []).map((l) => [l.id, l.priority])), [data])
  const all = data?.fixtures ?? []

  const counts = React.useMemo(() => {
    const c = { todos: all.length, 'ao-vivo': 0, proximos: 0, encerrados: 0 }
    for (const f of all) {
      const s = statusOf(f)
      if (s !== 'outro') c[s]++
    }
    return c
  }, [all])

  const countries = React.useMemo(() => groupFixtures(all, priority).map((g) => ({ name: g.country, total: g.total })), [all, priority])
  const leagues = React.useMemo(
    () =>
      groupFixtures(all, priority)
        .filter((g) => !search.pais || g.country === search.pais)
        .flatMap((g) => g.leagues.map((l) => ({ id: l.leagueId, name: l.leagueName, country: g.country, total: l.fixtures.length }))),
    [all, priority, search.pais],
  )

  const filtered = React.useMemo(
    () =>
      all.filter(
        (f) =>
          (!search.pais || countryLabel(f.league_country) === search.pais) &&
          (!search.liga || f.league_id === search.liga) &&
          (status === 'todos' || statusOf(f) === status),
      ),
    [all, search.pais, search.liga, status],
  )
  const groups = React.useMemo(() => groupFixtures(filtered, priority, order), [filtered, priority, order])
  // Competições para a coluna de filtros: respeita só a situação escolhida.
  const byStatus = React.useMemo(() => all.filter((f) => status === 'todos' || statusOf(f) === status), [all, status])
  const statusGroups = React.useMemo(() => groupFixtures(byStatus, priority), [byStatus, priority])
  const statusTotal = byStatus.length
  const ordered = React.useMemo(() => groups.flatMap((g) => g.leagues.flatMap((l) => l.fixtures)), [groups])
  const selected = ordered.find((f) => f.id === search.jogo) ?? ordered[0]

  const setDate = (d: string) => navigate({ search: (s) => ({ ...s, data: d === currentGradeDate() ? undefined : d, pais: undefined, liga: undefined, jogo: undefined }) })
  const rel = relativeGradeLabel(date)
  const chip = (s: StatusFilter, label: string) => (
    <button
      key={s}
      type="button"
      role="radio"
      aria-checked={status === s}
      onClick={() => navigate({ search: (x) => ({ ...x, status: s === 'todos' ? undefined : s, jogo: undefined }) })}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
        status === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50',
      )}
    >
      {s === 'ao-vivo' && counts['ao-vivo'] > 0 && <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />}
      {label} <span className="tabular opacity-70">{counts[s]}</span>
    </button>
  )

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Horário de Brasília</p>
          <h1 className="font-display text-3xl font-bold text-brand-dark">Partidas</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <label className="relative">
            <span className="sr-only">Data</span>
            <span className="pointer-events-none flex h-10 min-w-48 items-center justify-center rounded-full border bg-card px-4 text-sm font-semibold">
              {rel && <span className="mr-1 text-primary">{rel} ·</span>}
              {formatGradeDate(date).replace(/^\w/, (c) => c.toUpperCase())}
            </span>
            <input type="date" value={date} onChange={(e) => isValidDate(e.target.value) && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Escolher data" />
          </label>
          <Button size="icon" variant="outline" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Situação das partidas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {chip('todos', 'Todas')}
          {chip('ao-vivo', 'Ao vivo')}
          {chip('proximos', 'Próximas')}
          {chip('encerrados', 'Encerradas')}
        </div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <div className="flex min-w-0 flex-1 gap-2 xl:hidden">
          <NativeSelect aria-label="País" value={search.pais ?? ''} onChange={(e) => navigate({ search: (s) => ({ ...s, pais: e.target.value || undefined, liga: undefined, jogo: undefined }) })} className="h-10 min-w-0 flex-1 sm:w-44">
            <option value="">Todos os países ({all.length})</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.total})
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Liga / competição" value={search.liga ?? ''} onChange={(e) => navigate({ search: (s) => ({ ...s, liga: e.target.value ? Number(e.target.value) : undefined, jogo: undefined }) })} className="h-10 min-w-0 flex-1 sm:w-52">
            <option value="">Todas as competições</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {search.pais ? l.name : `${l.name} · ${l.country}`} ({l.total})
              </option>
            ))}
          </NativeSelect>
          </div>
          <Button variant="outline" size="icon" className="shrink-0" aria-label={order === 'asc' ? 'Mais cedo primeiro (inverter)' : 'Mais tarde primeiro (inverter)'} title={order === 'asc' ? 'Mais cedo primeiro' : 'Mais tarde primeiro'} onClick={() => navigate({ search: (s) => ({ ...s, ordem: order === 'asc' ? 'desc' : undefined }) })}>
            <ArrowDownUp className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <Skeleton className="h-[32rem] rounded-2xl" />
          <Skeleton className="hidden h-[32rem] rounded-2xl lg:block" />
        </div>
      ) : isError ? (
        <EmptyState icon={CalendarDays} title="Não foi possível carregar as partidas" description="Verifique sua conexão e tente novamente." action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />
      ) : !filtered.length ? (
        <EmptyState
          icon={CalendarDays}
          title={search.liga || search.pais || status !== 'todos' ? 'Nenhuma partida com estes filtros nesta data' : 'Nenhuma partida nesta data'}
          description={data?.configured === false ? 'O banco de dados ainda não está conectado.' : 'A lista é atualizada quando os jogos do dia são carregados.'}
          action={
            search.liga || search.pais || status !== 'todos' ? (
              <Button variant="outline" onClick={() => navigate({ search: (s) => ({ ...s, pais: undefined, liga: undefined, status: undefined }) })}>
                Ver todas as partidas
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn('grid items-start gap-5 lg:grid-cols-[minmax(0,26rem)_1fr] xl:grid-cols-[13.5rem_minmax(0,24rem)_1fr]', isFetching && 'opacity-80')}>
          <CompetitionFacets
            groups={statusGroups}
            pais={search.pais}
            liga={search.liga}
            total={statusTotal}
            onPick={(pais, liga) => navigate({ search: (s) => ({ ...s, pais, liga, jogo: undefined }) })}
          />
          <div className="overflow-hidden rounded-2xl border bg-card">
            <p className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{filtered.length}</strong> {filtered.length === 1 ? 'partida' : 'partidas'} em {groups.length} {groups.length === 1 ? 'país' : 'países'}
              </span>
              <Link to="/escanteios" search={{ data: search.data }} className="flex items-center gap-1 font-semibold text-primary hover:underline">
                <Flag className="size-3.5" /> Radar de escanteios
              </Link>
            </p>
            {groups.map((g) => (
              <section key={g.country} aria-labelledby={`pais-${g.country}`}>
                <h2 id={`pais-${g.country}`} className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 font-display text-sm font-bold text-brand-dark">
                  <Globe className="size-4 text-primary" /> {g.country}
                  <span className="ml-auto text-xs font-semibold text-muted-foreground tabular">{g.total}</span>
                </h2>
                {g.leagues.map((l) => (
                  <div key={l.leagueId}>
                    <h3 className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {l.leagueLogo && <img src={l.leagueLogo} alt="" width={16} height={16} className="size-4 object-contain" loading="lazy" />}
                      {l.leagueName}
                    </h3>
                    <ul>
                      {l.fixtures.map((f) => (
                        <MatchRow key={f.id} f={f} active={selected?.id === f.id} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <div className="sticky top-32 hidden lg:block">{selected && <MatchPanel key={selected.id} f={selected} />}</div>
        </div>
      )}
      <RiskNotice className="mt-8" />
    </div>
  )
}

/** Coluna de competições (telas grandes): país e liga com a contagem de jogos. */
function CompetitionFacets({
  groups,
  pais,
  liga,
  total,
  onPick,
}: {
  groups: ReturnType<typeof groupFixtures>
  pais?: string
  liga?: number
  total: number
  onPick: (pais: string | undefined, liga: number | undefined) => void
}) {
  const item = (active: boolean) =>
    cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition', active ? 'bg-secondary font-semibold text-brand-dark' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
  return (
    <nav aria-label="Competições" className="sticky top-32 hidden max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border bg-card p-3 xl:block">
      <p className="mb-2 px-2.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">Competições</p>
      <button type="button" className={item(!pais && !liga)} onClick={() => onPick(undefined, undefined)}>
        <Globe className="size-4 shrink-0" /> <span className="flex-1">Todas</span>
        <span className="text-xs tabular">{total}</span>
      </button>
      {groups.map((g) => (
        <div key={g.country} className="mt-2">
          <button type="button" className={cn(item(pais === g.country && !liga), 'font-semibold')} onClick={() => onPick(g.country, undefined)}>
            <span className="flex-1 truncate">{g.country}</span>
            <span className="text-xs tabular">{g.total}</span>
          </button>
          <ul className="ml-2 border-l pl-1.5">
            {g.leagues.map((l) => (
              <li key={l.leagueId}>
                <button type="button" className={item(liga === l.leagueId)} onClick={() => onPick(g.country, l.leagueId)}>
                  {l.leagueLogo ? <img src={l.leagueLogo} alt="" width={14} height={14} className="size-3.5 shrink-0 object-contain" loading="lazy" /> : <span className="size-3.5 shrink-0" />}
                  <span className="flex-1 truncate">{l.leagueName}</span>
                  <span className="text-xs tabular">{l.fixtures.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Linha da lista. No computador abre o painel ao lado; no celular, a página da partida. */
function MatchRow({ f, active }: { f: FixtureRow; active: boolean }) {
  const navigate = useNavigate({ from: '/jogos' })
  const live = isLive(f.status_short)
  const finished = isFinished(f.status_short)
  const showScore = (live || finished) && f.goals_home != null
  return (
    <li>
      <Link
        to="/jogo/$id"
        params={{ id: String(f.id) }}
        onClick={(e) => {
          if (window.matchMedia('(min-width: 1024px)').matches) {
            e.preventDefault()
            navigate({ search: (s) => ({ ...s, jogo: f.id }), replace: true, resetScroll: false })
          }
        }}
        aria-current={active ? 'true' : undefined}
        aria-label={`${f.home_team_name} x ${f.away_team_name}, ${finished ? 'encerrado' : f.local_time}`}
        className={cn('grid grid-cols-[3.25rem_1fr_auto] items-center gap-2 border-l-2 border-transparent px-4 py-2.5 transition hover:bg-muted/60', active && 'lg:border-primary lg:bg-secondary/70')}
      >
        <span className="text-xs">
          {live ? (
            <span className="font-bold text-red-600 dark:text-red-400">
              {f.elapsed ?? ''}'<span className="block text-[10px] font-semibold">AO VIVO</span>
            </span>
          ) : (
            <span className="text-muted-foreground tabular">
              {f.local_time}
              <span className="block text-[10px] font-semibold">{finished ? 'FT' : VOID.has(f.status_short) ? statusLabel(f.status_short) : ''}</span>
            </span>
          )}
        </span>
        <span className="min-w-0 space-y-1">
          {(['home', 'away'] as const).map((side) => (
            <span key={side} className="flex items-center gap-2 text-sm">
              <TeamCrest name={side === 'home' ? f.home_team_name : f.away_team_name} logo={side === 'home' ? f.home_team_logo : f.away_team_logo} size={18} />
              <span className="truncate font-semibold">{side === 'home' ? f.home_team_name : f.away_team_name}</span>
            </span>
          ))}
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden flex-col gap-2.5 min-[400px]:flex">
            <FormDashes form={f.form_home} />
            <FormDashes form={f.form_away} />
          </span>
          <span className="flex w-5 flex-col items-end gap-1 font-display text-sm font-bold tabular">
            <span>{showScore ? f.goals_home : ''}</span>
            <span>{showScore ? f.goals_away : ''}</span>
          </span>
        </span>
      </Link>
    </li>
  )
}

/** Painel lateral da partida selecionada (computador). */
function MatchPanel({ f }: { f: FixtureRow }) {
  const finished = isFinished(f.status_short)
  const live = isLive(f.status_short)
  const showScore = (finished || live) && f.goals_home != null
  const result = useMatchResult(f.id, finished)
  const events = result.data?.available ? result.data.events : []
  const bettable = canBet(f)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{formatGradeDate(f.grade_date)}</span>
          <span className="flex items-center gap-1.5 truncate">
            {f.league_logo && <img src={f.league_logo} alt="" width={14} height={14} className="size-3.5 object-contain" />}
            {f.league_name}
          </span>
          <Link to="/jogo/$id" params={{ id: String(f.id) }} className="grid size-8 place-items-center rounded-full border hover:bg-muted" aria-label="Abrir página da partida" title="Abrir página da partida">
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamHead name={f.home_team_name} logo={f.home_team_logo} form={f.form_home} />
          <div className="text-center">
            <p className={cn('font-display text-4xl font-bold tabular', live ? 'text-red-600 dark:text-red-400' : 'text-brand-dark')}>
              {showScore ? `${f.goals_home} – ${f.goals_away}` : f.local_time}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {finished ? 'Encerrado' : live ? `${statusLabel(f.status_short)} ${f.elapsed ?? ''}'` : VOID.has(f.status_short) ? statusLabel(f.status_short) : 'Horário de Brasília'}
            </p>
          </div>
          <TeamHead name={f.away_team_name} logo={f.away_team_logo} form={f.form_away} />
        </div>
        <ResultEvents events={events} className="mt-4" />
        {(f.venue || f.referee) && (
          <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            {f.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {f.venue}
              </span>
            )}
            {f.referee && (
              <span className="flex items-center gap-1">
                <UserRound className="size-3.5" /> {f.referee}
              </span>
            )}
          </p>
        )}
      </div>
      <Tabs defaultValue={bettable ? 'bilhete' : 'estatisticas'}>
        <TabsList className="justify-start">
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          {bettable && <TabsTrigger value="bilhete">Montar bilhete</TabsTrigger>}
          <Link to="/jogo/$id" params={{ id: String(f.id) }} hash="estatisticas" className="inline-flex h-full items-center rounded-full px-4 text-sm font-semibold text-muted-foreground hover:text-brand-dark">
            Análise completa →
          </Link>
        </TabsList>
        <TabsContent value="estatisticas">
          {finished ? (
            <FinishedMatchStats fixtureId={f.id} />
          ) : (
            <div className="rounded-xl border bg-card p-5">
              <p className="mb-3 font-display font-bold text-brand-dark">Forma recente</p>
              <div className="space-y-2">
                {[
                  [f.home_team_name, f.home_team_logo, f.form_home],
                  [f.away_team_name, f.away_team_logo, f.form_away],
                ].map(([n, l, form]) => (
                  <div key={n as string} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <TeamCrest name={n as string} logo={l as string | null} size={20} />
                      <span className="truncate">{n as string}</span>
                    </span>
                    {form ? <FormBadges form={form as string} size="sm" /> : <span className="text-xs text-muted-foreground">sem dados ainda</span>}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {live ? 'As estatísticas finais aparecem quando a partida terminar.' : 'Médias dos últimos 5 e 10 jogos, mercados por ângulo e análise na página da partida.'}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/jogo/$id" params={{ id: String(f.id) }} hash="estatisticas">
                  Ver estatísticas completas
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>
        {bettable && (
          <TabsContent value="bilhete">
            <div className="rounded-xl border bg-card p-5">
              <MarketPicker fixture={f} compact />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function TeamHead({ name, logo, form }: { name: string; logo: string | null; form?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamCrest name={name} logo={logo} size={48} />
      <p className="w-full truncate font-display font-bold">{name}</p>
      <FormDashes form={form} />
    </div>
  )
}
