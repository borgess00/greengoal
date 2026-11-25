import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Crown, Lock, Plus, TicketCheck, Trophy } from 'lucide-react'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { FormDashes } from '@/components/stats/form-dashes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth, useMe } from '@/hooks/use-auth'
import { isLive, statusLabel } from '@/lib/fixture-status'
import { formatGradeDate } from '@/lib/grade'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getDashboard, type BigGame, type DashboardData, type PickCard } from '@/server/dashboard.functions'

export const Route = createFileRoute('/painel')({
  head: () =>
    seo({
      title: 'Painel',
      description: 'Grandes jogos de hoje, destaques do dia com mercados testados por vários ângulos, seus bilhetes e resultados. 18+.',
      path: '/painel',
    }),
  component: PainelPage,
})

const pct = (h: number, t: number) => (t ? Math.round((h / t) * 100) : 0)
const rateText = (p: number) => (p >= 70 ? 'text-primary' : p >= 50 ? 'text-amber-600 dark:text-amber-300' : 'text-muted-foreground')
const fmtOdd = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function greeting() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function PainelPage() {
  const { user, loading } = useAuth()
  const { me } = useMe()
  const q = useQuery({ queryKey: ['dashboard', user?.id ?? 'anon'], queryFn: () => getDashboard(), enabled: !loading, staleTime: 60_000 })
  const d = q.data
  const firstName = me?.fullName?.split(' ')[0]
  const [showAll, setShowAll] = React.useState(false)
  const picks = d?.picks ?? []

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{d ? formatGradeDate(d.date).replace(/^\w/, (c) => c.toUpperCase()) : 'Hoje'}</p>
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          {greeting()}
          {firstName ? `, ${firstName}` : ''} 👋
        </h1>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          {/* ---------- Grandes jogos ---------- */}
          <section aria-labelledby="grandes-jogos">
            <SectionTitle id="grandes-jogos" title="Grandes jogos de hoje" link={{ to: '/jogos', label: 'Todas as partidas' }} />
            {!d ? (
              <Skeleton className="h-56 rounded-2xl" />
            ) : d.bigGames.length ? (
              <div className="space-y-3">
                <HeroGame g={d.bigGames[0]} />
                {d.bigGames.length > 1 && (
                  <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                    {d.bigGames.slice(1).map((g) => (
                      <GameRow key={g.id} g={g} />
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Empty text="Nenhuma partida por jogar hoje nos campeonatos cobertos." />
            )}
          </section>

          {/* ---------- Destaques ---------- */}
          <section aria-labelledby="destaques">
            <SectionTitle id="destaques" title="Destaques do dia" />
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">Mercados que mais se repetiram entre os ângulos: últimos 10 e 5 jogos, mando, competição e confronto direto.</p>
            {!d ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-44 rounded-2xl" />
                <Skeleton className="h-44 rounded-2xl" />
              </div>
            ) : picks.length ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(showAll ? picks : picks.slice(0, 6)).map((p) => (
                    <RingPickCard key={p.key} p={p} pro={d.pro} />
                  ))}
                </div>
                {picks.length > 6 && !showAll && (
                  <Button variant="outline" className="mt-4 w-full" onClick={() => setShowAll(true)}>
                    Ver mais destaques ({picks.length - 6})
                  </Button>
                )}
              </>
            ) : (
              <Empty text="Os destaques aparecem quando as estatísticas dos jogos de hoje forem coletadas (a automação faz isso ao longo do dia)." />
            )}
          </section>
        </div>

        {/* ---------- Coluna lateral ---------- */}
        <aside className="space-y-4 lg:sticky lg:top-32">
          <SummaryCard d={d} />
          {d && !d.pro && (
            <div className="rounded-2xl bg-gradient-to-br from-brand-deep to-ink p-5 text-white">
              <Crown className="mb-2 size-6 text-brand-light" />
              <p className="font-display text-lg font-bold">Descubra os mercados</p>
              <p className="mt-1 text-sm text-white/70">
                Você vê quantas vezes cada linha se cumpriu, mas não qual é. No Pro: mercado, todos os ângulos e estatísticas completas{d.picksTotal ? ` de ${d.picksTotal} destaque(s) de hoje` : ''}.
              </p>
              <Button asChild className="mt-4 w-full bg-brand-light text-ink hover:bg-brand-light/90">
                <Link to="/planos">Ver planos</Link>
              </Button>
            </div>
          )}
          <ResultsCard d={d} />
          <RiskNotice compact />
        </aside>
      </div>
    </div>
  )
}

function SectionTitle({ id, title, link }: { id: string; title: string; link?: { to: '/jogos'; label: string } }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="font-display text-xl font-bold text-brand-dark">
        {title}
      </h2>
      {link && (
        <Link to={link.to} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {link.label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{text}</p>
}

function Odds({ g, size = 'md' }: { g: BigGame; size?: 'sm' | 'md' }) {
  if (!g.odds) return null
  return (
    <div className={cn('grid grid-cols-3', size === 'sm' ? 'w-40 gap-1' : 'gap-2')}>
      {(
        [
          ['1', g.odds.casa],
          ['X', g.odds.empate],
          ['2', g.odds.fora],
        ] as const
      ).map(([k, v]) => (
        <span key={k} className={cn('rounded-lg text-center', size === 'sm' ? 'bg-muted px-1.5 py-1' : 'bg-white/10 px-2 py-2')}>
          <span className={cn('block font-semibold', size === 'sm' ? 'text-[9px] text-muted-foreground' : 'text-[10px] text-white/60')}>{k}</span>
          <span className={cn('font-display font-bold tabular', size === 'sm' ? 'text-xs text-primary' : 'text-base text-brand-light')}>{fmtOdd(v)}</span>
        </span>
      ))}
    </div>
  )
}

/** O jogo de maior prioridade do dia, em destaque. */
function HeroGame({ g }: { g: BigGame }) {
  const live = isLive(g.status_short)
  return (
    <Link to="/jogo/$id" params={{ id: String(g.id) }} className="hero-pitch relative block overflow-hidden rounded-2xl p-5 text-white sm:p-6">
      <div className="pitch-lines absolute inset-0 opacity-40" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 text-xs text-white/70">
          <span className="flex items-center gap-1.5">
            {g.league_logo && <img src={g.league_logo} alt="" width={16} height={16} className="size-4 rounded bg-white object-contain p-0.5" />}
            {g.league_name}
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">{live ? `Ao vivo ${g.elapsed ?? ''}'` : 'Jogo do dia'}</span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {(['home', 'away'] as const).map((side, i) => (
            <div key={side} className={cn('row-start-1 flex min-w-0 flex-col items-center gap-2 text-center', i === 0 ? 'col-start-1' : 'col-start-3')}>
              <span className="grid size-14 place-items-center rounded-2xl bg-white p-1.5 shadow-lift sm:size-16">
                <TeamCrest name={side === 'home' ? g.home_team_name : g.away_team_name} logo={side === 'home' ? g.home_team_logo : g.away_team_logo} size={44} />
              </span>
              <span className="w-full truncate font-display text-lg font-bold">{side === 'home' ? g.home_team_name : g.away_team_name}</span>
              <FormDashes form={side === 'home' ? g.form_home : g.form_away} />
            </div>
          ))}
          <div className="col-start-2 row-start-1 text-center">
            <p className="font-display text-3xl font-bold tabular">{live ? `${g.goals_home} x ${g.goals_away}` : g.local_time}</p>
            <p className="text-xs text-white/60">{live ? statusLabel(g.status_short) : 'Brasília'}</p>
          </div>
        </div>
        {g.odds && (
          <div className="mx-auto mt-5 max-w-sm">
            <Odds g={g} />
            {g.odds.bookmaker && <p className="mt-1.5 text-center text-[10px] text-white/50">Odds de referência: {g.odds.bookmaker}</p>}
          </div>
        )}
      </div>
    </Link>
  )
}

function GameRow({ g }: { g: BigGame }) {
  const live = isLive(g.status_short)
  return (
    <li>
      <Link to="/jogo/$id" params={{ id: String(g.id) }} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/60">
        <span className={cn('w-12 shrink-0 text-sm font-bold tabular', live ? 'text-red-600 dark:text-red-400' : 'text-brand-dark')}>{live ? `${g.elapsed ?? ''}'` : g.local_time}</span>
        <span className="min-w-0 flex-1 space-y-1 text-sm">
          {(['home', 'away'] as const).map((side) => (
            <span key={side} className="flex items-center gap-2">
              <TeamCrest name={side === 'home' ? g.home_team_name : g.away_team_name} logo={side === 'home' ? g.home_team_logo : g.away_team_logo} size={18} />
              <span className="truncate font-semibold">{side === 'home' ? g.home_team_name : g.away_team_name}</span>
              <FormDashes form={side === 'home' ? g.form_home : g.form_away} className="ml-auto hidden sm:inline-flex" />
            </span>
          ))}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground md:block md:w-28">{g.league_name}</span>
        <span className="hidden sm:block">
          <Odds g={g} size="sm" />
        </span>
      </Link>
    </li>
  )
}

/** Anel com a taxa principal (últimos 10 jogos). */
function Ring({ value }: { value: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0" role="img" aria-label={`${value}% no recorte principal`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="32" dy="0.35em" textAnchor="middle" className="fill-brand-dark font-display text-[15px] font-bold">
        {value}%
      </text>
    </svg>
  )
}

function RingPickCard({ p, pro }: { p: PickCard; pro: boolean }) {
  return (
    <Link to="/jogo/$id" params={{ id: String(p.fixtureId) }} hash="estatisticas" className="flex gap-4 rounded-2xl border bg-card p-4 shadow-soft transition hover:border-primary/50">
      <Ring value={p.rate} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">
          {p.league} · {p.localTime}
        </p>
        <p className="truncate font-display font-bold text-brand-dark">
          {p.home} x {p.away}
        </p>
        <p className={cn('mt-1.5 flex items-center gap-1.5 text-sm font-semibold', pro ? 'text-foreground' : 'text-muted-foreground')}>
          {pro && p.market ? <BarChart3 className="size-4 shrink-0 text-primary" /> : <Lock className="size-3.5 shrink-0" />}
          <span className="truncate">{pro && p.market ? p.market : 'Mercado oculto (Pro)'}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          <TeamCrest name={p.team} logo={p.teamLogo} size={14} className="mr-1 inline-block align-[-2px]" />
          {p.team}
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {p.angles.map((a) => {
            const v = pct(a.hits, a.total)
            return (
              <li key={a.label} className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground" title={`${v}%`}>
                <strong className={cn('tabular', rateText(v))}>
                  {a.hits}/{a.total}
                </strong>{' '}
                {a.label}
              </li>
            )
          })}
          {p.hiddenAngles > 0 && (
            <li className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
              <Lock className="size-3" /> +{p.hiddenAngles} no Pro
            </li>
          )}
        </ul>
      </div>
    </Link>
  )
}

function SummaryCard({ d }: { d: DashboardData | undefined }) {
  const s = d?.slips
  const row = (label: string, value: React.ReactNode, tone?: 'win' | 'loss') => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-display font-bold tabular', tone === 'win' ? 'text-primary' : tone === 'loss' ? 'text-red-600 dark:text-red-400' : 'text-brand-dark')}>{value}</span>
    </div>
  )
  return (
    <section aria-labelledby="resumo" className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="resumo" className="flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
          <TicketCheck className="size-5 text-primary" /> Meus bilhetes
        </h2>
        <Link to="/meus-bilhetes" className="text-sm font-semibold text-primary hover:underline">
          Abrir
        </Link>
      </div>
      {!d ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : !d.loggedIn ? (
        <div className="py-2 text-center">
          <p className="text-sm text-muted-foreground">Entre para montar bilhetes e acompanhar sozinho se bateram.</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/auth">Entrar ou criar conta</Link>
          </Button>
        </div>
      ) : !s || !s.total ? (
        <div className="py-2 text-center">
          <p className="text-sm text-muted-foreground">Nenhum bilhete salvo ainda.</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/jogos" search={{ status: 'proximos' }}>
              <Plus /> Montar bilhete
            </Link>
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {row('Abertos', s.open)}
          {row('Ganhos', s.won, 'win')}
          {row('Perdidos', s.lost, 'loss')}
          <div className="pt-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <Trophy className="size-3.5" /> Desempenho
            </p>
            {row('Taxa de acerto', s.hitRate != null ? `${s.hitRate}%` : '—')}
            {row('Resultado', s.units != null ? `${s.units > 0 ? '+' : ''}${s.units.toLocaleString('pt-BR')}u` : '—', s.units != null ? (s.units >= 0 ? 'win' : 'loss') : undefined)}
          </div>
        </div>
      )}
    </section>
  )
}

function ResultsCard({ d }: { d: DashboardData | undefined }) {
  return (
    <section aria-labelledby="resultados" className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="resultados" className="font-display text-lg font-bold text-brand-dark">
          Resultados
        </h2>
        <Link to="/jogos" search={{ status: 'encerrados' }} className="text-sm font-semibold text-primary hover:underline">
          Encerradas
        </Link>
      </div>
      {!d ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : d.results.length ? (
        <ul className="divide-y">
          {d.results.map((f) => (
            <li key={f.id}>
              <Link to="/jogo/$id" params={{ id: String(f.id) }} className="flex items-center gap-3 py-2 text-sm hover:text-primary">
                <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{f.grade_date === d.date ? 'hoje' : 'ontem'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span className="truncate">{f.home_team_name}</span>
                    <strong className="tabular">{f.goals_home}</strong>
                  </span>
                  <span className="flex justify-between gap-2">
                    <span className="truncate">{f.away_team_name}</span>
                    <strong className="tabular">{f.goals_away}</strong>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma partida encerrada entre ontem e hoje.</p>
      )}
    </section>
  )
}
