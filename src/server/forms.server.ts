// Forma recente (V/E/D) das partidas, para os cartões de jogos (somente servidor).
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'

export type WithForm<T> = T & { form_home?: string | null; form_away?: string | null }

/**
 * Junta a forma recente às partidas. Consulta separada e tolerante a erro:
 * sem a atualização do banco, os cartões simplesmente não mostram a forma.
 */
export async function withForms<T extends { id: number }>(rows: T[]): Promise<Array<WithForm<T>>> {
  if (!rows.length) return rows
  const { data, error } = await supabaseAdmin().from('fixtures').select('id, form_home, form_away').in('id', rows.map((r) => r.id))
  if (error || !data) return rows
  const byId = new Map(data.map((r) => [r.id as number, r as { form_home: string | null; form_away: string | null }]))
  return rows.map((r) => ({ ...r, ...byId.get(r.id) }))
}
