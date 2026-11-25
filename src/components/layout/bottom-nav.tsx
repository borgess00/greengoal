import { Link } from '@tanstack/react-router'
import { CalendarDays, House, Layers, Star, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

/** Barra de navegação inferior no celular (estilo aplicativo). */
export function BottomNav() {
  const { user } = useAuth()
  const items = [
    { to: '/', label: 'Início', icon: House, exact: true },
    { to: '/jogos', label: 'Jogos', icon: CalendarDays },
    { to: '/favoritos', label: 'Favoritos', icon: Star },
    { to: '/bilhetes-prontos', label: 'Bilhetes', icon: Layers },
    { to: user ? '/perfil' : '/auth', label: user ? 'Conta' : 'Entrar', icon: UserRound },
  ] as const
  return (
    <>
      <div className="h-[calc(4.25rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />
      <nav
        aria-label="Navegação rápida"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(6_78_59/0.35)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5 px-1">
          {items.map((it) => (
            <li key={it.label}>
              <Link
                to={it.to}
                activeOptions={{ exact: 'exact' in it && it.exact }}
                className="group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground"
                activeProps={{ className: 'text-brand-dark', 'aria-current': 'page' }}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-primary text-white shadow-soft' : 'group-hover:bg-secondary'}`}>
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
