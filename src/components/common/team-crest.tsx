import * as React from 'react'
import { cn } from '@/lib/utils'
import { cachedLogoUrl, useImageFallback } from '@/lib/logos'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

/** Escudo vindo da API; sem imagem, mostra as iniciais em um círculo neutro. */
export function TeamCrest({ name, logo, size = 32, className }: { name: string; logo?: string | null; size?: number; className?: string }) {
  // 0 = cópia guardada no site, 1 = original da fonte, 2 = iniciais.
  const [step, setStep] = React.useState(0)
  const chain = [cachedLogoUrl(logo, SUPABASE_URL), logo].filter(Boolean) as string[]
  const src = chain[step]
  const ref = useImageFallback(step, () => setStep((x) => x + 1))
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  if (src) {
    return (
      <img
        ref={ref}
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setStep((x) => x + 1)}
        className={cn('shrink-0 object-contain', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-muted font-display text-[0.65em] font-bold text-muted-foreground', className)} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials || '?'}
    </span>
  )
}
