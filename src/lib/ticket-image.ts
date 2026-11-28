// Gera a imagem (PNG 1080x1350) de um bilhete para compartilhar.
// Mostra só o que o bilhete tem; rodapé com aviso de risco e 18+.

const W = 1080
const MAX_H = 1350
const MIN_H = 1080
const ROW = 118
const DARK = '#052E22'
const GREEN = '#22C55E'
const HEAD = "'Outfit Variable', 'Outfit', system-ui, sans-serif"
const BODY = "'Figtree Variable', 'Figtree', system-ui, sans-serif"

export type ImageSelStatus = 'open' | 'won' | 'lost' | 'void' | 'unverifiable'

export interface TicketImage {
  title: string
  badge?: string
  subtitle?: string
  status?: 'open' | 'won' | 'lost' | 'void'
  odd: number | null
  selections: Array<{
    market: string
    game: string
    meta?: string
    odd: number | null
    status?: ImageSelStatus
    score?: string | null
  }>
}

const fmtOdd = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
const STATUS_TXT = {
  open: 'EM ABERTO',
  won: 'GREEN ✓',
  lost: 'RED ✗',
  void: 'ANULADO',
} as const
const STATUS_BG = {
  open: '#334155',
  won: '#16A34A',
  lost: '#DC2626',
  void: '#D97706',
} as const

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

export async function renderTicketImage(t: TicketImage): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all([document.fonts.load(`700 40px ${HEAD}`), document.fonts.load(`500 20px ${BODY}`)]).catch(() => undefined)
  }
  // Altura conforme o número de seleções: de 1080x1080 (quadrado) a 1080x1350 (retrato).
  const shown = Math.min(7, t.selections.length)
  const H = Math.round(Math.max(MIN_H, Math.min(MAX_H, 320 + (t.badge ? 50 : 0) + shown * ROW + (t.selections.length > shown ? 40 : 0) + 300)))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, DARK)
  bg.addColorStop(1, '#0B5A3C')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(W / 2, 250, 170, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(0, 250, W, 3)

  // Cabeçalho
  ctx.fillStyle = GREEN
  ctx.font = `800 30px ${HEAD}`
  ctx.fillText('GREENGOAL', 70, 100)
  ctx.fillStyle = '#A7F3D0'
  ctx.font = `600 20px ${BODY}`
  ctx.fillText('ESTATÍSTICA DE FUTEBOL', 70, 130)
  if (t.status) {
    ctx.font = `800 26px ${HEAD}`
    const label = STATUS_TXT[t.status]
    const w = ctx.measureText(label).width + 48
    ctx.fillStyle = STATUS_BG[t.status]
    roundRect(ctx, W - 70 - w, 66, w, 56, 28)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.fillText(label, W - 70 - w / 2, 104)
    ctx.textAlign = 'left'
  }

  let y = 220
  if (t.badge) {
    ctx.font = `700 22px ${BODY}`
    const w = ctx.measureText(t.badge.toUpperCase()).width + 36
    ctx.fillStyle = 'rgba(34,197,94,0.18)'
    roundRect(ctx, 70, y - 34, w, 46, 23)
    ctx.fill()
    ctx.fillStyle = '#86EFAC'
    ctx.fillText(t.badge.toUpperCase(), 88, y - 3)
    y += 50
  }
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 54px ${HEAD}`
  ctx.fillText(fit(ctx, t.title, W - 140), 70, y + 20)
  if (t.subtitle) {
    ctx.fillStyle = '#D1FAE5'
    ctx.font = `500 24px ${BODY}`
    ctx.fillText(fit(ctx, t.subtitle, W - 140), 70, y + 62)
  }

  // Seleções
  const list = t.selections.slice(0, 7)
  const top = y + 100
  const footerTop = H - 260
  const rowH = Math.min(ROW, (footerTop - top - 20) / Math.max(1, list.length))
  list.forEach((s, i) => {
    const ry = top + i * rowH
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    roundRect(ctx, 60, ry, W - 120, rowH - 14, 22)
    ctx.fill()
    const c = s.status === 'won' ? '#16A34A' : s.status === 'lost' ? '#DC2626' : s.status === 'void' ? '#D97706' : '#94A3B8'
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(108, ry + (rowH - 14) / 2, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 20px ${HEAD}`
    ctx.textAlign = 'center'
    ctx.fillText(s.status === 'won' ? '✓' : s.status === 'lost' ? '✗' : s.status === 'void' ? '–' : String(i + 1), 108, ry + (rowH - 14) / 2 + 7)
    ctx.textAlign = 'left'
    const mid = ry + (rowH - 14) / 2
    ctx.fillStyle = '#064E3B'
    ctx.font = `800 28px ${HEAD}`
    ctx.fillText(fit(ctx, s.market, 690), 145, mid - 6)
    ctx.fillStyle = '#4B5E55'
    ctx.font = `500 20px ${BODY}`
    ctx.fillText(fit(ctx, [s.game, s.score, s.meta].filter(Boolean).join(' · '), 690), 145, mid + 26)
    ctx.fillStyle = '#064E3B'
    ctx.font = `800 34px ${HEAD}`
    ctx.textAlign = 'right'
    ctx.fillText(fmtOdd(s.odd), W - 95, mid + 12)
    ctx.textAlign = 'left'
  })
  if (t.selections.length > list.length) {
    ctx.fillStyle = '#D1FAE5'
    ctx.font = `600 22px ${BODY}`
    ctx.fillText(`+ ${t.selections.length - list.length} seleção(ões)`, 70, top + list.length * rowH + 20)
  }

  // Odd total
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  roundRect(ctx, 60, footerTop, W - 120, 110, 26)
  ctx.fill()
  ctx.fillStyle = '#A7F3D0'
  ctx.font = `700 22px ${BODY}`
  ctx.fillText(`${t.selections.length} SELEÇ${t.selections.length === 1 ? 'ÃO' : 'ÕES'} · ODD TOTAL`, 100, footerTop + 66)
  ctx.fillStyle = GREEN
  ctx.font = `800 64px ${HEAD}`
  ctx.textAlign = 'right'
  ctx.fillText(fmtOdd(t.odd), W - 100, footerTop + 80)

  // Rodapé
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 24px ${HEAD}`
  ctx.fillText(typeof location !== 'undefined' ? location.host : 'GreenGoal', W / 2, H - 92)
  ctx.fillStyle = '#A7F3D0'
  ctx.font = `500 18px ${BODY}`
  ctx.fillText('Conteúdo informativo. Estatística não garante resultado. Apostas envolvem risco. 18+', W / 2, H - 56)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem.'))), 'image/png'))
}

/** Compartilha (celular) ou baixa (computador) a imagem gerada. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
