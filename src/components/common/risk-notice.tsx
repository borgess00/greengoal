import { TriangleAlert } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function RiskNotice({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900', className)} role="note">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <p className="leading-snug">
        <strong>18+.</strong> Estatísticas descrevem o passado e não garantem resultados. Apostas envolvem risco de perda.
        {!compact && (
          <>
            {' '}
            <Link to="/jogo-responsavel" className="font-semibold underline underline-offset-2">
              Jogue com responsabilidade
            </Link>
            .
          </>
        )}
      </p>
    </div>
  )
}
