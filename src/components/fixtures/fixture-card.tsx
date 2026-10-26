import { Link } from '@tanstack/react-router'
import { ChevronRight, Clock, Sparkles } from 'lucide-react'
import { TeamCrest } from '@/components/common/team-crest'
import { Badge } from '@/components/ui/badge'
import { isFinished, isLive, statusLabel } from '@/lib/fixture-status'
import type { FixtureRow } from '@/lib/types'
import { cn } from '@/lib/utils'

export function FixtureCard({ fixture, className }: { fixture: FixtureRow; className?: string }) {
  const finished = isFinished(fixture.status_short)
  const live = isLive(fixture.status_short)
  const showScore = (finished || live) && fixture.goals_home != null && fixture.goals_away != null
  return (
    <Link
      to="/jogo/$id"
      params={{ id: String(fixture.id) }}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring outline-none',
        className,
      )}
      aria-label={`${fixture.home_team_name} x ${fixture.away_team_name}, ${fixture.local_time}, ${fixture.league_name}. Ver análise`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-muted-foreground">
          {fixture.league_logo && <img src={fixture.league_logo} alt="" width={16} height={16} className="size-4 object-contain" loading="lazy" />}
          <span className="truncate">{fixture.league_name}</span>
        </span>
        {live ? (
          <Badge variant="danger" className="animate-pulse">
            {statusLabel(fixture.status_short)}
            {fixture.elapsed ? ` ${fixture.elapsed}'` : ''}
          </Badge>
        ) : finished ? (
          <Badge variant="muted">Encerrado</Badge>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-bold text-brand-dark tabular">
            <Clock className="size-3" /> {fixture.local_time}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
        <TeamLine name={fixture.home_team_name} logo={fixture.home_team_logo} />
        <span className="font-display text-lg font-bold tabular text-brand-dark">{showScore ? fixture.goals_home : ''}</span>
        <TeamLine name={fixture.away_team_name} logo={fixture.away_team_logo} />
        <span className="font-display text-lg font-bold tabular text-brand-dark">{showScore ? fixture.goals_away : ''}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-3 text-xs">
        {fixture.has_analysis ? (
          <span className="flex items-center gap-1 font-semibold text-primary">
            <Sparkles className="size-3.5" /> Análise publicada
          </span>
        ) : (
          <span className="text-muted-foreground">{finished || live ? statusLabel(fixture.status_short) : 'Estatísticas da partida'}</span>
        )}
        <span className="flex items-center gap-0.5 font-semibold text-brand-dark transition group-hover:translate-x-0.5">
          Ver análise <ChevronRight className="size-4" />
        </span>
      </div>
    </Link>
  )
}

function TeamLine({ name, logo }: { name: string; logo: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <TeamCrest name={name} logo={logo} size={26} />
      <span className="truncate font-semibold">{name}</span>
    </span>
  )
}

export function FixtureCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft" aria-hidden>
      <div className="flex justify-between">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-14 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="size-6 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="size-6 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-px bg-muted" />
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
    </div>
  )
}
