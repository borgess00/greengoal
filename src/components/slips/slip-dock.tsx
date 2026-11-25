import * as React from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, TicketCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/hooks/use-auth'
import { errorMessage } from '@/lib/format'
import { slipDraft, useSlipDraft } from '@/lib/slip-store'
import { slipOdd } from '@/lib/slips'
import { cn } from '@/lib/utils'
import { createSlip } from '@/server/slips.functions'

const fmtOdd = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Botão flutuante + painel do bilhete em montagem (como num app de apostas). */
export function SlipDock() {
  const draft = useSlipDraft()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [stake, setStake] = React.useState('1')
  const total = slipOdd(draft)

  // Abre o painel quando alguém adiciona uma seleção em outra parte do site.
  React.useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('greengoal:open-slip', onOpen)
    return () => window.removeEventListener('greengoal:open-slip', onOpen)
  }, [])

  const save = useMutation({
    mutationFn: () =>
      createSlip({
        data: {
          title: title.trim() || undefined,
          stake: Number(stake.replace(',', '.')) || 1,
          selections: draft.map((s) => ({ fixtureId: s.fixtureId, market: s.market, odd: s.odd })),
        },
      }),
    onSuccess: () => {
      toast.success('Bilhete salvo! Ele será conferido sozinho quando os jogos acabarem.')
      slipDraft.clear()
      setTitle('')
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['my-slips'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate({ to: '/meus-bilhetes' })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!draft.length && !open) return null

  return (
    <>
      {draft.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full bg-brand-light px-4 py-3 font-semibold text-ink shadow-[0_10px_30px_-8px_rgb(74_222_128/0.6)] transition hover:scale-[1.02] lg:right-6 lg:bottom-6"
          aria-label={`Abrir bilhete com ${draft.length} seleção(ões)`}
        >
          <TicketCheck className="size-5" />
          Bilhete
          <span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-white">{draft.length}</span>
          {total != null && <span className="font-display tabular">· {fmtOdd(total)}</span>}
        </button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md gap-0 p-0">
          <div className="border-b p-5 pr-14">
            <SheetTitle>Montar bilhete</SheetTitle>
            <SheetDescription>Uma seleção por partida. Salve para acompanhar se bateu ou não.</SheetDescription>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {draft.length ? (
              draft.map((s) => (
                <div key={s.fixtureId} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">
                        {s.league} · {new Date(s.kickoff).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="truncate text-sm font-semibold">
                        {s.home} x {s.away}
                      </p>
                      <p className="mt-0.5 font-display font-bold text-brand-dark">{s.label}</p>
                    </div>
                    <button type="button" onClick={() => slipDraft.remove(s.fixtureId)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Remover ${s.home} x ${s.away}`}>
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Label htmlFor={`odd-${s.fixtureId}`} className="text-xs text-muted-foreground">
                      Odd
                    </Label>
                    <Input
                      id={`odd-${s.fixtureId}`}
                      inputMode="decimal"
                      placeholder="opcional"
                      defaultValue={s.odd != null ? String(s.odd).replace('.', ',') : ''}
                      onBlur={(e) => {
                        const v = Number(e.target.value.replace(',', '.'))
                        slipDraft.setOdd(s.fixtureId, e.target.value.trim() && Number.isFinite(v) && v >= 1.01 && v <= 1000 ? Math.round(v * 100) / 100 : null)
                      }}
                      className="h-9 w-28 text-sm"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Seu bilhete está vazio. Abra uma partida e toque em <strong>+ Bilhete</strong> num mercado.
              </p>
            )}
          </div>
          {draft.length > 0 && (
            <div className="space-y-3 border-t p-5">
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="slip-title" className="text-xs">
                    Nome (opcional)
                  </Label>
                  <Input id="slip-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Múltipla de sábado" className="h-9 text-sm" />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="slip-stake" className="text-xs">
                    Unidades
                  </Label>
                  <Input id="slip-stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                <span className="text-sm font-semibold text-secondary-foreground">
                  {draft.length} seleção(ões) · odd total
                </span>
                <span className={cn('font-display text-xl font-bold tabular', total == null ? 'text-muted-foreground' : 'text-brand-dark')}>{total == null ? '—' : fmtOdd(total)}</span>
              </div>
              {total == null && <p className="text-xs text-muted-foreground">Preencha a odd de todas as seleções para calcular a odd total e o resultado em unidades.</p>}
              {user ? (
                <Button className="w-full" size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
                  <Save /> {save.isPending ? 'Salvando…' : 'Salvar em Meus bilhetes'}
                </Button>
              ) : (
                <Button asChild className="w-full" size="lg">
                  <Link to="/auth" search={{ redirect: location.href }} onClick={() => setOpen(false)}>
                    Entre para salvar o bilhete
                  </Link>
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => slipDraft.clear()}>
                <Trash2 /> Limpar bilhete
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">O GreenGoal não recebe apostas: o bilhete serve para você acompanhar seus palpites. 18+.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Avisa o painel do bilhete para abrir (usado pelos botões "+ Bilhete"). */
export function openSlipDock() {
  window.dispatchEvent(new Event('greengoal:open-slip'))
}
