import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CornerUpRight, Crosshair, Goal, Lightbulb, Lock, RefreshCw, Square } from 'lucide-react'
import { toast } from 'sonner'
import { TeamCrest } from '@/components/common/team-crest'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/format'
import { matchAverages, matchReading, radarValues, summarizeWindow, type GameRow, type GameStats, type WindowSummary } from '@/lib/match-stats'
import type { FixtureRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { collectCornersForFixture } from '@/server/corners.functions'
import { getMatchStats } from '@/server/stats.functions'
import { FormBadges } from './form-badges'
import { ChartLegend, GroupedBars, type BarSeries } from './grouped-bars'
import { RadarChart } from './radar-chart'
import { StatCompare, StatTile } from './stat-compare'

const HOME = 'var(--series-home)'
const AWAY = 'var(--series-away)'

type Fixture = Pick<FixtureRow, 'id' | 'home_team_name' | 'home_team_logo' | 'away_team_name' | 'away_team_logo'>

/** Seção "Estatísticas" da página da partida: carrega, trata acesso e estados. */
export function MatchStatsSection({ fixture, authReady, userKey, redirect }: { fixture: Fixture; authReady: boolean; userKey: string; redirect: string }) {
  const queryClient = useQueryClient()
  const stats = useQuery({
    queryKey: ['match-stats', fixture.id, userKey],
    queryFn: () => getMatchStats({ data: { id: fixture.id } }),
    enabled: authReady,
    staleTime: 5 * 60_000,
  })
  const collect = useMutation({
    mutationFn: () => collectCornersForFixture({ data: { fixtureId: fixture.id } }),
    onSuccess: (r) => {
      toast.success(r.skipped ? 'Esta partida já tem dados coletados.' : `Estatísticas coletadas (${r.apiCalls} consultas à API-Football).`)
      queryClient.invalidateQueries({ queryKey: ['match-stats', fixture.id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <section aria-labelledby="estatisticas" className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="estatisticas" className="flex items-center gap-2 font-display text-2xl font-bold text-brand-dark">
          <BarChart3 className="size-6 text-primary" /> Estatísticas
        </h2>
      </div>
      {!authReady || stats.isLoading ? (
        <div className="space-y-4" aria-label="Carregando estatísticas">
          <Skeleton className="h-11 w-full rounded-full sm:w-96" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : stats.isError ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm">
          <p className="text-muted-foreground">Não foi possível carregar as estatísticas. {errorMessage(stats.error)}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => stats.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : stats.data?.status === 'nodata' ? (
        <div className="rounded-xl border border-dashed bg-card p-6 text-center">
          <p className="font-semibold text-brand-dark">As estatísticas desta partida ainda não foram coletadas.</p>
          <p className="mt-1 text-sm text-muted-foreground">Elas são coletadas automaticamente ao longo do dia, começando pelos campeonatos principais.</p>
          {stats.data.isAdmin && (
            <Button className="mt-4" size="sm" onClick={() => collect.mutate()} disabled={collect.isPending}>
              <RefreshCw className={collect.isPending ? 'animate-spin' : ''} /> Coletar estatísticas agora (admin)
            </Button>
          )}
        </div>
      ) : stats.data?.status === 'locked' ? (
        <LockedStats fixture={fixture} form={stats.data.form} needsLogin={stats.data.needsLogin} redirect={redirect} />
      ) : stats.data?.status === 'ok' ? (
        <MatchStatsPanel fixture={fixture} home={stats.data.home} away={stats.data.away} />
      ) : null}
    </section>
  )
}

function LockedStats({ fixture, form, needsLogin, redirect }: { fixture: Fixture; form: { home: string; away: string }; needsLogin: boolean; redirect: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 shadow-soft">
        <h3 className="mb-3 font-display text-lg font-bold text-brand-dark">Forma recente</h3>
        <FormRow name={fixture.home_team_name} logo={fixture.home_team_logo} form={form.home} />
        <FormRow name={fixture.away_team_name} logo={fixture.away_team_logo} form={form.away} />
      </div>
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="pointer-events-none grid gap-3 p-6 blur-[6px] select-none sm:grid-cols-2" aria-hidden>
          {[70, 45, 85, 60, 90, 50, 65, 80].map((h, i) => (
            <div key={i} className="flex h-16 items-end gap-1.5">
              {[h, h - 20, h - 5, h - 30, h + 5].map((v, j) => (
                <span key={j} className={cn('w-4 rounded-t', j % 2 ? 'bg-series-away/50' : 'bg-series-home/40')} style={{ height: `${Math.max(15, Math.min(100, v))}%` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-white/40 via-white/85 to-white p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-dark text-white shadow-lift">
              <Lock className="size-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-brand-dark">Estatísticas completas para assinantes</h3>
            <p className="mt-1 text-sm text-muted-foreground">Últimos 5 e 10 jogos: gols, finalizações, escanteios, cartões e posse, com gráficos, radar comparativo e leitura da partida.</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild>
                <Link to="/planos">Assine para liberar</Link>
              </Button>
              {needsLogin && (
                <Button asChild variant="ghost">
                  <Link to="/auth" search={{ redirect }}>
                    Já sou assinante — entrar
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormRow({ name, logo, form, record }: { name: string; logo: string | null; form: string; record?: WindowSummary['record'] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 last:border-0">
      <span className="flex min-w-0 items-center gap-2.5">
        <TeamCrest name={name} logo={logo} size={26} />
        <span className="truncate font-semibold">{name}</span>
      </span>
      <span className="flex items-center gap-3">
        {record && (
          <span className="text-xs font-semibold text-muted-foreground tabular">
            {record.v}V {record.e}E {record.d}D
          </span>
        )}
        {form ? <FormBadges form={form} size="sm" /> : <span className="text-xs text-muted-foreground">sem jogos</span>}
      </span>
    </div>
  )
}

const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const detail = (r: GameRow) => `${ddmm(r.date)} · x ${r.opponent} (${r.venue}) · ${r.gf} x ${r.ga}`
const pct = (count: number, games: number) => (games ? Math.round((count / games) * 100) : null)

function seriesOf(home: GameRow[], away: GameRow[], n: number, names: [string, string], pick: (r: GameRow) => number | null): BarSeries[] {
  const pts = (rows: GameRow[]) =>
    rows
      .slice(0, n)
      .reverse()
      .map((r) => ({ value: pick(r), detail: detail(r) }))
  return [
    { name: names[0], color: HOME, points: pts(home) },
    { name: names[1], color: AWAY, points: pts(away) },
  ]
}

const stat = (k: keyof GameStats) => (r: GameRow) => r.stats?.[k] ?? null

export function MatchStatsPanel({ fixture, home, away }: { fixture: Fixture; home: GameRow[]; away: GameRow[] }) {
  const available = Math.max(home.length, away.length)
  const options = [5, 10, ...(available > 10 ? [available] : [])].filter((o, i, a) => a.indexOf(o) === i)
  const [n, setN] = React.useState(available >= 10 ? 10 : 5)
  const h = summarizeWindow(home, n)
  const a = summarizeWindow(away, n)
  const names: [string, string] = [fixture.home_team_name, fixture.away_team_name]
  const legend = [
    { name: names[0], color: HOME },
    { name: names[1], color: AWAY },
  ]
  const reading = matchReading(names[0], names[1], h, a)
  const avg = matchAverages(h, a)
  const show = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
  const statNote =
    h && a ? `Estatística detalhada (finalizações, escanteios, cartões, posse) em ${h.statGames} de ${h.games} jogos do ${names[0]} e ${a.statGames} de ${a.games} do ${names[1]}.` : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Recorte de jogos" className="inline-flex rounded-full bg-muted p-1">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={n === o}
              onClick={() => setN(o)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition',
                n === o ? 'bg-white text-brand-dark shadow-sm' : 'text-muted-foreground hover:text-brand-dark',
              )}
            >
              {o > 10 ? `Todos (${o})` : `Últimos ${o}`}
            </button>
          ))}
        </div>
        <ChartLegend items={legend} />
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="gols">Gols</TabsTrigger>
          <TabsTrigger value="finalizacoes">Finalizações</TabsTrigger>
          <TabsTrigger value="escanteios">Escanteios</TabsTrigger>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={`Forma recente · últimos ${n}`}>
              <FormRow name={names[0]} logo={fixture.home_team_logo} form={home.slice(0, n).map((r) => r.result).join('')} record={h?.record} />
              <FormRow name={names[1]} logo={fixture.away_team_logo} form={away.slice(0, n).map((r) => r.result).join('')} record={a?.record} />
              <p className="mt-2 text-[11px] text-muted-foreground">Do jogo mais recente (à esquerda) para o mais antigo.</p>
              <h4 className="mt-5 mb-2 text-sm font-bold text-brand-dark">Últimos {n} jogos · média por partida</h4>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile icon={<Goal className="size-5" />} label="Gols" value={show(avg.goals)} />
                <StatTile icon={<Crosshair className="size-5" />} label="Finalizações" value={show(avg.shots)} />
                <StatTile icon={<CornerUpRight className="size-5" />} label="Escanteios" value={show(avg.corners)} />
                <StatTile icon={<Square className="size-5 fill-yellow-400 text-yellow-500" />} label="Cartões" value={show(avg.cards)} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Somando os dois times em campo, na média dos recortes das duas equipes.</p>
            </Panel>
            <Panel title="Comparativo por jogo">
              <StatCompare label="Gols marcados" home={h?.goalsFor ?? null} away={a?.goalsFor ?? null} digits={2} />
              <StatCompare label="Gols sofridos" home={h?.goalsAgainst ?? null} away={a?.goalsAgainst ?? null} digits={2} lowerIsBetter />
              <StatCompare label="Finalizações" home={h?.shots ?? null} away={a?.shots ?? null} />
              <StatCompare label="Escanteios a favor" home={h?.cornersFor ?? null} away={a?.cornersFor ?? null} />
              <StatCompare label="Cartões amarelos" home={h?.yellow ?? null} away={a?.yellow ?? null} lowerIsBetter />
              <StatCompare label="Posse de bola" home={h?.possession ?? null} away={a?.possession ?? null} digits={0} suffix="%" />
            </Panel>
          </div>
          <Panel title="Gols marcados por jogo" subtitle={`Últimos ${n} jogos de cada equipe, do mais antigo ao mais recente.`}>
            <GroupedBars series={seriesOf(home, away, n, names, (r) => r.gf)} unit="gol(s)" ariaLabel="Gols marcados por jogo de cada equipe" />
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Radar comparativo">
              <RadarChart
                series={[
                  { name: names[0], color: HOME, values: radarValues(h) },
                  { name: names[1], color: AWAY, values: radarValues(a) },
                ]}
              />
            </Panel>
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-secondary to-white p-5 shadow-soft">
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
                <Lightbulb className="size-5 text-primary" /> Leitura da partida
              </h3>
              {reading.length ? (
                <ul className="space-y-2 text-sm leading-relaxed">
                  {reading.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Dados insuficientes para uma leitura comparativa.</p>
              )}
              <p className="mt-4 text-[11px] text-muted-foreground">Texto automático gerado só com os números acima. Não é recomendação nem garantia de resultado.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gols" className="space-y-4">
          <Panel title="Gols">
            <StatCompare label="Marcados por jogo" home={h?.goalsFor ?? null} away={a?.goalsFor ?? null} digits={2} />
            <StatCompare label="Sofridos por jogo" home={h?.goalsAgainst ?? null} away={a?.goalsAgainst ?? null} digits={2} lowerIsBetter />
            <StatCompare label="Total de gols no jogo" home={h?.goalsTotal ?? null} away={a?.goalsTotal ?? null} digits={2} />
            <StatCompare label="Mais de 1,5 gols" hint="% dos jogos" home={h ? pct(h.over15, h.games) : null} away={a ? pct(a.over15, a.games) : null} digits={0} suffix="%" />
            <StatCompare label="Mais de 2,5 gols" hint="% dos jogos" home={h ? pct(h.over25, h.games) : null} away={a ? pct(a.over25, a.games) : null} digits={0} suffix="%" />
            <StatCompare label="Ambos marcam" hint="% dos jogos" home={h ? pct(h.btts, h.games) : null} away={a ? pct(a.btts, a.games) : null} digits={0} suffix="%" />
            <StatCompare label="Sem sofrer gol" hint="% dos jogos" home={h ? pct(h.cleanSheets, h.games) : null} away={a ? pct(a.cleanSheets, a.games) : null} digits={0} suffix="%" />
            <StatCompare label="Sem marcar" hint="% dos jogos" home={h ? pct(h.failedToScore, h.games) : null} away={a ? pct(a.failedToScore, a.games) : null} digits={0} suffix="%" lowerIsBetter />
          </Panel>
          <Panel title="Total de gols em cada jogo" subtitle="Soma dos gols das duas equipes em campo.">
            <GroupedBars series={seriesOf(home, away, n, names, (r) => r.gf + r.ga)} unit="gol(s) no jogo" ariaLabel="Total de gols em cada jogo" />
          </Panel>
        </TabsContent>

        <TabsContent value="finalizacoes" className="space-y-4">
          <Panel title="Finalizações" subtitle={statNote ?? undefined}>
            <StatCompare label="Finalizações por jogo" home={h?.shots ?? null} away={a?.shots ?? null} />
            <StatCompare label="No alvo por jogo" home={h?.shotsOn ?? null} away={a?.shotsOn ?? null} />
            <StatCompare label="Cedidas por jogo" home={h?.shotsAgainst ?? null} away={a?.shotsAgainst ?? null} lowerIsBetter />
            <StatCompare label="Aproveitamento" hint="gols a cada 100 finalizações" home={h?.conversion ?? null} away={a?.conversion ?? null} suffix="%" />
          </Panel>
          <Panel title="Finalizações em cada jogo">
            <GroupedBars series={seriesOf(home, away, n, names, stat('shots'))} unit="finalização(ões)" ariaLabel="Finalizações por jogo" />
          </Panel>
        </TabsContent>

        <TabsContent value="escanteios" className="space-y-4">
          <Panel title="Escanteios" subtitle={statNote ?? undefined}>
            <StatCompare label="A favor por jogo" home={h?.cornersFor ?? null} away={a?.cornersFor ?? null} />
            <StatCompare label="Contra por jogo" home={h?.cornersAgainst ?? null} away={a?.cornersAgainst ?? null} />
            <StatCompare label="Total no jogo" home={h?.cornersTotal ?? null} away={a?.cornersTotal ?? null} />
            <StatCompare label="Jogos com 5+ a favor" hint="% dos jogos com estatística" home={h ? pct(h.corners5Plus, h.statGames) : null} away={a ? pct(a.corners5Plus, a.statGames) : null} digits={0} suffix="%" />
          </Panel>
          <Panel title="Escanteios a favor em cada jogo">
            <GroupedBars series={seriesOf(home, away, n, names, stat('cornersFor'))} unit="escanteio(s)" ariaLabel="Escanteios a favor por jogo" />
          </Panel>
        </TabsContent>

        <TabsContent value="cartoes" className="space-y-4">
          <Panel title="Cartões" subtitle={statNote ?? undefined}>
            <StatCompare label="Amarelos por jogo" home={h?.yellow ?? null} away={a?.yellow ?? null} lowerIsBetter />
            <StatCompare label="Vermelhos por jogo" home={h?.red ?? null} away={a?.red ?? null} digits={2} lowerIsBetter />
            <StatCompare label="Cartões no jogo" hint="somando as duas equipes" home={h?.cardsTotal ?? null} away={a?.cardsTotal ?? null} />
            <StatCompare label="Faltas por jogo" home={h?.fouls ?? null} away={a?.fouls ?? null} lowerIsBetter />
          </Panel>
          <Panel title="Cartões amarelos em cada jogo">
            <GroupedBars series={seriesOf(home, away, n, names, stat('yellow'))} unit="amarelo(s)" ariaLabel="Cartões amarelos por jogo" />
          </Panel>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2">
        <GamesList title={names[0]} logo={fixture.home_team_logo} rows={home.slice(0, n)} />
        <GamesList title={names[1]} logo={fixture.away_team_logo} rows={away.slice(0, n)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Fonte: API-Football. Médias por jogo calculadas só com as partidas que têm o dado; quando a fonte não traz um número, ele aparece como “—”.
      </p>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <h3 className="font-display text-lg font-bold text-brand-dark">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function GamesList({ title, logo, rows }: { title: string; logo: string | null; rows: GameRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-brand-dark">
        <TeamCrest name={title} logo={logo} size={22} /> Últimos jogos — {title}
      </h3>
      {rows.length ? (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.fixtureId} className="flex items-center gap-3 py-2">
              <span className="w-11 shrink-0 text-xs text-muted-foreground tabular">{ddmm(r.date)}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <TeamCrest name={r.opponent} logo={r.opponentLogo} size={18} />
                <span className="truncate">
                  {r.venue === 'casa' ? 'x' : '@'} {r.opponent}
                </span>
              </span>
              <span className="font-display font-bold tabular">
                {r.gf} x {r.ga}
              </span>
              <FormBadges form={r.result} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sem jogos recentes na fonte.</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">“x” = em casa · “@” = fora.</p>
    </div>
  )
}
