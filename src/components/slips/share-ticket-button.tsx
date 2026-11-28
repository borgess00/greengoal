import * as React from 'react'
import { Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { renderTicketImage, shareOrDownload, type TicketImage } from '@/lib/ticket-image'

/** Gera a imagem do bilhete e abre o compartilhar do celular (ou baixa no computador). */
export function ShareTicketButton({ ticket, filename = 'bilhete-greengoal.png', label = 'Imagem' }: { ticket: TicketImage; filename?: string; label?: string }) {
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      aria-label="Compartilhar bilhete como imagem"
      onClick={async () => {
        setBusy(true)
        try {
          const blob = await renderTicketImage(ticket)
          const r = await shareOrDownload(blob, filename, `${ticket.title} — GreenGoal`)
          if (r === 'downloaded') toast.success('Imagem do bilhete baixada.')
        } catch {
          toast.error('Não foi possível gerar a imagem.')
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Share2 />} {label}
    </Button>
  )
}
