import { cn } from '@/lib/utils'

const COLOR = { V: 'bg-result-win', E: 'bg-result-draw', D: 'bg-result-loss' } as const
const WORD = { V: 'vitória', E: 'empate', D: 'derrota' } as const

/** Forma recente em tracinhos coloridos (mais recente à direita), estilo placar de app. */
export function FormDashes({ form, className }: { form: string | null | undefined; className?: string }) {
  const items = (form ?? '')
    .slice(0, 5)
    .split('')
    .filter((c): c is keyof typeof COLOR => c in COLOR)
    .reverse()
  if (!items.length) return <span className={cn('inline-flex gap-1', className)} aria-hidden />
  return (
    <span className={cn('inline-flex gap-1', className)} role="img" aria-label={`Forma recente: ${[...items].reverse().map((c) => WORD[c]).join(', ')}`}>
      {items.map((c, i) => (
        <span key={i} className={cn('h-1 w-3.5 rounded-full', COLOR[c])} title={WORD[c]} />
      ))}
    </span>
  )
}
