import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Bell, CreditCard, KeyRound, TicketCheck, TrendingUp, Users } from 'lucide-react'
import { AnimatedNumber } from '@/components/common/animated-number'
import { GroupedBars } from '@/components/stats/grouped-bars'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { generateVapidKeys } from '@/lib/pwa'
import { formatBRL, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getBusinessStats } from '@/server/business.functions'

const PLAN: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
}
const KIND: Record<string, string> = {
  discord: 'Resumo no Discord',
  email: 'E-mails automáticos',
  push: 'Notificações',
  live: 'Placar ao vivo',
  logos: 'Logos guardados',
  standings: 'Classificações',
  auto: 'Automação diária',
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="size-4 text-primary" /> {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-brand-dark tabular">
        <AnimatedNumber value={value} />
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** Visão de negócio: cadastros, assinantes, receita e saúde das automações. */
export function BusinessPanel() {
  const q = useQuery({
    queryKey: ['business-stats'],
    queryFn: () => getBusinessStats(),
    staleTime: 60_000,
  })
  const d = q.data
  if (!d) return q.isError ? <p className="text-sm text-red-600 dark:text-red-400">Não foi possível carregar os números.</p> : <Skeleton className="h-96 rounded-2xl" />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label="Cadastros" value={d.users.total} sub={`+${d.users.last7} em 7 dias · +${d.users.last30} em 30`} />
        <Tile icon={CreditCard} label="Assinantes ativos" value={d.subs.active} sub={`${d.subs.paidActive} pagos · ${d.subs.demoActive} em demonstração`} />
        <Tile icon={TrendingUp} label="Receita recorrente (MRR)" value={formatBRL(d.revenue.mrr)} sub={`${formatBRL(d.revenue.last30)} recebidos em 30 dias`} />
        <Tile icon={TicketCheck} label="Bilhetes montados" value={d.usage.slips} sub={`+${d.usage.slips7} em 7 dias · ${d.usage.favorites} times favoritos`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="font-display text-lg font-bold text-brand-dark">Cadastros por dia</h3>
          <p className="mb-3 text-xs text-muted-foreground">Últimos 30 dias (horário de Brasília).</p>
          <GroupedBars
            ariaLabel="Cadastros por dia nos últimos 30 dias"
            unit="cadastro(s)"
            height={200}
            series={[
              {
                name: 'Cadastros',
                color: 'var(--series-home)',
                points: d.users.perDay.map((p) => ({
                  value: p.count,
                  detail: p.date.split('-').reverse().join('/'),
                })),
              },
            ]}
          />
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h3 className="font-display text-lg font-bold text-brand-dark">Assinaturas</h3>
          {Object.keys(PLAN).map((p) => (
            <div key={p} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{PLAN[p]}</span>
              <span className="font-display font-bold tabular">{d.subs.byPlan[p] ?? 0}</span>
            </div>
          ))}
          <div className="border-t pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cancelando (acesso até o vencimento)</span>
              <span className="font-display font-bold tabular">{d.subs.cancelling}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Cancelamentos em 30 dias</span>
              <span className="font-display font-bold tabular">{d.subs.canceled30}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Receita total recebida</span>
              <span className="font-display font-bold tabular">{formatBRL(d.revenue.allTime)}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
            <Activity className="size-5 text-primary" /> Consumo das APIs
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">API-Football: consultas restantes hoje</span>
              <span className="font-display font-bold tabular">{d.api.remaining ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IA hoje</span>
              <span className="font-display font-bold tabular">
                {d.api.aiToday}/{d.api.aiLimit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aparelhos com notificação ligada</span>
              <span className="font-display font-bold tabular">{d.usage.push ?? '—'}</span>
            </div>
            {d.api.lastRunAt && <p className="text-xs text-muted-foreground">Última leitura da cota: {formatDateTime(d.api.lastRunAt)}</p>}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
            <Bell className="size-5 text-primary" /> Automações
          </h3>
          {d.channels.length ? (
            <ul className="divide-y text-sm">
              {d.channels.map((c) => (
                <li key={c.kind} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{KIND[c.kind] ?? c.kind}</span>
                    {c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}
                  </span>
                  <span className="text-right text-xs">
                    <span className={cn('font-bold', c.status === 'ok' ? 'text-primary' : 'text-red-600 dark:text-red-400')}>{c.status === 'ok' ? 'OK' : 'Erro'}</span>
                    <span className="block text-muted-foreground">{formatDateTime(c.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
          )}
        </section>
      </div>
      <VapidKeysCard />
    </div>
  )
}

/** Gera as chaves das notificações no próprio navegador (nada é enviado ao servidor). */
export function VapidKeysCard() {
  const [keys, setKeys] = React.useState<{ publicKey: string; privateKey: string } | null>(null)
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-brand-dark">
        <KeyRound className="size-5 text-primary" /> Chaves das notificações (VAPID)
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Gere uma vez e guarde como segredos: <code>VAPID_PUBLIC_KEY</code> e <code>VAPID_PRIVATE_KEY</code> no Netlify e no GitHub. As chaves são criadas aqui no seu navegador e não ficam salvas no
        site. Se trocar as chaves depois, quem já ativou precisa ativar de novo.
      </p>
      {keys ? (
        <div className="space-y-2 text-xs">
          {(
            [
              ['VAPID_PUBLIC_KEY', keys.publicKey],
              ['VAPID_PRIVATE_KEY', keys.privateKey],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <p className="font-semibold">{k}</p>
              <div className="flex gap-2">
                <input readOnly value={v} className="h-9 min-w-0 flex-1 rounded-lg border bg-muted px-2 font-mono" onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(v)}>
                  Copiar
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Button size="sm" onClick={async () => setKeys(await generateVapidKeys())}>
          <KeyRound /> Gerar chaves
        </Button>
      )}
    </section>
  )
}
