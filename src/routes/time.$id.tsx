import * as React from 'react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, CalendarDays, Crosshair, Goal, Lock, Square, Trophy } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { LogoImg } from '@/components/common/logo-img'
import { FixtureCard } from '@/components/fixtures/fixture-card'
import { FavoriteStar } from '@/components/stats/favorite-star'
import { FormBadges } from '@/components/stats/form-badges'
import { StatTile } from '@/components/stats/stat-compare'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { summarizeWindow, type GameRow } from '@/lib/match-stats'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getTeam } from '@/server/teams.functions'

const teamQuery = (id: number, user: string) => queryOptions({ queryKey: ['team', id, user], queryFn: () => getTeam({ data: { id } }), staleTime: 5 * 60_000 })

export const Route = createFileRoute('/time/$id')({
  loader: async ({ context, params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    const t = await context.queryClient.ensureQueryData(teamQuery(id, 'anon'))
    if (!t) throw notFound()
    return { name: t.team.name, league: t.team.leagueName }
  },
  head: ({ loaderData, params }) =>
    seo({
      title: loaderData ? `${loaderData.name} — forma, jogos e estatísticas` : 'Time',
      description: loaderData
        ? `${loaderData.name}${loaderData.league ? ` (${loaderData.league})` : ''}: forma recente, últimos resultados, próximos jogos e médias de gols, finalizações, escanteios e cartões.`
        : 'Forma recente, jogos e estatísticas do time.',
      path: `/time/${params.id}`,
    }),
  component: TimePage,
})

const fmt = (v: number | null | undefined, d = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))
const pct = (c: number, n: number) => (n ? `${Math.round((c / n) * 100)}%` : '—')
const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

function TimePage() {
  const { id: idParam } = Route.useParams()
  const id = Number(idParam)
  const { user, loading } = useAuth()
  const q = useQuery({ ...teamQuery(id, user?.id ?? 'anon'), enabled: !loading })
  const anon = useQuery({ ...teamQuery(id, 'anon') })
  const t = q.data ?? anon.data
  const [n, setN] = React.useState(10)
  if (!t) return null
  const s = summarizeWindow(t.games, n)
  const games: GameRow[] = t.games.slice(0, n)

  return (
    <>
      <section className="hero-pitch relative overflow-hidden text-white">
        <div className="pitch-lines absolute inset-0 opacity-50" aria-hidden />
        <div className="container-page relative flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:py-10">
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-lift">
            <TeamCrest name={t.team.name} logo={t.team.logo} size={60} />
          </span>
          <div className="min-w-0 flex-1">
            {t.team.leagueId && (
              <Link to="/campeonato/$id" params={{ id: String(t.team.leagueId) }} className="flex items-center gap-1.5 text-sm text-emerald-100 hover:text-white">
                {t.team.leagueLogo && <LogoImg src={t.team.leagueLogo} alt="" width={16} height={16} className="size-4 rounded bg-white object-contain p-0.5" />}
                {t.team.leagueName}
              </Link>
            )}
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{t.team.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-emerald-50/85">
              {t.games.length > 0 && <FormBadges form={t.games.slice(0, 5).map((g) => g.result).join('')} size="sm" />}
              {t.standing && (
                <span className="flex items-center gap-1.5">
                  <Trophy className="size-4" /> {t.standing.rank}º lugar · {t.standing.points} pontos{t.standing.played ? ` em ${t.standing.played} jogos` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FavoriteStar teamId={t.team.id} teamName={t.team.name} teamLogo={t.team.logo} className="size-10" />
            <Button asChild variant="white" size="sm">
              <Link to="/comparar" search={{ a: t.team.id }}>
                <ArrowLeftRight /> Comparar
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container-page space-y-10 py-8">
        <section aria-labelledby="proximos">
          <h2 id="proximos" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-brand-dark">
            <CalendarDays className="size-6 text-primary" /> Próximos jogos
          </h2>
          {t.upcoming.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.upcoming.map((f) => (
                <FixtureCard key={f.id} fixture={f} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Nenhum jogo carregado para os próximos dias. Os jogos aparecem quando a grade de cada dia é buscada.</p>
          )}
        </section>

        {t.games.length ? (
          <section aria-labelledby="medias">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="medias" className="font-display text-2xl font-bold text-brand-dark">
                Médias dos últimos {Math.min(n, t.games.length)} jogos
              </h2>
              <div role="radiogroup" aria-label="Recorte" className="inline-flex rounded-full bg-muted p-1">
                {[5, 10].map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={n === o} onClick={() => setN(o)} className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', n === o ? 'bg-card text-brand-dark shadow-sm' : 'text-muted-foreground')}>
                    Últimos {o}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile icon={<Goal className="size-5" />} label="Gols marcados" value={fmt(s?.goalsFor, 2)} sub="por jogo" />
              <StatTile icon={<Goal className="size-5" />} label="Gols sofridos" value={fmt(s?.goalsAgainst, 2)} sub="por jogo" />
              <StatTile icon={<Goal className="size-5" />} label="Mais de 2,5 gols" value={s ? pct(s.over25, s.games) : '—'} sub="dos jogos" />
              <StatTile icon={<Goal className="size-5" />} label="Ambos marcam" value={s ? pct(s.btts, s.games) : '—'} sub="dos jogos" />
            </div>
            {t.pro ? (
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile icon={<Crosshair className="size-5" />} label="Finalizações" value={fmt(s?.shots)} sub={`por jogo · ${s?.statGames ?? 0} com estatística`} />
                <StatTile icon={<Crosshair className="size-5" />} label="Escanteios a favor" value={fmt(s?.cornersFor)} sub="por jogo" />
                <StatTile icon={<Square className="size-5 fill-yellow-400 text-yellow-500" />} label="Cartões amarelos" value={fmt(s?.yellow)} sub="por jogo" />
                <StatTile icon={<Crosshair className="size-5" />} label="Posse de bola" value={s?.possession != null ? `${s.possession}%` : '—'} sub="média" />
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="size-4" /> Finalizações, escanteios, cartões e posse do time ficam no GreenGoal Pro.
                </p>
                <Button asChild size="sm">
                  <Link to="/planos">Ver planos</Link>
                </Button>
              </div>
            )}
          </section>
        ) : (
          <EmptyState icon={Goal} title="Ainda sem jogos recentes coletados" description="Os números do time aparecem depois que alguma partida dele tiver as estatísticas coletadas." />
        )}

        {games.length > 0 && (
          <section aria-labelledby="ultimos">
            <h2 id="ultimos" className="mb-4 font-display text-2xl font-bold text-brand-dark">
              Últimos jogos
            </h2>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {games.map((g) => (
                <li key={g.fixtureId} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground tabular">{ddmm(g.date)}</span>
                  <span className="hidden w-40 truncate text-xs text-muted-foreground sm:block">{g.league}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <TeamCrest name={g.opponent} logo={g.opponentLogo} size={20} />
                    <span className="truncate">
                      {g.venue === 'casa' ? 'x' : '@'} {g.opponent}
                    </span>
                  </span>
                  <span className="font-display font-bold tabular">
                    {g.gf} x {g.ga}
                  </span>
                  <FormBadges form={g.result} size="sm" />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">“x” = em casa · “@” = fora. Fonte: API-Football.</p>
          </section>
        )}
        <RiskNotice />
      </div>
    </>
  )
}
