import type * as React from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed bg-white/60 px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="size-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
