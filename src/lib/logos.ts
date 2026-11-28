// Escudos e logos guardados no Storage do próprio Supabase (bucket "logos").
// A automação copia as imagens da fonte; o site tenta a cópia primeiro e,
// se não existir, usa a original.

const PATTERN = /\/(teams|leagues)\/(\d+)\.(png|svg|webp)(\?.*)?$/i

/** Caminho no bucket para um logo da fonte (ex.: teams/127.png), ou null. */
export function logoPath(url: string | null | undefined): string | null {
  if (!url) return null
  const m = PATTERN.exec(url)
  return m ? `${m[1].toLowerCase()}/${m[2]}.${m[3].toLowerCase()}` : null
}

/** URL pública da cópia guardada (quando o caminho é reconhecido). */
export function cachedLogoUrl(url: string | null | undefined, supabaseUrl: string | undefined): string | null {
  const path = logoPath(url)
  if (!path || !supabaseUrl) return null
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/logos/${path}`
}
