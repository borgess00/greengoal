import * as React from 'react'
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import type { MarketAngles } from '@/lib/match-stats'
import { cn } from '@/lib/utils'

const pct = (h: number, t: number) => (t ? Math.round((h / t) * 100) : 0)

/** Cor do percentual: verde forte (70%+), âmbar (50–69%), neutro (abaixo). */
function rateClass(p: number, dark: boolean) {
  if (p >= 70) return dark ? 'text-brand-light' : 'text-primary'
  if (p >= 50) return dark ? 'text-amber-300' : 'text-amber-600'
  return dark ? 'text-white/50' : 'text-muted-foreground'
}

/** Cartão de um mercado testado por vários ângulos (estilo "7/10 nos últimos 10 jogos"). */
export function MarketAngleCard({ m, tone = 'light', logo, defaultOpen = true }: { m: MarketAngles; tone?: 'light' | 'dark'; logo?: React.ReactNode; defaultOpen?: boolean }) {
  const dark = tone === 'dark'
  const [open, setOpen] = React.useState(defaultOpen)
  const main = m.angles[0]
  return (
    <div className={cn('rounded-2xl border p-4 text-left', dark ? 'border-white/10 bg-ink-2/90 text-white shadow-[0_20px_60px_-20px_rgb(74_222_128/0.35)] backdrop-blur' : 'bg-card shadow-soft')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {logo}
          <div className="min-w-0">
            <p className={cn('truncate text-xs', dark ? 'text-white/60' : 'text-muted-foreground')}>{m.team}</p>
            <p className={cn('flex items-center gap-1.5 font-display font-bold', dark ? 'text-white' : 'text-brand-dark')}>
              <BarChart3 className={cn('size-4 shrink-0', dark ? 'text-brand-light' : 'text-primary')} />
              {m.market}
            </p>
          </div>
        </div>
        <span
          className={cn('shrink-0 rounded-lg px-2 py-1 font-display text-sm font-bold tabular', dark ? 'bg-brand-light/15 text-brand-light' : 'bg-secondary text-primary')}
          title="Acertos no recorte principal (últimos 10 jogos)"
        >
          {m.rate}%
        </span>
      </div>
      <p className={cn('mt-3 flex items-center gap-2 text-sm', dark ? 'text-white/85' : 'text-foreground')}>
        <span className={cn('size-1.5 rounded-full', dark ? 'bg-white/60' : 'bg-foreground/50')} aria-hidden />
        <strong className="tabular">
          {main.hits}/{main.total}
        </strong>{' '}
        {main.label}
      </p>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {m.angles.slice(1).map((a) => (
            <li key={a.label} className={cn('flex items-center justify-between gap-3 text-xs', dark ? 'text-white/70' : 'text-muted-foreground')}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('size-1 shrink-0 rounded-full', dark ? 'bg-white/40' : 'bg-foreground/30')} aria-hidden />
                <span className="truncate">
                  <span className="font-semibold tabular">
                    {a.hits}/{a.total}
                  </span>{' '}
                  {a.label}
                </span>
              </span>
              <span className={cn('font-bold tabular', rateClass(pct(a.hits, a.total), dark))}>{pct(a.hits, a.total)}%</span>
            </li>
          ))}
        </ul>
      )}
      {m.angles.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn('mt-2 flex items-center gap-1 text-xs font-semibold', dark ? 'text-brand-light' : 'text-primary')}
          aria-expanded={open}
        >
          {open ? (
            <>
              Recolher ângulos <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              Ver todos os ângulos <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
