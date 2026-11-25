import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu, Search, Settings, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from './logo'
import { APP_NAV, SITE_NAV } from './nav-items'
import { ThemeToggle } from './theme-toggle'
import { signOut, useMe } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/** Links do topo na página inicial (no app, a barra lateral faz esse papel). */
const TOP_NAV = [APP_NAV[0], APP_NAV[1], APP_NAV[2], APP_NAV[3], SITE_NAV[0]] as const

/**
 * Cabeçalho: completo na página inicial; dentro do app aparece só no celular
 * (no computador o app usa a barra lateral + barra superior).
 */
export function Header({ app = false }: { app?: boolean }) {
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

  const ghost = 'text-white hover:bg-white/10 hover:text-white'

  return (
    <header className={cn('sticky top-0 z-40 border-b border-white/10 bg-ink text-white', app && 'lg:hidden')}>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo light />

        {!app && (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
            {TOP_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                activeProps={{ className: 'bg-white/10 !text-white' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon" className={ghost} aria-label="Buscar jogos" title="Buscar jogos">
            <Link to="/busca">
              <Search className="size-5" />
            </Link>
          </Button>
          <ThemeToggle className={cn(ghost, 'hidden sm:inline-flex')} />
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <Button asChild variant="ghost" size="sm" className={cn('h-9', ghost)}>
                <Link to="/perfil">Minha conta</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className={cn('h-9', ghost)} disabled={loading}>
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
              <nav className="flex flex-col gap-1 overflow-y-auto" aria-label="Menu móvel">
                {[...APP_NAV, ...SITE_NAV].map((item) => (
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
                <ThemeToggle withLabel className="border border-border text-foreground hover:bg-secondary" />
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
                <p className="pt-2 text-center text-xs text-muted-foreground">18+ · Apostas envolvem risco.</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
