import { Link } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Bloqueio para quem não tem acesso. O fundo desfocado é decorativo (barras
 * genéricas): a análise real nunca é enviada ao navegador sem permissão.
 */
export function AnalysisLock({ needsLogin, redirect }: { needsLogin: boolean; redirect: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="pointer-events-none space-y-4 p-6 blur-[6px] select-none" aria-hidden>
        {[90, 75, 82, 60, 88, 70].map((w, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 rounded bg-brand-dark/15" style={{ width: `${w / 3}%` }} />
            <div className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />
            <div className="h-3 rounded bg-muted" style={{ width: `${w - 12}%` }} />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-white/40 via-white/85 to-white p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-brand-dark text-white shadow-lift">
            <Lock className="size-6" />
          </div>
          <h3 className="font-display text-xl font-bold text-brand-dark">Análise exclusiva para assinantes</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Importância do jogo, confrontos, forma, probabilidades, gols, escanteios, cartões, árbitro e finalizadores — tudo em um só lugar.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button asChild size="lg">
              <Link to="/planos">Assine para liberar</Link>
            </Button>
            {needsLogin && (
              <Button asChild variant="ghost">
                <Link to="/auth" search={{ redirect }}>
                  Já sou assinante — entrar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
