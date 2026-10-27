import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CreditCard, LogOut, Receipt, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { PasswordInput } from '@/components/auth/password-input'
import { CheckoutDialog } from '@/components/billing/checkout-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { signOut, useMe } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { authErrorMessage, passwordProblem } from '@/lib/auth-errors'
import { daysUntil, errorMessage, formatBRL, formatDate, formatDateTime } from '@/lib/format'
import { requireSession } from '@/lib/guards'
import { FALLBACK_PLANS } from '@/lib/plans'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { isSubscriptionValid, type PaymentRow, type PlanRow } from '@/lib/types'
import { cancelPendingOrder, cancelSubscription, resumeSubscription } from '@/server/billing.functions'
import { getPlans } from '@/server/plans.functions'

export const Route = createFileRoute('/perfil')({
  ssr: false,
  validateSearch: z.object({ aba: z.enum(['dados', 'assinatura', 'pagamentos']).optional().catch(undefined) }),
  beforeLoad: ({ location }) => requireSession(location),
  head: () => seo({ title: 'Minha conta', description: 'Seus dados, sua assinatura e o histórico de pagamentos.', path: '/perfil', noindex: true }),
  component: PerfilPage,
})

function PerfilPage() {
  const { aba = 'dados' } = Route.useSearch()
  const navigate = useNavigate({ from: '/perfil' })
  const { me, loading } = useMe()
  const queryClient = useQueryClient()

  return (
    <>
      <PageHeader eyebrow="Minha conta" title={me?.fullName ? `Olá, ${me.fullName.split(' ')[0]}` : 'Minha conta'} description={me?.email ?? undefined}>
        <Button
          variant="white"
          size="sm"
          onClick={async () => {
            await signOut(queryClient)
            toast.success('Você saiu da sua conta.')
            navigate({ to: '/' })
          }}
        >
          <LogOut /> Sair
        </Button>
      </PageHeader>
      <div className="container-page py-8">
        <p className="mb-5 text-sm text-muted-foreground">
          Precisa de ajuda com a conta ou a assinatura?{' '}
          <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
            Fale com o suporte no Discord
          </a>
          .
        </p>
        <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as typeof aba }, replace: true })}>
          <TabsList>
            <TabsTrigger value="dados">
              <UserRound /> Meus dados
            </TabsTrigger>
            <TabsTrigger value="assinatura">
              <ShieldCheck /> Assinatura
            </TabsTrigger>
            <TabsTrigger value="pagamentos">
              <Receipt /> Pagamentos
            </TabsTrigger>
          </TabsList>
          {loading || !me ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <>
              <TabsContent value="dados">
                <DadosTab name={me.fullName ?? ''} email={me.email ?? ''} />
              </TabsContent>
              <TabsContent value="assinatura">
                <AssinaturaTab />
              </TabsContent>
              <TabsContent value="pagamentos">
                <PagamentosTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </>
  )
}

function DadosTab({ name, email }: { name: string; email: string }) {
  const { user } = useMe()
  const queryClient = useQueryClient()
  const [fullName, setFullName] = React.useState(name)
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')

  const saveName = useMutation({
    mutationFn: async () => {
      const value = fullName.trim()
      if (value.length < 2) throw new Error('Informe seu nome.')
      const { error } = await supabase.from('profiles').update({ full_name: value.slice(0, 120) }).eq('id', user!.id)
      if (error) throw new Error('Não foi possível salvar o nome.')
      await supabase.auth.updateUser({ data: { full_name: value } })
    },
    onSuccess: () => {
      toast.success('Nome atualizado.')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const savePassword = useMutation({
    mutationFn: async () => {
      const problem = passwordProblem(password)
      if (problem) throw new Error(problem)
      if (password !== confirm) throw new Error('As senhas não conferem.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(authErrorMessage(error))
    },
    onSuccess: () => {
      toast.success('Senha alterada.')
      setPassword('')
      setConfirm('')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>Como você aparece no GreenGoal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              saveName.mutate()
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email} readOnly disabled />
              <p className="text-xs text-muted-foreground">Para trocar o e-mail, fale com o suporte.</p>
            </div>
            <Button type="submit" className="justify-self-start" disabled={saveName.isPending}>
              Salvar nome
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Mínimo de 8 caracteres, com letras e números.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              savePassword.mutate()
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="pw">Nova senha</Label>
              <PasswordInput id="pw" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pw2">Confirmar nova senha</Label>
              <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="justify-self-start" disabled={savePassword.isPending || !password}>
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AssinaturaTab() {
  const { me } = useMe()
  const queryClient = useQueryClient()
  const { data: plans = FALLBACK_PLANS } = useQuery({ queryKey: ['plans'], queryFn: () => getPlans(), staleTime: 600_000 })
  const [changeTo, setChangeTo] = React.useState<PlanRow | null>(null)
  const sub = me?.subscription ?? null
  const valid = isSubscriptionValid(sub)
  const { user } = useMe()
  const pending = useQuery({
    queryKey: ['pending-order', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, plan_id, created_at, plans(name), payments(invoice_url, status, due_date)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as unknown as { id: string; plan_id: string; plans: { name: string } | null; payments: Array<{ invoice_url: string | null; status: string; due_date: string | null }> } | null
    },
  })
  const dropOrder = useMutation({
    mutationFn: () => cancelPendingOrder(),
    onSuccess: () => {
      toast.success('Pedido cancelado.')
      queryClient.invalidateQueries({ queryKey: ['pending-order'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const pendingCard = pending.data ? (
    <Card className="mb-6 border-amber-300 bg-amber-50/60">
      <CardHeader>
        <CardTitle className="text-lg">Pedido aguardando pagamento — plano {pending.data.plans?.name}</CardTitle>
        <CardDescription>O acesso é liberado automaticamente assim que o Asaas confirmar o pagamento. No Pix, costuma levar poucos segundos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {pending.data.payments.find((p) => p.invoice_url && p.status !== 'canceled')?.invoice_url && (
          <Button asChild>
            <a href={pending.data.payments.find((p) => p.invoice_url && p.status !== 'canceled')!.invoice_url!} target="_blank" rel="noopener noreferrer">
              Pagar agora
            </a>
          </Button>
        )}
        <Button variant="outline" onClick={() => pending.refetch().then(() => queryClient.invalidateQueries({ queryKey: ['me'] }))}>
          Já paguei — atualizar
        </Button>
        <Button variant="ghost" onClick={() => dropOrder.mutate()} disabled={dropOrder.isPending}>
          Desistir do pedido
        </Button>
      </CardContent>
    </Card>
  ) : null

  const cancel = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      toast.success('Renovação cancelada. Seu acesso continua até o vencimento.')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const resume = useMutation({
    mutationFn: () => resumeSubscription(),
    onSuccess: () => {
      toast.success('Assinatura reativada.')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!sub || !valid) {
    return (
      <>
      {pendingCard}
      <EmptyState
        icon={ShieldCheck}
        title={sub ? 'Sua assinatura não está ativa' : 'Você ainda não tem assinatura'}
        description={sub ? `O plano ${sub.plan_name ?? ''} venceu em ${formatDate(sub.current_period_end)}.` : 'Assine para liberar análises completas, conferência de bilhete e radar de escanteios.'}
        action={
          <Button asChild>
            <Link to="/planos">Ver planos</Link>
          </Button>
        }
      />
      </>
    )
  }

  const days = daysUntil(sub.current_period_end)
  return (
    <>
    {pendingCard}
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-2xl">Plano {sub.plan_name}</CardTitle>
            {sub.cancel_at_period_end ? <Badge variant="warning">Cancelada — acesso até o vencimento</Badge> : <Badge variant="success">Ativa</Badge>}
            {sub.provider === 'demo' && <Badge variant="outline">Demonstração</Badge>}
          </div>
          <CardDescription>Início em {formatDate(sub.current_period_start)}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-4">
            <CalendarClock className="size-6 text-primary" />
            <div>
              <p className="text-sm text-secondary-foreground">Vencimento</p>
              <p className="font-display text-lg font-bold text-brand-dark">
                {formatDateTime(sub.current_period_end)} <span className="text-sm font-normal text-muted-foreground">({days} {days === 1 ? 'dia' : 'dias'})</span>
              </p>
            </div>
          </div>
          {sub.provider === 'demo' ? (
            <p className="text-sm text-muted-foreground">Assinatura de demonstração: nenhuma cobrança foi feita e não há renovação automática.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {sub.cancel_at_period_end ? 'Renovação cancelada: não haverá novas cobranças.' : 'Renovação automática pelo Asaas. Cancele quando quiser; o acesso segue até o vencimento.'}
            </p>
          )}
          {sub.cancel_at_period_end ? (
            <Button variant="outline" onClick={() => resume.mutate()} disabled={resume.isPending}>
              {sub.provider === 'asaas' ? 'Retomar renovação' : 'Manter assinatura'}
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                  Cancelar assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar a assinatura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você mantém o acesso até {formatDate(sub.current_period_end)}. Depois disso, as análises completas e a conferência de bilhete ficam bloqueadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => cancel.mutate()}>
                    Confirmar cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trocar de plano</CardTitle>
          <CardDescription>O novo plano substitui o atual assim que for ativado (no Asaas, após o pagamento).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setChangeTo(p)}
              className="flex items-center justify-between rounded-xl border p-4 text-left transition hover:border-primary hover:bg-secondary/50 cursor-pointer"
            >
              <span>
                <span className="font-semibold">{p.name}</span>
                {p.id === sub.plan_id && <span className="ml-2 text-xs text-primary">(atual)</span>}
                {p.monthly_equivalent_cents && <span className="block text-xs text-muted-foreground">Equivale a {formatBRL(p.monthly_equivalent_cents)}/mês</span>}
              </span>
              <span className="font-display font-bold tabular">{formatBRL(p.price_cents)}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <CheckoutDialog plan={changeTo} open={!!changeTo} onOpenChange={(o) => !o && setChangeTo(null)} replacing />
    </div>
    </>
  )
}

const METHOD: Record<PaymentRow['method'], string> = { card: 'Cartão', pix: 'Pix', boleto: 'Boleto' }
const STATUS: Record<PaymentRow['status'], { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' | 'outline' }> = {
  demo: { label: 'Demonstração', variant: 'outline' },
  pending: { label: 'Aguardando pagamento', variant: 'warning' },
  overdue: { label: 'Vencido', variant: 'danger' },
  canceled: { label: 'Cancelado', variant: 'muted' },
  paid: { label: 'Pago', variant: 'success' },
  failed: { label: 'Falhou', variant: 'danger' },
  refunded: { label: 'Estornado', variant: 'muted' },
}

function PagamentosTab() {
  const { user } = useMe()
  const { data, isLoading } = useQuery({
    queryKey: ['payments', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, plan_id, amount_cents, currency, method, status, provider, invoice_url, due_date, created_at, plans(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw new Error('Não foi possível carregar os pagamentos.')
      return data as unknown as Array<PaymentRow & { plans: { name: string } | null }>
    },
  })
  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />
  if (!data?.length) return <EmptyState icon={CreditCard} title="Nenhum pagamento registrado" description="Seus pagamentos aparecerão aqui." />
  return (
    <Card>
      <CardContent className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Data</th>
                <th className="px-5 py-3 font-semibold">Plano</th>
                <th className="px-5 py-3 font-semibold">Método</th>
                <th className="px-5 py-3 text-right font-semibold">Valor</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 tabular">{formatDateTime(p.created_at)}</td>
                  <td className="px-5 py-3">{p.plans?.name ?? '—'}</td>
                  <td className="px-5 py-3">{METHOD[p.method]}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular">{formatBRL(p.amount_cents)}</td>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge>
                      {(p.status === 'pending' || p.status === 'overdue') && p.invoice_url && (
                        <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
                          Pagar
                        </a>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">Registros com status “Demonstração” não envolveram cobrança. Pagamentos reais são processados pelo Asaas.</p>
      </CardContent>
    </Card>
  )
}
