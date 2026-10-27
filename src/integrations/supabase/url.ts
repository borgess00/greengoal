/**
 * Normaliza a URL do projeto Supabase: aceita também o endereço copiado da
 * página "Data API" (com /rest/v1/) ou com barra no final.
 */
export function normalizeSupabaseUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  let url = raw.trim().replace(/^["']|["']$/g, '')
  if (!url) return undefined
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return url.replace(/\/+(rest|auth)\/v1\/?.*$/i, '').replace(/\/+$/, '')
  }
}
