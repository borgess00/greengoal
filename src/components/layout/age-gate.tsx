// Confirmação de idade AUTODECLARADA (não é verificação documental).
// A resposta fica salva no navegador. Quem responde "Não" permanece bloqueado.
import * as React from 'react'
import { Ban, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SITE } from '@/lib/site'

export const AGE_KEY = 'greengoal:age-confirmed'
type Answer = 'yes' | 'no' | null

function read(): Answer {
  try {
    const v = window.localStorage.getItem(AGE_KEY)
    return v === 'yes' || v === 'no' ? v : null
  } catch {
    return null
  }
}

export function AgeGate() {
  const [answer, setAnswer] = React.useState<Answer | 'loading'>('loading')

  React.useEffect(() => setAnswer(read()), [])

  React.useEffect(() => {
    if (answer === null || answer === 'no') {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [answer])

  function choose(v: 'yes' | 'no') {
    try {
      window.localStorage.setItem(AGE_KEY, v)
    } catch {
      /* navegador sem armazenamento: vale só nesta visita */
    }
    setAnswer(v)
  }

  if (answer === 'loading' || answer === 'yes') return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#03261c]/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-lift">
        <img src="/logo-sm.png" alt="" width={104} height={80} className="mx-auto mb-3 h-16 w-auto" />
        {answer === null ? (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border-4 border-brand-dark font-display text-lg font-bold text-brand-dark">18+</div>
            <h2 id="age-title" className="font-display text-2xl font-bold text-brand-dark">
              Você tem 18 anos ou mais?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O GreenGoal é exclusivo para maiores de 18 anos. Apostas envolvem risco e não há garantia de resultado.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" onClick={() => choose('no')}>
                Não
              </Button>
              <Button size="lg" onClick={() => choose('yes')} autoFocus>
                <ShieldCheck /> Sim, tenho
              </Button>
            </div>
            <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
              Confirmação autodeclarada, salva neste navegador. Ao continuar, você concorda com os termos de uso.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
              <Ban className="size-7" />
            </div>
            <h2 id="age-title" className="font-display text-2xl font-bold text-brand-dark">
              Acesso não permitido
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O conteúdo do GreenGoal é destinado somente a maiores de 18 anos. Se você ou alguém próximo precisa de apoio:
            </p>
            <ul className="mt-4 space-y-2 text-left text-sm">
              {SITE.helpLines.map((h) => (
                <li key={h.name} className="rounded-lg bg-muted px-3 py-2">
                  <a href={h.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-dark hover:underline">
                    {h.name}
                  </a>
                  <span className="block text-xs text-muted-foreground">{h.detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
