import { Link } from '@tanstack/react-router'
import { CalendarDays, Layers, LayoutDashboard, TicketCheck, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

/** Barra inferior no celular, com "Meus bilhetes" em destaque no centro. */
export function BottomNav() {
  const { user } = useAuth()
  const side = [
    { to: '/painel', label: 'Painel', icon: LayoutDashboard },
    { to: '/jogos', label: 'Partidas', icon: CalendarDays },
    null,
    { to: '/bilhetes-prontos', label: 'Prontos', icon: Layers },
    { to: user ? '/perfil' : '/auth', label: user ? 'Conta' : 'Entrar', icon: UserRound },
  ] as const
  return (
    <>
      <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />
      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-5 px-1">
          {side.map((it, i) =>
            it ? (
              <li key={it.label}>
                <Link
                  to={it.to}
                  className="group relative flex h-full flex-col items-center justify-center gap-1 text-center text-[11px] leading-tight font-semibold text-white/55"
                  activeProps={{ className: '!text-brand-light', 'aria-current': 'page' }}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <>
                      <span className={cn('absolute top-0 h-0.5 w-8 rounded-full transition', isActive ? 'bg-brand-light' : 'bg-transparent')} aria-hidden />
                      <it.icon className="size-5" />
                      {it.label}
                    </>
                  )}
                </Link>
              </li>
            ) : (
              <li key={`centro-${i}`} className="relative">
                <Link
                  to="/meus-bilhetes"
                  className="absolute -top-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[10.5px] font-semibold whitespace-nowrap text-white"
                  activeProps={{ 'aria-current': 'page' }}
                >
                  <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-light to-brand text-ink shadow-[0_10px_24px_-8px_rgb(74_222_128/0.7)] ring-4 ring-ink">
                    <TicketCheck className="size-6" />
                  </span>
                  Meus bilhetes
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
    </>
  )
}
