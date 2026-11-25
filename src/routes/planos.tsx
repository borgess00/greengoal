import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { z } from 'zod'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { CheckoutDialog } from '@/components/billing/checkout-dialog'
import { PricingPlans } from '@/components/billing/pricing-plans'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-auth'
import { formatDate } from '@/lib/format'
import { FALLBACK_PLANS } from '@/lib/plans'
import { seo } from '@/lib/seo'
import type { PlanRow } from '@/lib/types'
import { getPlans } from '@/server/plans.functions'
import { getBillingInfo } from '@/server/billing.functions'

const plansQuery = queryOptions({ queryKey: ['plans'], queryFn: () => getPlans(), staleTime: 10 * 60_000 })

export const Route = createFileRoute('/planos')({
  validateSearch: z.object({ plano: z.enum(['weekly', 'monthly', 'annual']).optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.prefetchQuery(plansQuery),
  head: () =>
    seo({
      title: 'Planos de assinatura',
      description: 'Assine o GreenGoal: semanal R$ 7,90, mensal R$ 16,90 ou anual R$ 99,90. Todos os planos liberam os mesmos recursos.',
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
  const billing = useQuery({ queryKey: ['billing-info', user?.id], queryFn: () => getBillingInfo(), staleTime: 60_000 })
  const real = billing.data?.mode === 'asaas'

  return (
    <>
      <PageHeader eyebrow="Assinatura" title="Escolha seu plano" description="Comece grátis. No GreenGoal Pro, semanal, mensal e anual liberam exatamente os mesmos recursos — muda só o período." />
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

        <PricingPlans
          plans={plans}
          initial={search.plano ?? 'monthly'}
          onChoose={choose}
          disabled={authLoading}
          actionLabel={(plan) => (active?.plan_id === plan.id ? 'Renovar este plano' : active ? 'Trocar para este plano' : `Assinar ${plan.name.toLowerCase()}`)}
          freeAction={
            user ? (
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/jogos">Ver jogos de hoje</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/auth" search={{ modo: 'cadastro' }}>
                  Criar conta grátis
                </Link>
              </Button>
            )
          }
        />

        <div className="mx-auto mt-10 max-w-2xl space-y-3 text-center text-sm text-muted-foreground">
          {real ? (
            <p>
              <strong className="text-foreground">Pagamento seguro pelo Asaas</strong>, por Pix ou cartão. A assinatura renova automaticamente a cada período até você cancelar.
            </p>
          ) : (
            <p>
              <strong className="text-foreground">Pagamento em modo demonstração:</strong> nesta versão nenhuma cobrança é feita. A ativação libera o acesso para testes pelo prazo do plano, sem renovação automática.
            </p>
          )}
          <p>É necessário entrar na sua conta para assinar. Você pode cancelar quando quiser: o acesso continua até o fim do período.</p>
        </div>
        <RiskNotice className="mt-10" />
      </div>
      <CheckoutDialog plan={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} replacing={!!active} />
    </>
  )
}
