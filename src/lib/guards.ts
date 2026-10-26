import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

/** Exige sessão (rotas client-only). A autorização real é feita no servidor/RLS. */
export async function requireSession(location: ParsedLocation) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw redirect({ to: '/auth', search: { redirect: location.href } })
  return data.session
}

export async function requireAdminRole(location: ParsedLocation) {
  const session = await requireSession(location)
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'admin').maybeSingle()
  if (!data) throw redirect({ to: '/' })
  return session
}
