// Verificações de identidade e permissão (somente servidor).
import { getRequestHeader } from '@tanstack/react-start/server'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Valida o token Bearer da requisição no Supabase Auth. */
export async function resolveUser() {
  const header = getRequestHeader('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data.user) return null
  return { user: data.user, token }
}

export async function userIsAdmin(userId: string) {
  const { data, error } = await supabaseAdmin().rpc('has_role', { _user_id: userId, _role: 'admin' })
  if (error) throw new Error('Falha ao verificar permissões.')
  return data === true
}

export async function userHasActiveSubscription(userId: string) {
  const { data, error } = await supabaseAdmin().rpc('has_active_subscription', { _user_id: userId })
  if (error) throw new Error('Falha ao verificar assinatura.')
  return data === true
}
