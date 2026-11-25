import { createFileRoute, Link, useLocation } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { TeamCrest } from '@/components/common/team-crest'
import { FixtureCard, FixtureCardSkeleton } from '@/components/fixtures/fixture-card'
import { useFavoriteTeams } from '@/components/stats/favorite-star'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { errorMessage } from '@/lib/format'
import { formatGradeDate } from '@/lib/grade'
import { seo } from '@/lib/seo'
import type { FixtureRow } from '@/lib/types'
import { getFavoriteFixtures, toggleFavoriteTeam } from '@/server/favorites.functions'

export const Route = createFileRoute('/favoritos')({
  head: () => seo({ title: 'Favoritos', description: 'Os jogos dos seus times favoritos em um só lugar.', path: '/favoritos' }),
  component: FavoritosPage,
})

function FavoritosPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const teams = useFavoriteTeams()
  const fixtures = useQuery({ queryKey: ['favorite-fixtures', user?.id], queryFn: () => getFavoriteFixtures(), enabled: !!user, staleTime: 60_000 })
  const remove = useMutation({
    mutationFn: (t: { team_id: number; team_name: string; team_logo: string | null }) =>
      toggleFavoriteTeam({ data: { teamId: t.team_id, teamName: t.team_name, teamLogo: t.team_logo, on: false } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-teams'] })
      queryClient.invalidateQueries({ queryKey: ['favorite-fixtures'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const byDate = new Map<string, FixtureRow[]>()
  for (const f of fixtures.data?.fixtures ?? []) byDate.set(f.grade_date, [...(byDate.get(f.grade_date) ?? []), f])

  return (
    <>
      <PageHeader eyebrow="Favoritos" title="Seus times" description="Toque na estrela ao lado do escudo, na página de qualquer partida, para seguir um time. Os jogos dele aparecem aqui." />
      <div className="container-page py-8">
        {loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !user ? (
          <EmptyState
            icon={Star}
            title="Entre para salvar seus favoritos"
            description="Os favoritos ficam guardados na sua conta e aparecem em qualquer aparelho."
            action={
              <Button asChild>
                <Link to="/auth" search={{ redirect: location.href }}>
                  Entrar ou criar conta
                </Link>
              </Button>
            }
          />
        ) : teams.data && !teams.data.ready ? (
          <EmptyState icon={Star} title="Favoritos indisponíveis no momento" description={teams.data.message} />
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-brand-dark">Times que você segue</h2>
              {teams.isLoading ? (
                <Skeleton className="h-10 w-full max-w-md rounded-full" />
              ) : teams.data?.teams.length ? (
                <ul className="flex flex-wrap gap-2">
                  {teams.data.teams.map((t) => (
                    <li key={t.team_id} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-1 pl-2 shadow-soft">
                      <TeamCrest name={t.team_name} logo={t.team_logo} size={22} />
                      <span className="text-sm font-semibold">{t.team_name}</span>
                      <button
                        type="button"
                        onClick={() => remove.mutate(t)}
                        disabled={remove.isPending}
                        className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={`Deixar de seguir ${t.team_name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Star}
                  title="Você ainda não segue nenhum time"
                  description="Abra uma partida e toque na estrela ao lado do escudo do time."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/jogos">
                        <CalendarDays /> Ver jogos do dia
                      </Link>
                    </Button>
                  }
                  className="py-10"
                />
              )}
            </section>
            {!!teams.data?.teams.length && (
              <section>
                <h2 className="mb-3 font-display text-lg font-bold text-brand-dark">Próximos jogos e resultados</h2>
                {fixtures.isLoading ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <FixtureCardSkeleton />
                    <FixtureCardSkeleton />
                  </div>
                ) : byDate.size ? (
                  <div className="space-y-6">
                    {[...byDate.entries()].map(([date, list]) => (
                      <div key={date}>
                        <h3 className="mb-2 text-sm font-bold text-muted-foreground uppercase">{formatGradeDate(date)}</h3>
                        <div className="grid gap-4 md:grid-cols-3">
                          {list.map((f) => (
                            <FixtureCard key={f.id} fixture={f} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                    Nenhum jogo dos seus times entre ontem e os próximos dias já carregados. Os jogos aparecem quando a grade do dia é buscada.
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}
