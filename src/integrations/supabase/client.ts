// Cliente Supabase do navegador (Lovable Cloud). Usa apenas a chave
// pública; o acesso real é decidido pelo RLS do banco.
import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from './url'

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const key = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined)?.trim()

export const supabaseConfigured = !!(url && key)

const isBrowser = typeof window !== 'undefined'

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'public-anon-key-missing', {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    flowType: 'pkce',
  },
})

export async function getAccessToken(): Promise<string | null> {
  if (!isBrowser) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
