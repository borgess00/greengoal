import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import * as React from 'react'
import { Compass, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <p className="font-display text-7xl font-bold text-primary/25">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-brand-dark">Página não encontrada</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">O endereço que você acessou não existe ou foi movido.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/">Ir para o início</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/jogos">
              <Compass /> Ver jogos do dia
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DefaultError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryReset = useQueryErrorResetBoundary()
  React.useEffect(() => {
    queryReset.reset()
  }, [queryReset])
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center" role="alert">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-dark">Algo deu errado</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">Não foi possível carregar esta página. Verifique sua conexão e tente novamente.</p>
        {import.meta.env.DEV && error instanceof Error && <pre className="mx-auto mt-4 max-w-lg overflow-auto rounded-lg bg-muted p-3 text-left text-xs">{error.message}</pre>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              reset()
              router.invalidate()
            }}
          >
            <RefreshCw /> Tentar novamente
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Ir para o início</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
