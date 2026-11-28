import * as React from 'react'
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

/**
 * Erros de imagem que acontecem antes da hidratação do React não disparam
 * onError. Depois de montar, confere se a imagem já falhou e avança.
 */
export function useImageFallback(step: number, next: () => void) {
  const ref = React.useRef<HTMLImageElement>(null)
  React.useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) next()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  return ref
}
