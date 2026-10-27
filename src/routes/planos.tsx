import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Check, Crown, ShieldCheck } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { CheckoutDialog } from '@/components/billing/checkout-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMe } from '@/hooks/use-auth'
import { formatBRL, formatDate } from '@/lib/format'
import { FALLBACK_PLANS, PERIOD_LABEL, PLAN_FEATURES } from '@/lib/plans'
import { seo } from '@/lib/seo'
import type { PlanRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getPlans } from '@/server/plans.functions'

const plansQuery = queryOptions({ queryKey: ['plans'], queryFn: () => getPlans(), staleTime: 10 * 60_000 })

export const Route = createFileRoute('/planos')({
  validateSearch: z.object({ plano: z.enum(['weekly', 'monthly', 'annual']).optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.prefetchQuery(plansQuery),
  head: () =>
    seo({
      title: 'Planos de assinatura',
      description: 'Assine o GreenGoal: semanal R$ 13,90, mensal R$ 41,90 ou anual R$ 399,90. Todos os planos liberam os mesmos recursos.',
      path: '/planos',
    }),
  component: PlanosPage,
})

function PlanosPage() {
  const { data: plans = FALLBACK_PLANS } = useQuery(plansQuery)
  const { user, me, loading: authLoading } = useMe()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/planos' })
  const [selected, setSelected] = React.useState<PlanRow | null>(null)

  // Retorno do login com plano escolhido: abre o diálogo automaticamente.
  React.useEffect(() => {
    if (user && search.plano) {
      const p = plans.find((x) => x.id === search.plano)
      if (p) setSelected(p)
      navigate({ search: {}, replace: true })
    }
  }, [user, search.plano, plans, navigate])

  function choose(plan: PlanRow) {
    if (!user) {
      navigate({ to: '/auth', search: { redirect: `/planos?plano=${plan.id}`, modo: 'cadastro' } })
      return
    }
    setSelected(plan)
  }

  const active = me?.hasActiveSubscription ? me.subscription : null

  return (
    <>
      <PageHeader eyebrow="Assinatura" title="Escolha seu plano" description="Os três planos liberam exatamente os mesmos recursos. Muda só o período." />
      <div className="container-page py-10">
        {active && (
          <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-secondary p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-secondary-foreground">
              <ShieldCheck className="size-5 text-primary" />
              Você tem o plano <strong>{active.plan_name}</strong> ativo até {formatDate(active.current_period_end)}.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/perfil" search={{ aba: 'assinatura' }}>
                Gerenciar assinatura
              </Link>
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const featured = plan.id === 'annual'
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-card p-7 shadow-soft',
                  featured && 'border-2 border-primary shadow-lift lg:-translate-y-3',
                )}
              >
                {featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1">
                    <Crown /> {plan.badge ?? 'Mais vantajoso'}
                  </Badge>
                )}
                <h2 className="font-display text-2xl font-bold text-brand-dark">{plan.name}</h2>
                <p className="text-sm text-muted-foreground">Acesso por {PERIOD_LABEL[plan.id] ?? `${plan.duration_days} dias`}</p>
                <p className="mt-6 font-display text-4xl font-bold text-brand-dark tabular">{formatBRL(plan.price_cents)}</p>
                <p className="mt-1 h-5 text-sm font-semibold text-primary">
                  {plan.monthly_equivalent_cents ? `Equivale a ${formatBRL(plan.monthly_equivalent_cents)}/mês` : ''}
                </p>
                <ul className="my-7 flex-1 space-y-3 text-sm">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button size="lg" variant={featured ? 'default' : 'outline'} onClick={() => choose(plan)} disabled={authLoading}>
                  {active?.plan_id === plan.id ? 'Renovar este plano' : active ? 'Trocar para este plano' : `Assinar ${plan.name.toLowerCase()}`}
                </Button>
              </div>
            )
          })}
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-3 text-center text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Pagamento em modo demonstração:</strong> nesta versão nenhuma cobrança é feita. A ativação libera o acesso para testes pelo prazo do plano, sem renovação automática.
          </p>
          <p>É necessário entrar na sua conta para assinar. Você pode cancelar quando quiser: o acesso continua até o fim do período.</p>
        </div>
        <RiskNotice className="mt-10" />
      </div>
      <CheckoutDialog plan={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} replacing={!!active} />
    </>
  )
}
