import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Crown, Layers, LogOut, Menu, Search, Settings, Shield, Star, Ticket, UserRound, Info } from 'lucide-react'
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
  { to: '/favoritos', label: 'Favoritos', icon: Star },
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo light />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              activeProps={{ className: 'bg-white/10 !text-white' }}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="rounded-full px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white" activeProps={{ className: 'bg-white/10 !text-white' }}>
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label="Buscar jogos" title="Buscar jogos">
            <Link to="/busca">
              <Search className="size-5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden text-white hover:bg-white/10 hover:text-white lg:inline-flex" aria-label="Favoritos" title="Favoritos">
            <Link to="/favoritos">
              <Star className="size-5" />
            </Link>
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <Button asChild variant="ghost" size="sm" className="h-9 text-white hover:bg-white/10 hover:text-white">
                <Link to="/perfil">
                  <UserRound /> Minha conta
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="h-9 text-white hover:bg-white/10 hover:text-white" disabled={loading}>
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
            {showSubscribe && (
              <Button asChild size="sm" className="h-9 bg-brand-light text-ink hover:bg-brand-light/90">
                <Link to="/planos">Assinar</Link>
              </Button>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white lg:hidden" aria-label="Abrir menu">
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
