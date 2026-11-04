import { Dices, ExternalLink } from 'lucide-react'
import { SITE } from '@/lib/site'

// Faixa de divulgação do site parceiro, no topo do rodapé de todas as páginas.
export function PartnerBanner() {
  const p = SITE.partner
  if (!p.url) return null
  return (
    <div className="border-b border-white/10">
      <div className="container-page flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            <Dices className="size-6" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-white">{p.title}</p>
            <p className="text-sm text-emerald-100/85">
              {p.text} <span className="text-emerald-100/60">Site parceiro · somente 18+.</span>
            </p>
          </div>
        </div>
        <a
          href={p.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-emerald-50"
        >
          {p.cta} <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  )
}
