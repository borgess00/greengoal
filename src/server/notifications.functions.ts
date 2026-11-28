// Preferências de notificação do usuário e inscrições de notificação no aparelho.
// Gravação sempre pelo servidor (service role) depois de validar a sessão.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from './auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

export interface NotifyPrefs {
  bilhetes_prontos: boolean
  favoritos: boolean
  conferidos: boolean
}
const DEFAULT_PREFS: NotifyPrefs = {
  bilhetes_prontos: true,
  favoritos: true,
  conferidos: true,
}
const PENDING = 'As notificações ficam disponíveis depois da atualização do banco de dados.'

export const getNotifySettings = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = supabaseAdmin()
    const [{ data: p, error }, { data: subs }] = await Promise.all([
      db.from('profiles').select('notify_prefs, email_opt_out').eq('id', context.user.id).maybeSingle(),
      db.from('push_subscriptions').select('endpoint').eq('user_id', context.user.id),
    ])
    return {
      ready: !error,
      message: error ? PENDING : null,
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
      prefs: {
        ...DEFAULT_PREFS,
        ...((p?.notify_prefs as Partial<NotifyPrefs> | null) ?? {}),
      },
      emailOptOut: Boolean(p?.email_opt_out),
      endpoints: (subs ?? []).map((s) => s.endpoint as string),
    }
  })

export const saveNotifyPrefs = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { prefs: NotifyPrefs; emailOptOut: boolean }) =>
    z
      .object({
        prefs: z.object({
          bilhetes_prontos: z.boolean(),
          favoritos: z.boolean(),
          conferidos: z.boolean(),
        }),
        emailOptOut: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await supabaseAdmin().from('profiles').update({ notify_prefs: data.prefs, email_opt_out: data.emailOptOut }).eq('id', context.user.id)
    if (error) throw new Error(PENDING)
    return { ok: true }
  })

export const savePushSubscription = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    z
      .object({
        endpoint: z.string().url().max(1000).startsWith('https://'),
        keys: z.object({
          p256dh: z.string().min(10).max(200),
          auth: z.string().min(4).max(100),
        }),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = supabaseAdmin()
    const { count } = await db.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }).eq('user_id', context.user.id)
    if ((count ?? 0) >= 10) throw new Error('Limite de 10 aparelhos com notificação. Desligue em algum aparelho antigo.')
    const { error } = await db.from('push_subscriptions').upsert({
      endpoint: data.endpoint,
      user_id: context.user.id,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    })
    if (error) throw new Error(PENDING)
    return { ok: true }
  })

export const removePushSubscription = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator((d: { endpoint: string }) => z.object({ endpoint: z.string().max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    await supabaseAdmin().from('push_subscriptions').delete().eq('endpoint', data.endpoint).eq('user_id', context.user.id)
    return { ok: true }
  })
