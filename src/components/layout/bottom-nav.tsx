import { Link } from '@tanstack/react-router'
import { CalendarDays, Layers, LayoutDashboard, TicketCheck, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

/** Barra de navegação inferior no celular (estilo aplicativo). */
export function BottomNav() {
  const { user } = useAuth()
  const items = [
    { to: '/painel', label: 'Painel', icon: LayoutDashboard },
    { to: '/jogos', label: 'Partidas', icon: CalendarDays },
    { to: '/bilhetes-prontos', label: 'Prontos', icon: Layers },
    { to: '/meus-bilhetes', label: 'Meus bilhetes', icon: TicketCheck },
    { to: user ? '/perfil' : '/auth', label: user ? 'Conta' : 'Entrar', icon: UserRound },
  ] as const
  return (
    <>
      <div className="h-[calc(4.25rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.5)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5 px-1">
          {items.map((it) => (
            <li key={it.label}>
              <Link
                to={it.to}
                                className="group flex h-full flex-col items-center justify-center gap-1 text-center text-[10.5px] leading-tight font-semibold text-white/60"
                activeProps={{ className: 'text-white', 'aria-current': 'page' }}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-brand-light text-ink shadow-[0_0_20px_rgb(74_222_128/0.45)]' : 'group-hover:bg-white/10'}`}>
                      <it.icon className="size-5" />
                    </span>
                    {it.label}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
