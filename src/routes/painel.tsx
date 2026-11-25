import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, Crown, Lock, Sparkles, TicketCheck, Trophy } from 'lucide-react'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { FormDashes } from '@/components/stats/form-dashes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { isLive, statusLabel } from '@/lib/fixture-status'
import { formatGradeDate } from '@/lib/grade'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getDashboard, type BigGame, type DashboardData, type PickCard } from '@/server/dashboard.functions'

export const Route = createFileRoute('/painel')({
  head: () =>
    seo({
      title: 'Painel',
      description: 'Destaques do dia com mercados testados por vários ângulos, grandes jogos de hoje, resultados e seus bilhetes. 18+.',
      path: '/painel',
    }),
  component: PainelPage,
})

const pct = (h: number, t: number) => (t ? Math.round((h / t) * 100) : 0)
const rateText = (p: number) => (p >= 70 ? 'text-primary' : p >= 50 ? 'text-amber-600 dark:text-amber-300' : 'text-muted-foreground')
const rateBar = (p: number) => (p >= 70 ? 'bg-primary' : p >= 50 ? 'bg-amber-500' : 'bg-muted-foreground/50')

function PainelPage() {
  const { user, loading } = useAuth()
  const q = useQuery({ queryKey: ['dashboard', user?.id ?? 'anon'], queryFn: () => getDashboard(), enabled: !loading, staleTime: 60_000 })
  const d = q.data

  return (
    <div className="container-page space-y-10 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Painel</p>
          <h1 className="font-display text-3xl font-bold text-brand-dark">{d ? formatGradeDate(d.date) : 'Hoje'}</h1>
        </div>
        {d && !d.pro && (
          <Button asChild>
            <Link to="/planos">
              <Crown /> Obter GreenGoal Pro
            </Link>
          </Button>
        )}
      </div>

      {/* ---------- Destaques do dia ---------- */}
      <Carousel
        title="Destaques do dia"
        subtitle="Mercados mais consistentes entre os ângulos: últimos 10 e 5 jogos, mando, competição e confronto direto."
        loading={!d}
        empty={d && !d.picks.length ? 'Os destaques aparecem quando as estatísticas dos jogos de hoje forem coletadas (a automação faz isso ao longo do dia).' : null}
      >
        {d?.picks.map((p) => <PickCardView key={p.key} p={p} pro={d.pro} />)}
      </Carousel>

      {d && !d.pro && d.picks.length > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-secondary to-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
              <Lock className="size-5 text-primary" /> Veja quais são os mercados
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você está vendo quantas vezes cada linha se cumpriu, mas não qual é. No Pro você vê o mercado, todos os ângulos e as estatísticas completas de {d.picksTotal} destaque(s) de hoje.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link to="/planos">Desbloquear com o Pro</Link>
          </Button>
        </div>
      )}

      {/* ---------- Meus bilhetes + Desempenho ---------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SlipsCard d={d} />
        <PerformanceCard d={d} />
      </div>

      {/* ---------- Grandes jogos ---------- */}
      <Carousel title="Grandes jogos de hoje" link={{ to: '/jogos', label: 'Ver todas as partidas' }} loading={!d} empty={d && !d.bigGames.length ? 'Nenhuma partida por jogar hoje nos campeonatos cobertos.' : null}>
        {d?.bigGames.map((g) => <BigGameCard key={g.id} g={g} />)}
      </Carousel>

      {/* ---------- Resultados ---------- */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-brand-dark">Resultados</h2>
          <Link to="/jogos" search={{ status: 'encerrados' }} className="text-sm font-semibold text-primary hover:underline">
            Ver encerradas
          </Link>
        </div>
        {!d ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : d.results.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {d.results.map((f) => (
              <Link key={f.id} to="/jogo/$id" params={{ id: String(f.id) }} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition hover:border-primary/50">
                <span className="w-11 shrink-0 text-xs font-semibold text-muted-foreground">
                  FT
                  <span className="block text-[10px] font-normal">{f.grade_date === d.date ? 'hoje' : 'ontem'}</span>
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <TeamCrest name={f.home_team_name} logo={f.home_team_logo} size={18} />
                      <span className="truncate font-semibold">{f.home_team_name}</span>
                    </span>
                    <span className="font-display font-bold tabular">{f.goals_home}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <TeamCrest name={f.away_team_name} logo={f.away_team_logo} size={18} />
                      <span className="truncate font-semibold">{f.away_team_name}</span>
                    </span>
                    <span className="font-display font-bold tabular">{f.goals_away}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma partida encerrada entre ontem e hoje nos campeonatos cobertos.</p>
        )}
      </section>

      <RiskNotice />
    </div>
  )
}

function Carousel({
  title,
  subtitle,
  link,
  loading,
  empty,
  children,
}: {
  title: string
  subtitle?: string
  link?: { to: '/jogos'; label: string }
  loading: boolean
  empty: string | null | undefined
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(300, ref.current.clientWidth * 0.8), behavior: 'smooth' })
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold text-brand-dark">{title}</h2>
          <div className="hidden gap-1 sm:flex">
            <button type="button" onClick={() => scroll(-1)} className="grid size-8 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground" aria-label={`Voltar ${title}`}>
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => scroll(1)} className="grid size-8 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground" aria-label={`Avançar ${title}`}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        {link && (
          <Link to={link.to} className="text-sm font-semibold text-primary hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {subtitle && <p className="-mt-1 mb-3 text-sm text-muted-foreground">{subtitle}</p>}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          <Skeleton className="h-52 w-80 shrink-0 rounded-2xl" />
          <Skeleton className="h-52 w-80 shrink-0 rounded-2xl" />
          <Skeleton className="h-52 w-80 shrink-0 rounded-2xl" />
        </div>
      ) : empty ? (
        <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div ref={ref} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
          {children}
        </div>
      )}
    </section>
  )
}

function PickCardView({ p, pro }: { p: PickCard; pro: boolean }) {
  return (
    <Link
      to="/jogo/$id"
      params={{ id: String(p.fixtureId) }}
      hash="estatisticas"
      className="flex w-[19.5rem] shrink-0 snap-start flex-col rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary/50 sm:w-[21rem]"
    >
      <div className="flex items-start gap-3">
        <span className="relative h-9 w-12 shrink-0">
          <TeamCrest name={p.home} logo={p.homeLogo} size={28} className="absolute top-0 left-0" />
          <TeamCrest name={p.away} logo={p.awayLogo} size={28} className="absolute right-0 bottom-0 rounded-full ring-2 ring-card" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display font-bold text-brand-dark">
            {p.home} x {p.away}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {p.league} · hoje {p.localTime}
          </span>
        </span>
      </div>
      <div className={cn('mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold', pro ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground')}>
        {pro && p.market ? (
          <>
            <BarChart3 className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{p.market}</span>
          </>
        ) : (
          <>
            <Lock className="size-3.5 shrink-0" />
            <span className="truncate">Mercado oculto (Pro)</span>
          </>
        )}
        <span className="ml-auto shrink-0 truncate text-muted-foreground">{p.team}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {p.angles.map((a) => {
          const v = pct(a.hits, a.total)
          return (
            <li key={a.label} className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground">
                <span className="font-semibold text-foreground tabular">
                  {a.hits}/{a.total}
                </span>{' '}
                {a.label}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full', rateBar(v))} style={{ width: `${v}%` }} />
              </span>
              <span className={cn('text-right font-bold tabular', rateText(v))}>{v}%</span>
            </li>
          )
        })}
      </ul>
      {p.hiddenAngles > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" /> +{p.hiddenAngles} ângulo(s) a mais no Pro
        </p>
      )}
    </Link>
  )
}

const fmtOdd = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function BigGameCard({ g }: { g: BigGame }) {
  const live = isLive(g.status_short)
  return (
    <Link to="/jogo/$id" params={{ id: String(g.id) }} className="flex w-[19.5rem] shrink-0 snap-start flex-col rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary/50 sm:w-[22rem]">
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        {g.league_logo && <img src={g.league_logo} alt="" width={14} height={14} className="size-3.5 object-contain" />}
        {g.league_name}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <TeamCrest name={g.home_team_name} logo={g.home_team_logo} size={34} />
          <span className="w-full truncate text-sm font-semibold">{g.home_team_name}</span>
          <FormDashes form={g.form_home} />
        </span>
        <span className="text-center">
          {live ? (
            <span className="font-display text-xl font-bold text-red-600 tabular dark:text-red-400">
              {g.goals_home} x {g.goals_away}
            </span>
          ) : (
            <span className="font-display text-lg font-bold text-brand-dark tabular">{g.local_time}</span>
          )}
          <span className="block text-[11px] text-muted-foreground">{live ? `${statusLabel(g.status_short)} ${g.elapsed ?? ''}'` : 'Brasília'}</span>
        </span>
        <span className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <TeamCrest name={g.away_team_name} logo={g.away_team_logo} size={34} />
          <span className="w-full truncate text-sm font-semibold">{g.away_team_name}</span>
          <FormDashes form={g.form_away} />
        </span>
      </div>
      {g.odds && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['1', g.odds.casa],
            ['X', g.odds.empate],
            ['2', g.odds.fora],
          ].map(([k, v]) => (
            <span key={k as string} className="rounded-lg border bg-background px-2 py-1.5">
              <span className="block text-[10px] font-semibold text-muted-foreground">{k}</span>
              <span className="font-display text-sm font-bold text-primary tabular">{fmtOdd(v as number | null)}</span>
            </span>
          ))}
        </div>
      )}
      {g.odds?.bookmaker && <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Odds de referência: {g.odds.bookmaker}</p>}
    </Link>
  )
}

function SlipsCard({ d }: { d: DashboardData | undefined }) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-brand-dark">
          <TicketCheck className="size-5 text-primary" /> Meus bilhetes
        </h2>
        <Link to="/meus-bilhetes" className="text-sm font-semibold text-primary hover:underline">
          Ver todos
        </Link>
      </div>
      {!d ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : !d.loggedIn ? (
        <EmptyCta text="Entre para montar bilhetes no site e acompanhar sozinho se bateram." cta={{ to: '/auth', label: 'Entrar ou criar conta' }} />
      ) : !d.slips || !d.slips.total ? (
        <EmptyCta text="Você ainda não salvou bilhetes. Abra uma partida e toque em “+ Bilhete” nos mercados." cta={{ to: '/jogos', label: 'Montar meu primeiro bilhete' }} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Abertos" value={d.slips.open} />
          <Stat label="Ganhos" value={d.slips.won} tone="win" />
          <Stat label="Perdidos" value={d.slips.lost} tone="loss" />
          <Stat label="Criados hoje" value={d.slips.today} />
        </div>
      )}
    </section>
  )
}

function PerformanceCard({ d }: { d: DashboardData | undefined }) {
  const s = d?.slips
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-brand-dark">
          <Trophy className="size-5 text-primary" /> Desempenho
        </h2>
        <Link to="/meus-bilhetes" search={{ aba: 'desempenho' }} className="text-sm font-semibold text-primary hover:underline">
          Ver desempenho
        </Link>
      </div>
      {!d ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : !s || s.won + s.lost === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
          <Sparkles className="size-8 text-primary" />
          <p className="font-display font-bold text-brand-dark">Faça cada bilhete contar</p>
          <p className="max-w-xs text-sm text-muted-foreground">Quando seus bilhetes forem conferidos, sua taxa de acerto e o resultado em unidades aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Acerto" value={s.hitRate != null ? `${s.hitRate}%` : '—'} />
          <Stat label="Unidades" value={s.units != null ? `${s.units > 0 ? '+' : ''}${s.units.toLocaleString('pt-BR')}u` : '—'} tone={s.units != null ? (s.units >= 0 ? 'win' : 'loss') : undefined} />
          <Stat label="ROI" value={s.roi != null ? `${s.roi.toLocaleString('pt-BR')}%` : '—'} tone={s.roi != null ? (s.roi >= 0 ? 'win' : 'loss') : undefined} />
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'win' | 'loss' }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn('font-display text-2xl font-bold tabular', tone === 'win' ? 'text-primary' : tone === 'loss' ? 'text-red-600 dark:text-red-400' : 'text-brand-dark')}>{value}</p>
    </div>
  )
}

function EmptyCta({ text, cta }: { text: string; cta: { to: '/auth' | '/jogos'; label: string } }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" size="sm">
        <Link to={cta.to}>
          {cta.label} <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}
