import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} aria-label="GreenGoal — página inicial">
      <img src="/logo-sm.png" alt="" width={52} height={40} className="h-9 w-auto drop-shadow-sm transition-transform group-hover:-rotate-3" />
      <span className={cn('font-display text-xl font-bold tracking-tight', light ? 'text-white' : 'text-brand-dark')}>
        Green<span className={light ? 'text-brand-light' : 'text-primary'}>Goal</span>
      </span>
    </Link>
  )
}
