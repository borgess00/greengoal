import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Lock, Search, X } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { FormBadges } from '@/components/stats/form-badges'
import { MatchStatsPanel } from '@/components/stats/match-stats-panel'
import { StatCompare } from '@/components/stats/stat-compare'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { summarizeWindow } from '@/lib/match-stats'
import { seo } from '@/lib/seo'
import { getComparison, searchTeams, type TeamInfo } from '@/server/teams.functions'

export const Route = createFileRoute('/comparar')({
  validateSearch: z.object({ a: z.coerce.number().int().positive().optional().catch(undefined), b: z.coerce.number().int().positive().optional().catch(undefined) }),
  head: () => seo({ title: 'Comparar times', description: 'Compare dois times lado a lado: forma, gols, finalizações, escanteios, cartões, radar e mercados por ângulo.', path: '/comparar' }),
  component: CompararPage,
})

function CompararPage() {
  const { a, b } = Route.useSearch()
  const navigate = useNavigate({ from: '/comparar' })
  const { user, loading } = useAuth()
  const cmp = useQuery({
    queryKey: ['compare', a, b, user?.id ?? 'anon'],
    queryFn: () => getComparison({ data: { a: a!, b: b! } }),
    enabled: !!a && !!b && a !== b && !loading,
    staleTime: 5 * 60_000,
  })
  const d = cmp.data

  return (
    <>
      <PageHeader eyebrow="Ferramenta" title="Comparar times" description="Escolha dois times para ver os números lado a lado, mesmo que eles não se enfrentem hoje.">
        <div className="grid max-w-3xl items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <TeamPicker label="Primeiro time" selectedId={a} selected={d?.a.team} onPick={(t) => navigate({ search: (s) => ({ ...s, a: t?.id }) })} />
          <span className="hidden size-10 place-items-center rounded-full bg-white/10 sm:grid" aria-hidden>
            <ArrowLeftRight className="size-5" />
          </span>
          <TeamPicker label="Segundo time" selectedId={b} selected={d?.b.team} onPick={(t) => navigate({ search: (s) => ({ ...s, b: t?.id }) })} />
        </div>
      </PageHeader>

      <div className="container-page py-8">
        {!a || !b ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">Escolha os dois times acima. Aparecem os times que já estiveram em alguma partida guardada no site.</p>
        ) : a === b ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">Escolha dois times diferentes.</p>
        ) : cmp.isLoading || loading ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : !d ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">Não encontramos dados de um dos times.</p>
        ) : !d.a.games.length || !d.b.games.length ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">Ainda não há jogos recentes coletados de {!d.a.games.length ? d.a.team.name : d.b.team.name}. Os números aparecem depois que alguma partida do time tiver as estatísticas coletadas.</p>
        ) : d.pro ? (
          <MatchStatsPanel
            fixture={{
              id: 0,
              league_name: d.a.team.leagueId === d.b.team.leagueId ? (d.a.team.leagueName ?? '') : '',
              kickoff_at: '2000-01-01T00:00:00Z',
              status_short: 'FT',
              home_team_name: d.a.team.name,
              home_team_logo: d.a.team.logo,
              away_team_name: d.b.team.name,
              away_team_logo: d.b.team.logo,
            }}
            home={d.a.games}
            away={d.b.games}
            h2hHome={d.h2hA}
            h2hAway={d.h2hB}
          />
        ) : (
          <FreeComparison d={d} />
        )}
        <RiskNotice className="mt-8" />
      </div>
    </>
  )
}

function FreeComparison({ d }: { d: NonNullable<Awaited<ReturnType<typeof getComparison>>> }) {
  const ha = summarizeWindow(d.a.games, 10)
  const hb = summarizeWindow(d.b.games, 10)
  const pctOf = (c: number, n: number) => (n ? Math.round((c / n) * 100) : null)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-brand-dark">Forma recente · últimos 10</h2>
        {[d.a, d.b].map((t) => (
          <div key={t.team.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0">
            <Link to="/time/$id" params={{ id: String(t.team.id) }} className="flex min-w-0 items-center gap-2 font-semibold hover:text-primary">
              <TeamCrest name={t.team.name} logo={t.team.logo} size={24} />
              <span className="truncate">{t.team.name}</span>
            </Link>
            <FormBadges form={t.games.slice(0, 10).map((g) => g.result).join('')} size="sm" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-brand-dark">Gols por jogo</h2>
        <StatCompare label="Marcados" home={ha?.goalsFor ?? null} away={hb?.goalsFor ?? null} digits={2} />
        <StatCompare label="Sofridos" home={ha?.goalsAgainst ?? null} away={hb?.goalsAgainst ?? null} digits={2} lowerIsBetter />
        <StatCompare label="Mais de 2,5 gols" hint="% dos jogos" home={ha ? pctOf(ha.over25, ha.games) : null} away={hb ? pctOf(hb.over25, hb.games) : null} digits={0} suffix="%" />
      </div>
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card p-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" /> No GreenGoal Pro: finalizações, escanteios, cartões, posse, gráficos, radar e mercados por ângulo dos dois times.
        </p>
        <Button asChild size="sm">
          <Link to="/planos">Ver planos</Link>
        </Button>
      </div>
    </div>
  )
}

function TeamPicker({ label, selectedId, selected, onPick }: { label: string; selectedId?: number; selected?: TeamInfo; onPick: (t: TeamInfo | null) => void }) {
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])
  const res = useQuery({ queryKey: ['team-search', term], queryFn: () => searchTeams({ data: { q: term } }), enabled: term.length >= 2, placeholderData: keepPreviousData })
  if (selectedId && selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-foreground dark:bg-card">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <TeamCrest name={selected.name} logo={selected.logo} size={24} />
          <span className="truncate">{selected.name}</span>
        </span>
        <button type="button" onClick={() => onPick(null)} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label={`Trocar ${label.toLowerCase()}`}>
          <X className="size-4" />
        </button>
      </div>
    )
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={selectedId ? 'Carregando…' : label}
        aria-label={label}
        className="h-11 w-full rounded-xl bg-white pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground dark:bg-card"
      />
      {open && term.length >= 2 && (
        <ul className="absolute inset-x-0 top-12 z-20 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 text-foreground shadow-lift">
          {res.data?.length ? (
            res.data.map((t) => (
              <li key={t.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(t); setQ(''); setOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted">
                  <TeamCrest name={t.name} logo={t.logo} size={22} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.leagueName}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-muted-foreground">{res.isFetching ? 'Buscando…' : 'Nenhum time encontrado.'}</li>
          )}
        </ul>
      )}
    </div>
  )
}
