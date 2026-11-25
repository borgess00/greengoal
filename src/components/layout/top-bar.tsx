import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Crown, Search, Shield } from 'lucide-react'
import { useMe } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { APP_NAV, SITE_NAV } from './nav-items'
import { ThemeToggle } from './theme-toggle'

/**
 * Cabeçalho do app no computador, em duas linhas: marca, busca e conta em
 * cima; abas de navegação embaixo (com sublinhado na aba ativa).
 */
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
    <header className={cn('sticky top-0 z-40 border-b border-white/10 bg-ink text-white', className)}>
      <div className="container-page flex h-16 items-center gap-6">
        <Logo light />
        <form
          role="search"
          className="relative mx-auto w-full max-w-lg"
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
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] pr-4 pl-10 text-sm text-white outline-none placeholder:text-white/45 focus:border-brand-light/60"
          />
        </form>
        <div className="flex items-center gap-2">
          {!loading && !me?.hasActiveSubscription && (
            <Link to="/planos" className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-bold text-ink transition hover:brightness-110">
              <Crown className="size-4" /> Seja Pro
            </Link>
          )}
          <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
          {user ? (
            <Link to="/perfil" className="flex items-center gap-2 rounded-xl border border-white/10 py-1 pr-3 pl-1 text-sm font-semibold transition hover:bg-white/10" title="Minha conta">
              <span className="grid size-8 place-items-center rounded-lg bg-brand-deep font-display text-xs font-bold">{initials || '?'}</span>
              Minha conta
            </Link>
          ) : (
            <Link to="/auth" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white/90">
              Entrar
            </Link>
          )}
        </div>
      </div>
      <nav aria-label="Principal" className="border-t border-white/[0.06] bg-ink-2">
        <div className="container-page flex h-12 items-stretch gap-1 overflow-x-auto">
          {APP_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="relative flex shrink-0 items-center gap-2 px-3 text-sm font-semibold text-white/60 transition hover:text-white"
              activeProps={{ className: '!text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-light', 'aria-current': 'page' }}
            >
              <item.icon className="size-4" /> {item.label}
            </Link>
          ))}
          <span className="ml-auto" />
          {SITE_NAV.map((item) => (
            <Link key={item.to} to={item.to} className="flex shrink-0 items-center px-3 text-sm font-medium text-white/50 hover:text-white" activeProps={{ className: '!text-white' }}>
              {item.label}
            </Link>
          ))}
          {me?.isAdmin && (
            <Link to="/admin" className="flex shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-white/50 hover:text-white" activeProps={{ className: '!text-white' }}>
              <Shield className="size-4" /> Admin
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
