// Middlewares de autenticação para createServerFn.
// O navegador anexa o token da sessão; o servidor valida o token no Supabase
// e confere papéis/assinatura antes de qualquer operação privilegiada.
import { createMiddleware } from '@tanstack/react-start'
import { getAccessToken } from '@/integrations/supabase/client'
import { supabaseAsUser } from '@/integrations/supabase/supabase.server'
import { HttpError, resolveUser, userHasActiveSubscription, userIsAdmin } from './access.server'

/** Anexa o token da sessão atual às chamadas feitas pelo navegador. */
export const attachSession = createMiddleware({ type: 'function' }).client(async ({ next }) => {
  const token = await getAccessToken()
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} })
})

/** Usuário opcional: context.auth é null para visitantes. */
export const optionalAuth = createMiddleware({ type: 'function' })
  .middleware([attachSession])
  .server(async ({ next }) => {
    const auth = await resolveUser().catch(() => null)
    return next({ context: { auth } })
  })

/** Exige login. */
export const requireAuth = createMiddleware({ type: 'function' })
  .middleware([attachSession])
  .server(async ({ next }) => {
    const auth = await resolveUser()
    if (!auth) throw new HttpError(401, 'Faça login para continuar.')
    return next({ context: { user: auth.user, token: auth.token, db: supabaseAsUser(auth.token) } })
  })

/** Exige papel de administrador (conferido no banco, no servidor). */
export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (!(await userIsAdmin(context.user.id))) throw new HttpError(403, 'Acesso restrito a administradores.')
    return next()
  })

/** Exige assinatura ativa (ou admin), conferida no servidor. */
export const requireSubscriber = createMiddleware({ type: 'function' })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const [sub, admin] = await Promise.all([userHasActiveSubscription(context.user.id), userIsAdmin(context.user.id)])
    if (!sub && !admin) throw new HttpError(402, 'Recurso exclusivo para assinantes.')
    return next()
  })
