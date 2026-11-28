// Copia escudos e logos da fonte para o Storage do Supabase (bucket "logos").
// As imagens da fonte não contam na cota da API-Football.
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { logoPath } from '@/lib/logos'

async function existing(folder: string) {
  const out = new Set<string>()
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await supabaseAdmin().storage.from('logos').list(folder, { limit: 1000, offset })
    if (error) throw new Error(error.message)
    for (const f of data ?? []) out.add(`${folder}/${f.name}`)
    if (!data || data.length < 1000) break
  }
  return out
}

/** Guarda os logos que ainda faltam das partidas das datas informadas. */
export async function cacheLogos(dates: string[], max = 150) {
  const { data: rows } = await supabaseAdmin().from('fixtures').select('home_team_logo, away_team_logo, league_logo').in('grade_date', dates)
  const urls = new Map<string, string>()
  for (const r of rows ?? []) {
    for (const u of [r.home_team_logo, r.away_team_logo, r.league_logo] as Array<string | null>) {
      const p = logoPath(u)
      if (p && u) urls.set(p, u)
    }
  }
  if (!urls.size) return { saved: 0, skipped: 0 }
  const have = new Set([...(await existing('teams')), ...(await existing('leagues'))])
  let saved = 0
  let failed = 0
  for (const [path, url] of urls) {
    if (have.has(path)) continue
    if (saved >= max) break
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const type = res.headers.get('content-type') ?? 'image/png'
      if (!type.startsWith('image/')) throw new Error('não é imagem')
      const body = new Uint8Array(await res.arrayBuffer())
      if (body.byteLength > 500_000) throw new Error('imagem grande demais')
      const { error } = await supabaseAdmin().storage.from('logos').upload(path, body, { contentType: type, upsert: true, cacheControl: '2592000' })
      if (error) throw new Error(error.message)
      saved++
    } catch {
      failed++
    }
  }
  return { saved, failed, total: urls.size }
}
