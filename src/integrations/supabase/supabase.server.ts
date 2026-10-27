// Clientes Supabase exclusivos do servidor. A chave service_role nunca
// chega ao navegador (arquivo *.server.ts é bloqueado no bundle do cliente).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from './url'

function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : undefined
}

export function supabaseUrl() {
  const url = normalizeSupabaseUrl(env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL'))
  if (!url) throw new Error('SUPABASE_URL não configurada no servidor.')
  return url
}

function publishableKey() {
  const key = env('SUPABASE_PUBLISHABLE_KEY') ?? env('VITE_SUPABASE_PUBLISHABLE_KEY') ?? env('SUPABASE_ANON_KEY') ?? env('VITE_SUPABASE_ANON_KEY')
  if (!key) throw new Error('Chave pública do Supabase não configurada no servidor.')
  return key
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

let admin: SupabaseClient | null = null

/** Cliente com service_role: ignora RLS. Usar só após checar autorização. */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.')
  admin = createClient(supabaseUrl(), key, noSession)
  return admin
}

/** Cliente anônimo (respeita RLS) para dados públicos. */
export function supabasePublic(): SupabaseClient {
  return createClient(supabaseUrl(), publishableKey(), noSession)
}

/** Cliente que age como o usuário do token (RLS aplicado ao usuário). */
export function supabaseAsUser(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl(), publishableKey(), {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
