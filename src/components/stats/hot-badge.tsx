import { Flame } from 'lucide-react'
import { HOT_FLOOR, HOT_MIN_MARKETS, isHot } from '@/lib/match-stats'
import { cn } from '@/lib/utils'

const TIP = `Jogo quente: ${HOT_MIN_MARKETS}+ mercados se repetiram em ${HOT_FLOOR}% ou mais dos jogos em todos os ângulos (frequência passada, não é previsão).`

/** Selo "jogo quente". `compact` mostra só o ícone. */
export function HotBadge({ count, compact = false, tone = 'default', className }: { count: number | null | undefined; compact?: boolean; tone?: 'default' | 'onDark'; className?: string }) {
  if (!isHot(count)) return null
  if (compact) {
    return (
      <span className={cn('inline-grid size-5 place-items-center rounded-full bg-orange-500/15 text-orange-500', className)} title={TIP} aria-label="Jogo quente">
        <Flame className="size-3.5" />
      </span>
    )
  }
  return (
    <span
      title={TIP}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
        tone === 'onDark' ? 'bg-orange-400/20 text-orange-200' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
        className,
      )}
    >
      <Flame className="size-3.5" /> Jogo quente
    </span>
  )
}
