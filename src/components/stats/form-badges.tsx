import { cn } from '@/lib/utils'

const LABEL = { V: 'Vitória', E: 'Empate', D: 'Derrota' } as const
const COLOR = { V: 'bg-result-win', E: 'bg-result-draw', D: 'bg-result-loss' } as const

/** Sequência V/E/D em círculos (mais recente à esquerda). A letra evita depender só da cor. */
export function FormBadges({ form, size = 'md', className }: { form: string | null | undefined; size?: 'sm' | 'md'; className?: string }) {
  const items = (form ?? '').split('').filter((c): c is keyof typeof LABEL => c in LABEL)
  if (!items.length) return null
  return (
    <span className={cn('inline-flex items-center gap-1', className)} role="img" aria-label={`Forma recente, do mais recente: ${items.map((c) => LABEL[c]).join(', ')}`}>
      {items.map((c, i) => (
        <span
          key={i}
          title={LABEL[c]}
          className={cn(
            'grid place-items-center rounded-full font-display font-bold text-white',
            COLOR[c],
            size === 'sm' ? 'size-[18px] text-[10px]' : 'size-7 text-xs',
          )}
        >
          {c}
        </span>
      ))}
    </span>
  )
}
