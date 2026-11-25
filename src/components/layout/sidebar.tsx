import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogIn, LogOut, Shield, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { signOut, useMe } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { APP_NAV, SITE_NAV } from './nav-items'

const itemClass =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white [&>svg]:size-[18px] [&>svg]:shrink-0'
const activeClass = '!bg-brand-light !text-ink shadow-[0_0_24px_rgb(74_222_128/0.25)]'

/** Barra lateral do app no computador (inspirada em apps esportivos). */
export function Sidebar({ className }: { className?: string }) {
  const { user, me } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut(queryClient)
    toast.success('Você saiu da sua conta.')
    navigate({ to: '/' })
  }

  return (
    <aside className={cn('z-40 flex-col border-r border-white/10 bg-ink text-white', className)} aria-label="Menu do app">
      <div className="flex h-16 items-center px-5">
        <Logo light />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-white/10 px-3 py-4" aria-label="Principal">
        {APP_NAV.map((item) => (
          <Link key={item.to} to={item.to} className={itemClass} activeProps={{ className: activeClass, 'aria-current': 'page' }}>
            <item.icon /> {item.label}
          </Link>
        ))}
        <div className="my-3 border-t border-white/10" />
        {SITE_NAV.map((item) => (
          <Link key={item.to} to={item.to} className={itemClass} activeProps={{ className: activeClass, 'aria-current': 'page' }}>
            <item.icon /> {item.label}
          </Link>
        ))}
        {me?.isAdmin && (
          <Link to="/admin" className={itemClass} activeProps={{ className: activeClass, 'aria-current': 'page' }}>
            <Shield /> Admin
          </Link>
        )}
      </nav>
      <div className="flex flex-col gap-1 border-t border-white/10 px-3 py-4">
        {user ? (
          <>
            <Link to="/perfil" className={itemClass} activeProps={{ className: activeClass }}>
              <UserRound /> Minha conta
            </Link>
            <button type="button" onClick={handleSignOut} className={cn(itemClass, 'text-left')}>
              <LogOut /> Sair
            </button>
          </>
        ) : (
          <Link to="/auth" className={itemClass}>
            <LogIn /> Entrar
          </Link>
        )}
        <p className="mt-2 px-3 text-[11px] text-white/35">18+ · Apostas envolvem risco.</p>
      </div>
    </aside>
  )
}
