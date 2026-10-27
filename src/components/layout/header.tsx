import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Crown, Layers, LogOut, Menu, Settings, Shield, Ticket, UserRound, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from './logo'
import { signOut, useMe } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const NAV = [
  { to: '/jogos', label: 'Jogos do dia', icon: CalendarDays },
  { to: '/bilhetes-prontos', label: 'Bilhetes prontos', icon: Layers },
  { to: '/bilhete', label: 'Conferir bilhete', icon: Ticket },
  { to: '/planos', label: 'Planos', icon: Crown },
  { to: '/sobre', label: 'Sobre', icon: Info },
] as const

export function Header() {
  const { user, me, loading } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  const showSubscribe = !loading && !me?.hasActiveSubscription
  const isAdmin = !!me?.isAdmin

  async function handleSignOut() {
    await signOut(queryClient)
    setOpen(false)
    toast.success('Você saiu da sua conta.')
    navigate({ to: '/' })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-brand-dark"
              activeProps={{ className: 'bg-secondary !text-brand-dark' }}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-brand-dark" activeProps={{ className: 'bg-secondary !text-brand-dark' }}>
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link to="/perfil">
                  <UserRound /> Minha conta
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-9" disabled={loading}>
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
            {showSubscribe && (
              <Button asChild size="sm" className="h-9">
                <Link to="/planos">Assinar</Link>
              </Button>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Navegação do site</SheetDescription>
              <div className="pt-1 pb-2">
                <Logo />
              </div>
              <nav className="flex flex-col gap-1" aria-label="Menu móvel">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-foreground transition hover:bg-secondary"
                      activeProps={{ className: 'bg-secondary text-brand-dark' }}
                    >
                      <item.icon className="size-5 text-primary" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                {isAdmin && (
                  <SheetClose asChild>
                    <Link to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold transition hover:bg-secondary">
                      <Shield className="size-5 text-primary" /> Admin
                    </Link>
                  </SheetClose>
                )}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t pt-4">
                {user ? (
                  <>
                    <SheetClose asChild>
                      <Button asChild variant="outline">
                        <Link to="/perfil">
                          <Settings /> Minha conta
                        </Link>
                      </Button>
                    </SheetClose>
                    <Button variant="ghost" onClick={handleSignOut}>
                      <LogOut /> Sair
                    </Button>
                  </>
                ) : (
                  <SheetClose asChild>
                    <Button asChild variant="outline">
                      <Link to="/auth">Entrar</Link>
                    </Button>
                  </SheetClose>
                )}
                {showSubscribe && (
                  <SheetClose asChild>
                    <Button asChild>
                      <Link to="/planos">Assinar</Link>
                    </Button>
                  </SheetClose>
                )}
                <p className={cn('pt-2 text-center text-xs text-muted-foreground')}>18+ · Apostas envolvem risco.</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
