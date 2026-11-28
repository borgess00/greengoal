// Painel de negócios do Admin: cadastros, assinantes, receita, cancelamentos,
// uso do site e consumo das APIs. Tudo lido no servidor com permissão de admin.
import { createServerFn } from '@tanstack/react-start'
import { addDays, spParts, spToday } from '@/lib/grade'
import { requireAdmin } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

export interface BusinessStats {
  users: { total: number; last7: number; last30: number; perDay: Array<{ date: string; count: number }> }
  subs: { active: number; byPlan: Record<string, number>; paidActive: number; demoActive: number; cancelling: number; canceled30: number }
  revenue: { last30: number; allTime: number; mrr: number }
  usage: { slips: number; slips7: number; favorites: number; push: number | null }
  api: { remaining: number | null; lastRunAt: string | null; aiToday: number; aiLimit: number }
  channels: Array<{ kind: string; status: string; at: string; detail: string | null }>
}

const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
  const r = await q
  return r.error ? null : (r.count ?? 0)
}

export const getBusinessStats = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async (): Promise<BusinessStats> => {
    const db = supabaseAdmin()
    const today = spToday()
    const from30 = addDays(today, -29)

    // Cadastros (Supabase Auth, em páginas de 1000).
    const created: string[] = []
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) break
      created.push(...data.users.map((u) => u.created_at))
      if (data.users.length < 1000) break
    }
    const days = created.map((c) => spParts(c).date)
    const perDay = Array.from({ length: 30 }, (_, i) => {
      const date = addDays(from30, i)
      return { date, count: days.filter((d) => d === date).length }
    })

    const now = new Date().toISOString()
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
    const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
    const [{ data: subs }, { data: plans }, { data: paid }, { data: runs }, { data: ai }, { data: limit }] = await Promise.all([
      db.from('subscriptions').select('plan_id, status, provider, cancel_at_period_end, canceled_at, current_period_end'),
      db.from('plans').select('id, price_cents, duration_days'),
      db.from('payments').select('amount_cents, status, created_at').eq('status', 'paid'),
      db.from('sync_runs').select('kind, status, details, created_at').order('created_at', { ascending: false }).limit(200),
      db.from('ai_usage').select('calls').eq('day', today).maybeSingle(),
      db.from('app_settings').select('value').eq('key', 'ai_daily_limit').maybeSingle(),
    ])
    const active = (subs ?? []).filter((s) => s.status === 'active' && (s.current_period_end as string) > now)
    const byPlan: Record<string, number> = {}
    for (const s of active) byPlan[s.plan_id as string] = (byPlan[s.plan_id as string] ?? 0) + 1
    const price = new Map((plans ?? []).map((p) => [p.id as string, { cents: p.price_cents as number, days: p.duration_days as number }]))
    const paidActive = active.filter((s) => s.provider !== 'demo')
    // Receita recorrente mensal estimada: preço de cada assinatura paga convertido para 30 dias.
    const mrr = paidActive.reduce((sum, s) => {
      const p = price.get(s.plan_id as string)
      return p ? sum + (p.cents / p.days) * 30 : sum
    }, 0)
    const payRows = paid ?? []

    const lastSync = (runs ?? []).find((r) => (r.details as { api_remaining?: number } | null)?.api_remaining != null)
    const channels = ['discord', 'email', 'push', 'live', 'logos', 'standings', 'auto']
      .map((kind) => (runs ?? []).find((r) => r.kind === kind))
      .filter(Boolean)
      .map((r) => ({ kind: r!.kind as string, status: r!.status as string, at: r!.created_at as string, detail: ((r!.details as { message?: string; resumo?: string } | null)?.message ?? (r!.details as { resumo?: string } | null)?.resumo) ?? null }))

    return {
      users: { total: created.length, last7: created.filter((c) => c >= since7).length, last30: created.filter((c) => c >= since30).length, perDay },
      subs: {
        active: active.length,
        byPlan,
        paidActive: paidActive.length,
        demoActive: active.length - paidActive.length,
        cancelling: active.filter((s) => s.cancel_at_period_end).length,
        canceled30: (subs ?? []).filter((s) => s.canceled_at && (s.canceled_at as string) >= since30).length,
      },
      revenue: {
        last30: payRows.filter((p) => (p.created_at as string) >= since30).reduce((s, p) => s + (p.amount_cents as number), 0),
        allTime: payRows.reduce((s, p) => s + (p.amount_cents as number), 0),
        mrr: Math.round(mrr),
      },
      usage: {
        slips: (await count(db.from('user_slips').select('id', { count: 'exact', head: true }))) ?? 0,
        slips7: (await count(db.from('user_slips').select('id', { count: 'exact', head: true }).gte('created_at', since7))) ?? 0,
        favorites: (await count(db.from('favorite_teams').select('team_id', { count: 'exact', head: true }))) ?? 0,
        push: await count(db.from('push_subscriptions').select('endpoint', { count: 'exact', head: true })),
      },
      api: {
        remaining: (lastSync?.details as { api_remaining?: number } | undefined)?.api_remaining ?? null,
        lastRunAt: (lastSync?.created_at as string | undefined) ?? null,
        aiToday: (ai?.calls as number | undefined) ?? 0,
        aiLimit: Number(limit?.value ?? 50),
      },
      channels,
    }
  })
