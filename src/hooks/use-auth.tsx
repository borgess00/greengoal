// Sessão do usuário (Supabase) + dados da conta (perfil, papéis, assinatura).
import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/integrations/supabase/client'
import { isSubscriptionValid, type SubscriptionRow } from '@/lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = React.createContext<AuthState>({ session: null, user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ session: null, user: null, loading: true })
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!supabaseConfigured) {
      setState({ session: null, user: null, loading: false })
      return
    }
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, user: data.session?.user ?? null, loading: false })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, user: session?.user ?? null, loading: false })
      if (event === 'SIGNED_OUT') queryClient.clear()
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') queryClient.invalidateQueries({ queryKey: ['me'] })
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return React.useContext(AuthContext)
}

export interface MeData {
  fullName: string | null
  email: string | null
  isAdmin: boolean
  subscription: (SubscriptionRow & { plan_name: string | null }) | null
  hasActiveSubscription: boolean
}

export async function fetchMe(user: User): Promise<MeData> {
  const [profile, roles, subs] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase
      .from('subscriptions')
      .select('id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, provider, created_at, plans(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  const list = (subs.data ?? []) as unknown as Array<SubscriptionRow & { plans: { name: string } | null }>
  const active = list.find((s) => isSubscriptionValid(s)) ?? null
  const latest = active ?? list[0] ?? null
  return {
    fullName: (profile.data?.full_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    email: user.email ?? null,
    isAdmin: (roles.data ?? []).some((r) => r.role === 'admin'),
    subscription: latest ? { ...latest, plan_name: latest.plans?.name ?? null } : null,
    hasActiveSubscription: !!active,
  }
}

/** Dados da conta do usuário logado (null para visitantes). */
export function useMe() {
  const { user, loading } = useAuth()
  const query = useQuery({
    queryKey: ['me', user?.id],
    queryFn: () => fetchMe(user!),
    enabled: !!user,
    staleTime: 60_000,
  })
  return {
    user,
    me: user ? (query.data ?? null) : null,
    loading: loading || (!!user && query.isLoading),
    refetch: query.refetch,
  }
}

export async function signOut(queryClient: ReturnType<typeof useQueryClient>) {
  await supabase.auth.signOut()
  queryClient.clear()
}
