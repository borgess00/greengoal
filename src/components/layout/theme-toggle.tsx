import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** Alterna entre modo escuro e claro (a escolha fica salva neste navegador). */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Ativar modo claro' : 'Ativar modo escuro'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cn('inline-flex items-center justify-center gap-2 rounded-full transition', withLabel ? 'h-10 px-4 text-sm font-semibold' : 'size-10', className)}
    >
      {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      {withLabel && <span>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
    </button>
  )
}
