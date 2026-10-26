import type * as React from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({ eyebrow, title, description, children, className }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('hero-pitch relative overflow-hidden text-white', className)}>
      <div className="pitch-lines absolute inset-0 opacity-60" aria-hidden />
      <div className="container-page relative py-10 sm:py-14">
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-[0.18em] text-brand-light uppercase">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-emerald-50/85">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  )
}
