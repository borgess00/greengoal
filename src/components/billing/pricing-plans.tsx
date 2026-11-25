import * as React from 'react'
import { Check, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { FREE_FEATURES, PLAN_FEATURES, savingsVsMonthly } from '@/lib/plans'
import type { PlanRow } from '@/lib/types'
import { cn } from '@/lib/utils'

const PER: Record<string, string> = { weekly: 'por semana', monthly: 'por mês', annual: 'por ano' }

/**
 * Planos no estilo "grátis x completo": um seletor de período (semanal,
 * mensal, anual) muda o preço do cartão do plano completo.
 */
export function PricingPlans({
  plans,
  tone = 'light',
  initial = 'monthly',
  onChoose,
  actionLabel,
  freeAction,
  disabled,
}: {
  plans: PlanRow[]
  tone?: 'light' | 'dark'
  initial?: string
  onChoose: (plan: PlanRow) => void
  actionLabel?: (plan: PlanRow) => string
  freeAction: React.ReactNode
  disabled?: boolean
}) {
  const dark = tone === 'dark'
  const sorted = [...plans].sort((a, b) => a.sort_order - b.sort_order)
  const [period, setPeriod] = React.useState(sorted.some((p) => p.id === initial) ? initial : sorted[0]?.id)
  const plan = sorted.find((p) => p.id === period) ?? sorted[0]
  const monthly = sorted.find((p) => p.id === 'monthly')
  if (!plan) return null
  const save = savingsVsMonthly(plan, monthly)

  return (
    <div className="flex flex-col items-center">
      <div role="radiogroup" aria-label="Período do plano" className={cn('relative inline-flex rounded-full border p-1', dark ? 'border-white/10 bg-white/5' : 'bg-card shadow-soft')}>
        {sorted.map((p) => {
          const s = savingsVsMonthly(p, monthly)
          const on = p.id === plan.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'relative rounded-full px-5 py-2 text-sm font-semibold transition sm:px-7',
                on ? (dark ? 'bg-white/15 text-white' : 'bg-brand-dark text-white') : dark ? 'text-white/60 hover:text-white' : 'text-muted-foreground hover:text-brand-dark',
              )}
            >
              {p.name}
              {s && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-ink">
                  -{s}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-8 grid w-full max-w-4xl gap-5 md:grid-cols-2">
        <div className={cn('flex flex-col rounded-2xl border p-6 sm:p-7', dark ? 'border-white/10 bg-white/[0.03] text-white' : 'bg-card shadow-soft')}>
          <h3 className="font-display text-xl font-bold">Grátis</h3>
          <p className={cn('text-sm', dark ? 'text-white/60' : 'text-muted-foreground')}>Comece pelo básico</p>
          <div className={cn('my-5 border-t', dark ? 'border-white/10' : '')} />
          <p className="font-display text-4xl font-bold">R$ 0</p>
          <p className={cn('mt-1 text-sm', dark ? 'text-white/60' : 'text-muted-foreground')}>Para sempre.</p>
          <div className="mt-5">{freeAction}</div>
          <div className={cn('my-5 border-t', dark ? 'border-white/10' : '')} />
          <ul className="space-y-2.5 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className={cn('mt-0.5 size-4 shrink-0', dark ? 'text-white/70' : 'text-muted-foreground')} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div
          className={cn(
            'relative flex flex-col overflow-hidden rounded-2xl border-2 p-6 sm:p-7',
            dark ? 'border-brand-light/70 bg-gradient-to-br from-ink-3 via-ink-2 to-[#16361f] text-white' : 'border-primary bg-gradient-to-br from-white via-white to-secondary shadow-lift',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-bold">GreenGoal Pro</h3>
              <p className={cn('text-sm', dark ? 'text-white/60' : 'text-muted-foreground')}>Tudo liberado</p>
            </div>
            <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', dark ? 'bg-brand-light text-ink' : 'bg-primary text-white')}>
              <Crown className="size-3.5" /> {plan.name}
            </span>
          </div>
          <div className={cn('my-5 border-t', dark ? 'border-white/10' : '')} />
          <p className="font-display text-4xl font-bold tabular">{formatBRL(plan.price_cents)}</p>
          <p className={cn('mt-1 text-sm', dark ? 'text-white/70' : 'text-muted-foreground')}>
            {PER[plan.id] ?? `por ${plan.duration_days} dias`}
            {plan.monthly_equivalent_cents ? ` · equivale a ${formatBRL(plan.monthly_equivalent_cents)}/mês` : ''}
            {save ? ` · economia de ${save}% em relação ao mensal` : ''}
          </p>
          <Button
            size="lg"
            className={cn('mt-5 w-full', dark && 'bg-brand-light text-ink hover:bg-brand-light/90')}
            onClick={() => onChoose(plan)}
            disabled={disabled}
          >
            {actionLabel ? actionLabel(plan) : `Assinar ${plan.name.toLowerCase()}`}
          </Button>
          <p className={cn('mt-2 text-center text-xs', dark ? 'text-white/50' : 'text-muted-foreground')}>Cancele quando quiser: o acesso continua até o fim do período.</p>
          <div className={cn('my-5 border-t', dark ? 'border-white/10' : '')} />
          <ul className="space-y-2.5 text-sm">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className={cn('mt-0.5 size-4 shrink-0', dark ? 'text-brand-light' : 'text-primary')} />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
