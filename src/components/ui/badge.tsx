import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-foreground bg-card',
      success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
      danger: 'border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
      warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
      muted: 'border-transparent bg-muted text-muted-foreground',
      dark: 'border-transparent bg-brand-deep text-white',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
