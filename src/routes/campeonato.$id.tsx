import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Trophy } from 'lucide-react'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { LogoImg } from '@/components/common/logo-img'
import { FixtureCard } from '@/components/fixtures/fixture-card'
import { StatTile } from '@/components/stats/stat-compare'
import { countryLabel } from '@/lib/fixture-groups'
import { formatDateTime } from '@/lib/format'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getLeague } from '@/server/teams.functions'

const leagueQuery = (id: number) => queryOptions({ queryKey: ['league', id], queryFn: () => getLeague({ data: { id } }), staleTime: 5 * 60_000 })

export const Route = createFileRoute('/campeonato/$id')({
  loader: async ({ context, params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    const l = await context.queryClient.ensureQueryData(leagueQuery(id))
    if (!l) throw notFound()
    return { name: l.league.name, country: l.league.country }
  },
  head: ({ loaderData, params }) =>
    seo({
      title: loaderData ? `${loaderData.name} — classificação, jogos e médias` : 'Campeonato',
      description: loaderData ? `${loaderData.name}${loaderData.country ? ` (${countryLabel(loaderData.country)})` : ''}: classificação, próximos jogos, resultados e médias de gols.` : 'Classificação e jogos do campeonato.',
      path: `/campeonato/${params.id}`,
    }),
  component: CampeonatoPage,
})

const RESULT: Record<string, { label: string; cls: string }> = {
  W: { label: 'V', cls: 'bg-result-win' },
  D: { label: 'E', cls: 'bg-result-draw' },
  L: { label: 'D', cls: 'bg-result-loss' },
}

function CampeonatoPage() {
  const { id } = Route.useParams()
  const { data: l } = useQuery(leagueQuery(Number(id)))
  if (!l) return null
  const a = l.averages
  return (
    <>
      <section className="hero-pitch relative overflow-hidden text-white">
        <div className="pitch-lines absolute inset-0 opacity-50" aria-hidden />
        <div className="container-page relative flex items-center gap-5 py-8 sm:py-10">
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-lift">
            {l.league.logo ? <LogoImg src={l.league.logo} alt="" width={60} height={60} className="size-14 object-contain" /> : <Trophy className="size-10 text-brand-deep" />}
          </span>
          <div>
            {l.league.country && <p className="text-sm text-emerald-100">{countryLabel(l.league.country)}</p>}
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{l.league.name}</h1>
          </div>
        </div>
      </section>

      <div className="container-page grid items-start gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="classificacao">
            <h2 id="classificacao" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-brand-dark">
              <Trophy className="size-6 text-primary" /> Classificação
            </h2>
            {l.standings.length ? (
              <div className="space-y-4">
                {l.standings.map((group, gi) => (
                  <div key={gi} className="overflow-x-auto rounded-2xl border bg-card">
                    {group[0]?.group && l.standings.length > 1 && <p className="border-b px-4 py-2 text-sm font-bold text-brand-dark">{group[0].group}</p>}
                    <table className="w-full min-w-[34rem] text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left font-semibold">#</th>
                          <th className="px-3 py-2 text-left font-semibold">Time</th>
                          <th className="px-2 py-2 font-semibold">P</th>
                          <th className="px-2 py-2 font-semibold">J</th>
                          <th className="px-2 py-2 font-semibold">V</th>
                          <th className="px-2 py-2 font-semibold">E</th>
                          <th className="px-2 py-2 font-semibold">D</th>
                          <th className="px-2 py-2 font-semibold">SG</th>
                          <th className="px-3 py-2 text-left font-semibold">Forma</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.map((r) => (
                          <tr key={r.teamId} className="hover:bg-muted/50">
                            <td className="px-3 py-2 font-semibold tabular">{r.rank}</td>
                            <td className="px-3 py-2">
                              <Link to="/time/$id" params={{ id: String(r.teamId) }} className="flex items-center gap-2 font-semibold hover:text-primary">
                                <TeamCrest name={r.team} logo={r.logo} size={20} />
                                <span className="truncate">{r.team}</span>
                              </Link>
                            </td>
                            <td className="px-2 py-2 text-center font-display font-bold tabular">{r.points}</td>
                            <td className="px-2 py-2 text-center tabular">{r.played ?? '—'}</td>
                            <td className="px-2 py-2 text-center tabular">{r.win ?? '—'}</td>
                            <td className="px-2 py-2 text-center tabular">{r.draw ?? '—'}</td>
                            <td className="px-2 py-2 text-center tabular">{r.lose ?? '—'}</td>
                            <td className="px-2 py-2 text-center tabular">{r.goalsDiff ?? '—'}</td>
                            <td className="px-3 py-2">
                              <span className="flex gap-0.5">
                                {(r.form ?? '')
                                  .slice(-5)
                                  .split('')
                                  .filter((c) => RESULT[c])
                                  .map((c, i) => (
                                    <span key={i} className={cn('grid size-[18px] place-items-center rounded-full text-[10px] font-bold text-white', RESULT[c].cls)}>
                                      {RESULT[c].label}
                                    </span>
                                  ))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {l.standingsUpdated && <p className="text-xs text-muted-foreground">Atualizada em {formatDateTime(l.standingsUpdated)}. Fonte: API-Football.</p>}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">A classificação aparece quando a automação coletar este campeonato (nos dias em que ele tem jogos).</p>
            )}
          </section>

          <section aria-labelledby="jogos">
            <h2 id="jogos" className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-brand-dark">
              <CalendarDays className="size-6 text-primary" /> Próximos jogos
            </h2>
            {l.upcoming.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {l.upcoming.map((f) => (
                  <FixtureCard key={f.id} fixture={f} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Nenhum jogo carregado para os próximos dias.</p>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-32">
          <section aria-labelledby="medias" className="rounded-2xl border bg-card p-5">
            <h2 id="medias" className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
              <BarChart3 className="size-5 text-primary" /> Médias do campeonato
            </h2>
            {a ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <StatTile icon={<BarChart3 className="size-4" />} label="Gols por jogo" value={a.goals.toLocaleString('pt-BR')} />
                  <StatTile icon={<BarChart3 className="size-4" />} label="+2,5 gols" value={`${a.over25}%`} />
                  <StatTile icon={<BarChart3 className="size-4" />} label="Ambos marcam" value={`${a.btts}%`} />
                  <StatTile icon={<BarChart3 className="size-4" />} label="Mandante vence" value={`${a.homeWin}%`} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Empates {a.draw}% · visitante vence {a.awayWin}%. Base: {a.games} jogo(s) encerrado(s) guardados no site.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">As médias aparecem quando houver jogos encerrados deste campeonato guardados no site.</p>
            )}
          </section>
          {l.results.length > 0 && (
            <section aria-labelledby="resultados" className="rounded-2xl border bg-card p-5">
              <h2 id="resultados" className="mb-2 font-display text-lg font-bold text-brand-dark">
                Resultados
              </h2>
              <ul className="divide-y">
                {l.results.map((f) => (
                  <li key={f.id}>
                    <Link to="/jogo/$id" params={{ id: String(f.id) }} className="block py-2 text-sm hover:text-primary">
                      <span className="flex justify-between gap-2">
                        <span className="truncate">{f.home_team_name}</span>
                        <strong className="tabular">{f.goals_home}</strong>
                      </span>
                      <span className="flex justify-between gap-2">
                        <span className="truncate">{f.away_team_name}</span>
                        <strong className="tabular">{f.goals_away}</strong>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <RiskNotice compact />
        </aside>
      </div>
    </>
  )
}
