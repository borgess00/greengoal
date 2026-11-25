import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useMe } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'

/** Barra superior do app no computador: busca, Pro, tema e conta. */
export function TopBar({ className }: { className?: string }) {
  const { user, me, loading } = useMe()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const initials = (me?.fullName || me?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className={cn('sticky top-0 z-30 h-16 items-center gap-4 border-b border-white/10 bg-ink/95 px-6 text-white backdrop-blur', className)}>
      <form
        role="search"
        className="relative w-full max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ to: '/busca', search: { q: q.trim() || undefined } })
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/50" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar times e campeonatos"
          aria-label="Buscar times e campeonatos"
          className="h-10 w-full rounded-full border border-white/10 bg-white/[0.06] pr-4 pl-10 text-sm text-white outline-none placeholder:text-white/45 focus:border-brand-light/60"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        {!loading && !me?.hasActiveSubscription && (
          <Link to="/planos" className="rounded-full border border-brand-light/40 bg-brand-light/10 px-4 py-2 text-sm font-semibold text-brand-light transition hover:bg-brand-light hover:text-ink">
            Obter Pro
          </Link>
        )}
        <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
        {user ? (
          <Link to="/perfil" className="grid size-10 place-items-center rounded-full bg-white/10 font-display text-sm font-bold text-white transition hover:bg-white/20" aria-label="Minha conta" title="Minha conta">
            {initials || '?'}
          </Link>
        ) : (
          <Link to="/auth" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white/90">
            Entrar
          </Link>
        )}
      </div>
    </div>
  )
}
