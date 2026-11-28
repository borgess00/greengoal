import type * as React from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const fmt = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * Linha comparando mandante x visitante: valores nas pontas e barra dividida
 * proporcionalmente. `lowerIsBetter` só muda qual lado fica em destaque.
 */
export function StatCompare({
  label,
  home,
  away,
  digits = 1,
  suffix = '',
  hint,
  lowerIsBetter = false,
}: {
  label: string
  home: number | null
  away: number | null
  digits?: number
  suffix?: string
  hint?: string
  lowerIsBetter?: boolean
}) {
  const both = home != null && away != null
  const total = both ? home + away : 0
  const homeShare = both && total > 0 ? (home / total) * 100 : 50
  const lead = both && home !== away ? ((home > away) !== lowerIsBetter ? 'home' : 'away') : null
  const show = (v: number | null) => (v == null ? '—' : `${fmt(v, digits)}${suffix}`)
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className={cn('font-display text-base font-bold tabular', lead === 'home' ? 'text-brand-dark' : 'text-muted-foreground')}>{show(home)}</span>
        <span className="text-center text-xs font-semibold text-muted-foreground">
          {label}
          {hint && <span className="block text-[11px] font-normal">{hint}</span>}
        </span>
        <span className={cn('font-display text-base font-bold tabular', lead === 'away' ? 'text-brand-dark' : 'text-muted-foreground')}>{show(away)}</span>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {both && total > 0 && (
          <>
            <span className="bar-grow h-full rounded-l-full bg-series-home" style={{ width: `${homeShare}%` }} />
            <span className="bar-grow h-full flex-1 rounded-r-full bg-series-away" style={{ '--grow-from': 'right' } as React.CSSProperties} />
          </>
        )}
      </div>
    </div>
  )
}

/** Cartão de número (estilo dos "tiles" da página inicial). */
export function StatTile({ icon, label, value, sub, className }: { icon: ReactNode; label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-3.5 shadow-soft', className)}>
      <div className="mb-2 flex items-center gap-2 text-primary">{icon}</div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold text-brand-dark tabular">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
