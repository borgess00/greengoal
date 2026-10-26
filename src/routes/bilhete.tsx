import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleHelp, CircleX, Clock, History, Lock, Search, Ticket, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { errorMessage, formatDateTime } from '@/lib/format'
import { requireSession } from '@/lib/guards'
import { seo } from '@/lib/seo'
import { OUTCOME_LABELS, TICKET_MAX_CHARS, TICKET_MAX_LINES, TICKET_MIN_CHARS, type Outcome, type TicketResult } from '@/lib/tickets'
import type { TicketRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { checkTicketFn } from '@/server/tickets.functions'

export const Route = createFileRoute('/bilhete')({
  ssr: false,
  beforeLoad: ({ location }) => requireSession(location),
  head: () =>
    seo({ title: 'Conferir bilhete', description: 'Confira seus palpites contra os placares das partidas armazenadas. Recurso exclusivo para assinantes.', path: '/bilhete', noindex: true }),
  component: BilhetePage,
})

const DISCLAIMER = 'Resultado de conferência informativo. Não há garantia de lucro.'
const EXAMPLE = `Palmeiras x Flamengo - Casa
Arsenal x Chelsea - Mais de 2.5 gols
Real Madrid x Barcelona - Ambos marcam
Inter x Milan - Empate`

const OUTCOME_STYLE: Record<Outcome, { icon: React.ComponentType<{ className?: string }>; badge: 'success' | 'danger' | 'warning' | 'muted' | 'outline'; row: string }> = {
  won: { icon: CircleCheck, badge: 'success', row: 'border-l-green-500' },
  lost: { icon: CircleX, badge: 'danger', row: 'border-l-red-500' },
  open: { icon: Clock, badge: 'warning', row: 'border-l-amber-400' },
  not_found: { icon: CircleHelp, badge: 'muted', row: 'border-l-slate-300' },
  invalid: { icon: TriangleAlert, badge: 'outline', row: 'border-l-slate-300' },
}

function BilhetePage() {
  const { me, loading } = useMe()
  const allowed = !!me && (me.hasActiveSubscription || me.isAdmin)

  return (
    <>
      <PageHeader eyebrow="Assinantes" title="Conferir bilhete" description="Cole seus palpites, um jogo por linha, e veja o que acertou, errou ou ainda está em aberto." />
      <div className="container-page py-8">
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : !allowed ? (
          <EmptyState
            icon={Lock}
            title="Recurso exclusivo para assinantes"
            description="A conferência de bilhete fica disponível com qualquer plano ativo."
            action={
              <Button asChild>
                <Link to="/planos">Assine para liberar</Link>
              </Button>
            }
          />
        ) : (
          <TicketChecker />
        )}
      </div>
    </>
  )
}

function TicketChecker() {
  const queryClient = useQueryClient()
  const { user } = useMe()
  const [input, setInput] = React.useState('')
  const lines = input.split(/\r?\n/).filter((l) => l.trim()).length
  const check = useMutation({
    mutationFn: () => checkTicketFn({ data: { input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const history = useQuery({
    queryKey: ['tickets', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('id, input, results, summary, created_at').order('created_at', { ascending: false }).limit(20)
      if (error) throw new Error('Não foi possível carregar o histórico.')
      return data as TicketRow[]
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tickets').delete().eq('id', id)
      if (error) throw new Error('Não foi possível excluir.')
    },
    onSuccess: () => {
      toast.success('Conferência excluída.')
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const tooShort = input.trim().length < TICKET_MIN_CHARS
  const tooLong = input.length > TICKET_MAX_CHARS

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-primary" /> Seu bilhete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!tooShort && !tooLong) check.mutate()
              }}
              className="space-y-3"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={EXAMPLE}
                rows={8}
                maxLength={TICKET_MAX_CHARS + 200}
                aria-describedby="ticket-help"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className={cn(tooLong && 'font-semibold text-red-600')}>
                  {input.length}/{TICKET_MAX_CHARS} caracteres · {lines} {lines === 1 ? 'linha' : 'linhas'}
                  {lines > TICKET_MAX_LINES && ` (apenas as ${TICKET_MAX_LINES} primeiras serão conferidas)`}
                </span>
                <button type="button" className="font-semibold text-primary hover:underline cursor-pointer" onClick={() => setInput(EXAMPLE)}>
                  Usar exemplo
                </button>
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={check.isPending || tooShort || tooLong}>
                <Search /> {check.isPending ? 'Conferindo…' : 'Conferir bilhete'}
              </Button>
            </form>
            <div id="ticket-help" className="mt-5 rounded-xl bg-muted/60 p-4 text-sm">
              <p className="font-semibold">Formato: Time A x Time B - palpite</p>
              <p className="mt-1 text-muted-foreground">
                Palpites aceitos: Casa ou 1 · Empate ou X · Fora ou 2 · 1X, X2, 12 · Mais de 2.5 gols · Menos de 2.5 gols (linhas de 0.5 a 7.5) · Ambos marcam · Ambos não marcam.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                A busca usa o nome das equipes nas partidas armazenadas dos últimos dez dias e confere pelo placar do tempo regulamentar. Não calcula retorno financeiro nem odds.
              </p>
            </div>
          </CardContent>
        </Card>

        {check.data && <TicketResults results={check.data.results} truncated={check.data.truncated} />}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" /> Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !history.data?.length ? (
            <p className="text-sm text-muted-foreground">Suas conferências aparecerão aqui.</p>
          ) : (
            <ul className="divide-y">
              {history.data.map((t) => (
                <li key={t.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <button className="min-w-0 text-left cursor-pointer" onClick={() => setInput(t.input)} title="Carregar este bilhete">
                      <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
                      <p className="truncate text-sm font-medium">{t.input.split('\n')[0]}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(['won', 'lost', 'open'] as const).map((k) =>
                          t.summary?.[k] ? (
                            <Badge key={k} variant={OUTCOME_STYLE[k].badge}>
                              {t.summary[k]} {OUTCOME_LABELS[k].toLowerCase()}
                            </Badge>
                          ) : null,
                        )}
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Excluir conferência" onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TicketResults({ results, truncated }: { results: TicketResult[]; truncated: number }) {
  const counts = results.reduce<Record<Outcome, number>>((a, r) => ({ ...a, [r.outcome]: a[r.outcome] + 1 }), { won: 0, lost: 0, open: 0, not_found: 0, invalid: 0 })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado da conferência</CardTitle>
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(counts) as Outcome[])
            .filter((k) => counts[k])
            .map((k) => (
              <Badge key={k} variant={OUTCOME_STYLE[k].badge}>
                {counts[k]} {OUTCOME_LABELS[k]}
              </Badge>
            ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((r) => {
          const style = OUTCOME_STYLE[r.outcome]
          const Icon = style.icon
          return (
            <div key={r.line} className={cn('rounded-lg border border-l-4 bg-card p-3', style.row)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.fixture ? `${r.fixture.home} x ${r.fixture.away}` : r.raw}</p>
                  {r.pickLabel && <p className="text-xs text-muted-foreground">Palpite: {r.pickLabel}</p>}
                  {r.fixture && (
                    <p className="text-xs text-muted-foreground">
                      {r.fixture.league_name} · {formatDateTime(r.fixture.kickoff_at)}
                      {r.fixture.score && <span className="ml-1 font-semibold text-foreground">· Placar {r.fixture.score}</span>}
                    </p>
                  )}
                  {r.detail && <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>}
                </div>
                <Badge variant={style.badge} className="shrink-0">
                  <Icon /> {OUTCOME_LABELS[r.outcome]}
                </Badge>
              </div>
            </div>
          )
        })}
        {truncated > 0 && <p className="text-xs text-muted-foreground">{truncated} linha(s) além do limite de {TICKET_MAX_LINES} não foram conferidas.</p>}
        <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{DISCLAIMER}</p>
      </CardContent>
    </Card>
  )
}
