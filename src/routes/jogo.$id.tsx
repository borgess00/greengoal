import { createFileRoute, Link, notFound, useLocation } from '@tanstack/react-router'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Clock, FileClock, MapPin, RefreshCw, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { AnalysisView } from '@/components/analysis/analysis-view'
import { AnalysisLock } from '@/components/analysis/analysis-lock'
import { EmptyState } from '@/components/common/empty-state'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { isFinished, isLive, statusLabel } from '@/lib/fixture-status'
import { errorMessage } from '@/lib/format'
import { formatGradeDate, spParts } from '@/lib/grade'
import { seo } from '@/lib/seo'
import { getFixture } from '@/server/fixtures.functions'
import { generateAnalysis, getAnalysisAccess } from '@/server/analysis.functions'

const fixtureQuery = (id: number) => queryOptions({ queryKey: ['fixture', id], queryFn: () => getFixture({ data: { id } }), staleTime: 60_000 })

export const Route = createFileRoute('/jogo/$id')({
  params: {
    parse: (p) => ({ id: p.id }),
    stringify: (p) => ({ id: p.id }),
  },
  loader: async ({ context, params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    const fixture = await context.queryClient.ensureQueryData(fixtureQuery(id))
    if (!fixture) throw notFound()
    return { title: `${fixture.home_team_name} x ${fixture.away_team_name}`, league: fixture.league_name, date: fixture.grade_date, time: fixture.local_time }
  },
  head: ({ loaderData, params }) =>
    loaderData
      ? seo({
          title: `${loaderData.title} — análise e estatísticas`,
          description: `${loaderData.title} pelo ${loaderData.league}, ${formatGradeDate(loaderData.date).toLowerCase()} às ${loaderData.time} (Brasília). Confrontos diretos, forma recente, gols, cartões e finalizadores.`,
          path: `/jogo/${params.id}`,
        })
      : seo({ title: 'Partida', description: 'Análise e estatísticas da partida.', path: `/jogo/${params.id}` }),
  component: JogoPage,
})

function JogoPage() {
  const { id: idParam } = Route.useParams()
  const id = Number(idParam)
  const { data: fixture } = useQuery(fixtureQuery(id))
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()

  const access = useQuery({
    queryKey: ['analysis', id, user?.id ?? 'anon'],
    queryFn: () => getAnalysisAccess({ data: { fixtureId: id } }),
    enabled: !authLoading,
    staleTime: 60_000,
  })

  const regenerate = useMutation({
    mutationFn: () => generateAnalysis({ data: { fixtureId: id, force: true } }),
    onSuccess: (r) => {
      if (r.ok) toast.success('Análise gerada.')
      else if ('limitReached' in r && r.limitReached) toast.error(`Limite diário de IA atingido (${r.used}/${r.limit}).`)
      else toast.error('error' in r ? r.error : 'Falha ao gerar.')
      queryClient.invalidateQueries({ queryKey: ['analysis', id] })
      queryClient.invalidateQueries({ queryKey: ['fixture', id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!fixture) return null
  const finished = isFinished(fixture.status_short)
  const live = isLive(fixture.status_short)
  const showScore = (finished || live) && fixture.goals_home != null
  const kickoff = spParts(fixture.kickoff_at)

  return (
    <>
      <section className="hero-pitch relative overflow-hidden text-white">
        <div className="pitch-lines absolute inset-0 opacity-60" aria-hidden />
        <div className="container-page relative py-8 sm:py-12">
          <Link to="/jogos" search={{ data: fixture.grade_date }} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-100 hover:text-white">
            <ArrowLeft className="size-4" /> Jogos de {formatGradeDate(fixture.grade_date).toLowerCase()}
          </Link>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
            {fixture.league_logo && <img src={fixture.league_logo} alt="" width={22} height={22} className="size-5 rounded bg-white object-contain p-0.5" />}
            <span className="font-semibold">{fixture.league_name}</span>
            {fixture.league_round && <span className="text-emerald-100/80">· {fixture.league_round}</span>}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
            <TeamBlock name={fixture.home_team_name} logo={fixture.home_team_logo} label="Mandante" />
            <div className="text-center">
              {showScore ? (
                <p className="font-display text-4xl font-bold tabular sm:text-6xl">
                  {fixture.goals_home} <span className="text-brand-light">x</span> {fixture.goals_away}
                </p>
              ) : (
                <p className="font-display text-3xl font-bold tabular sm:text-5xl">{fixture.local_time}</p>
              )}
              <Badge variant={live ? 'danger' : 'outline'} className="mt-2 border-white/30 bg-white/10 text-white">
                {statusLabel(fixture.status_short)}
                {live && fixture.elapsed ? ` ${fixture.elapsed}'` : ''}
              </Badge>
            </div>
            <TeamBlock name={fixture.away_team_name} logo={fixture.away_team_logo} label="Visitante" />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-emerald-50/85">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {kickoff.date.split('-').reverse().join('/')}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> {fixture.local_time} (Brasília)
            </span>
            {fixture.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {fixture.venue}
              </span>
            )}
            {fixture.referee && (
              <span className="flex items-center gap-1.5">
                <UserRound className="size-4" /> Árbitro: {fixture.referee}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="container-page py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-brand-dark">Análise da partida</h2>
          {access.data?.access === 'granted' && access.data.isAdmin && (
            <Button variant="outline" size="sm" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
              <RefreshCw className={regenerate.isPending ? 'animate-spin' : ''} />
              {access.data.analysis ? 'Gerar de novo' : 'Gerar análise'}
            </Button>
          )}
        </div>

        {authLoading || access.isLoading ? (
          <div className="space-y-4" aria-label="Carregando análise">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        ) : access.isError ? (
          <EmptyState icon={RefreshCw} title="Não foi possível carregar a análise" description={errorMessage(access.error)} action={<Button onClick={() => access.refetch()}>Tentar novamente</Button>} />
        ) : access.data?.access === 'login' || access.data?.access === 'locked' ? (
          <AnalysisLock needsLogin={access.data.access === 'login'} redirect={location.href} />
        ) : access.data?.access === 'granted' && access.data.analysis?.content ? (
          <AnalysisView content={access.data.analysis.content} home={fixture.home_team_name} away={fixture.away_team_name} />
        ) : (
          <EmptyState
            icon={FileClock}
            title="A análise desta partida ainda não foi publicada"
            description="As análises são publicadas ao longo do dia. Volte mais tarde para conferir."
            action={
              <Button asChild variant="outline">
                <Link to="/jogos" search={{ data: fixture.grade_date }}>
                  Ver outros jogos
                </Link>
              </Button>
            }
          />
        )}

        <RiskNotice className="mt-8" />
      </div>
    </>
  )
}

function TeamBlock({ name, logo, label }: { name: string; logo: string | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-white p-2 shadow-lift sm:size-20">
        <TeamCrest name={name} logo={logo} size={56} />
      </div>
      <p className="font-display text-base leading-tight font-bold sm:text-xl">{name}</p>
      <p className="text-[11px] tracking-wider text-emerald-100/70 uppercase">{label}</p>
    </div>
  )
}
