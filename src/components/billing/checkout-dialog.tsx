import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, FlaskConical, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { startCheckout } from '@/server/billing.functions'
import { errorMessage, formatBRL } from '@/lib/format'
import { PERIOD_LABEL } from '@/lib/plans'
import type { PlanRow } from '@/lib/types'
import { cn } from '@/lib/utils'

export function CheckoutDialog({ plan, open, onOpenChange, replacing }: { plan: PlanRow | null; open: boolean; onOpenChange: (o: boolean) => void; replacing?: boolean }) {
  const [method, setMethod] = React.useState<'card' | 'pix'>('pix')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () => startCheckout({ data: { planId: plan!.id, method } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      await queryClient.invalidateQueries({ queryKey: ['analysis'] })
      await queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success(`Plano ${plan!.name} ativado em modo demonstração. Nenhuma cobrança foi feita.`)
      onOpenChange(false)
      navigate({ to: '/perfil', search: { aba: 'assinatura' } })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (!plan) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assinar plano {plan.name}</DialogTitle>
          <DialogDescription>
            {formatBRL(plan.price_cents)} por {PERIOD_LABEL[plan.id] ?? `${plan.duration_days} dias`}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <FlaskConical className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">Modo demonstração — nenhuma cobrança será feita.</p>
            <p className="mt-1">O pagamento real ainda não está integrado. Ao confirmar, o acesso é liberado pelo prazo do plano apenas para testes, sem cobrança no cartão ou Pix e sem renovação automática.</p>
          </div>
        </div>

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
        </div>

        {replacing && <p className="text-xs text-muted-foreground">Sua assinatura atual será substituída por este plano a partir de agora.</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Ativando…' : 'Ativar demonstração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
