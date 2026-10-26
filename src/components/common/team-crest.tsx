import * as React from 'react'
import { cn } from '@/lib/utils'

/** Escudo vindo da API; sem imagem, mostra as iniciais em um círculo neutro. */
export function TeamCrest({ name, logo, size = 32, className }: { name: string; logo?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = React.useState(false)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
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
