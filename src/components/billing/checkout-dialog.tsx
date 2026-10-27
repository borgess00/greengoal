import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, ExternalLink, FlaskConical, Lock, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/use-auth'
import { formatCpfCnpj, isValidCpfCnpj } from '@/lib/cpf'
import { errorMessage, formatBRL } from '@/lib/format'
import { PERIOD_LABEL } from '@/lib/plans'
import type { PlanRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getBillingInfo, startCheckout } from '@/server/billing.functions'

const RENEWAL: Record<string, string> = { weekly: 'toda semana', monthly: 'todo mês', annual: 'todo ano' }

export function CheckoutDialog({ plan, open, onOpenChange, replacing }: { plan: PlanRow | null; open: boolean; onOpenChange: (o: boolean) => void; replacing?: boolean }) {
  const [method, setMethod] = React.useState<'card' | 'pix'>('pix')
  const [doc, setDoc] = React.useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const info = useQuery({ queryKey: ['billing-info', user?.id], queryFn: () => getBillingInfo(), enabled: open, staleTime: 60_000 })
  const real = info.data?.mode === 'asaas'
  const needsDoc = real && !info.data?.document

  const mutation = useMutation({
    mutationFn: () => startCheckout({ data: { planId: plan!.id, method, cpfCnpj: needsDoc ? doc : undefined } }),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      await queryClient.invalidateQueries({ queryKey: ['payments'] })
      if (r.mode === 'asaas') {
        if (r.invoiceUrl) {
          toast.success('Pedido criado. Abrindo a página de pagamento do Asaas…')
          window.location.href = r.invoiceUrl
          return
        }
        toast.success('Pedido criado. O link de pagamento chegará no seu e-mail.')
        onOpenChange(false)
        navigate({ to: '/perfil', search: { aba: 'assinatura' } })
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['analysis'] })
      toast.success(`Plano ${plan!.name} ativado em modo demonstração. Nenhuma cobrança foi feita.`)
      onOpenChange(false)
      navigate({ to: '/perfil', search: { aba: 'assinatura' } })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!plan) return null
  const docValid = !needsDoc || isValidCpfCnpj(doc)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assinar plano {plan.name}</DialogTitle>
          <DialogDescription>
            {formatBRL(plan.price_cents)} por {PERIOD_LABEL[plan.id] ?? `${plan.duration_days} dias`}
            {real && ` · renova ${RENEWAL[plan.id] ?? 'a cada período'}, cancele quando quiser`}.
          </DialogDescription>
        </DialogHeader>

        {info.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : real ? (
          <div className="flex gap-3 rounded-xl border border-primary/30 bg-secondary p-4 text-sm text-secondary-foreground">
            <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Pagamento seguro pelo Asaas</p>
              <p className="mt-1">
                Você será levado à página do Asaas para pagar. O acesso é liberado assim que o pagamento for confirmado — no Pix, em instantes; no cartão, após a aprovação.
              </p>
              {info.data?.sandbox && <p className="mt-2 font-semibold text-amber-700">Ambiente de testes do Asaas: nenhuma cobrança real.</p>}
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            <FlaskConical className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">Modo demonstração — nenhuma cobrança será feita.</p>
              <p className="mt-1">O pagamento real ainda não está ativado. Ao confirmar, o acesso é liberado pelo prazo do plano apenas para testes, sem cobrança e sem renovação automática.</p>
            </div>
          </div>
        )}

        {needsDoc && (
          <div className="grid gap-1.5">
            <Label htmlFor="doc">CPF ou CNPJ do pagador</Label>
            <Input id="doc" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={doc} onChange={(e) => setDoc(formatCpfCnpj(e.target.value))} aria-invalid={doc.length > 0 && !docValid} />
            <p className="text-xs text-muted-foreground">Exigido pelo Asaas para emitir a cobrança. Informado uma única vez.</p>
          </div>
        )}
        {real && info.data?.document && <p className="text-xs text-muted-foreground">Cobrança no documento {info.data.document}.</p>}

        <div>
          <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as 'card' | 'pix')} className="grid-cols-2">
            {(
              [
                { id: 'pix', label: 'Pix', icon: QrCode },
                { id: 'card', label: 'Cartão', icon: CreditCard },
              ] as const
            ).map((m) => (
              <Label
                key={m.id}
                htmlFor={`m-${m.id}`}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition', method === m.id ? 'border-primary bg-secondary' : 'border-border hover:border-primary/40')}
              >
                <RadioGroupItem value={m.id} id={`m-${m.id}`} />
                <m.icon className="size-5 text-primary" />
                {m.label}
              </Label>
            ))}
          </RadioGroup>
          {real && method === 'pix' && <p className="mt-2 text-xs text-muted-foreground">No Pix, a cada renovação chega uma nova cobrança por e-mail.</p>}
          {real && method === 'card' && <p className="mt-2 text-xs text-muted-foreground">No cartão, as renovações são cobradas automaticamente.</p>}
        </div>

        {replacing && <p className="text-xs text-muted-foreground">A assinatura atual será substituída por este plano quando o pagamento for confirmado.</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || info.isLoading || !docValid}>
            {mutation.isPending ? 'Aguarde…' : real ? (
              <>
                Ir para o pagamento <ExternalLink />
              </>
            ) : (
              'Ativar demonstração'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
