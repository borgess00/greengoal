// Gera o relatório vertical (PNG) do Radar de Escanteios no navegador.
// Identidade verde e branca; apenas dados reais das linhas recebidas.
import type { CornerTeamRow } from './corners'
import { MIN_CORNER_SAMPLE } from './corners'
import { formatGradeDate } from './grade'

const W = 1080
const GREEN = '#16A34A'
const DARK = '#064E3B'
const HEAD = "'Outfit Variable', 'Outfit', system-ui, sans-serif"
const BODY = "'Figtree Variable', 'Figtree', system-ui, sans-serif"

const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }))

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

export async function renderCornerReport(rows: CornerTeamRow[], date: string, limit = 12): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all([document.fonts.load(`700 40px ${HEAD}`), document.fonts.load(`500 20px ${BODY}`)]).catch(() => undefined)
  }
  const list = rows.filter((r) => r.sample >= MIN_CORNER_SAMPLE).slice(0, limit)
  const headerH = 300
  const rowH = 132
  const footerH = 210
  const H = headerH + Math.max(1, list.length) * rowH + 40 + footerH
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Fundo
  ctx.fillStyle = '#F5F9F6'
  ctx.fillRect(0, 0, W, H)

  // Cabeçalho
  const g = ctx.createLinearGradient(0, 0, W, headerH)
  g.addColorStop(0, DARK)
  g.addColorStop(1, '#0A6B3F')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, headerH)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let x = 0; x < W; x += 48) ctx.fillRect(x, 0, 1, headerH)
  ctx.fillStyle = '#4ADE80'
  ctx.font = `700 22px ${BODY}`
  ctx.fillText('GREENGOAL · ESTATÍSTICA DE FUTEBOL', 60, 70)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 64px ${HEAD}`
  ctx.fillText('RADAR DE ESCANTEIOS', 60, 145)
  ctx.font = `600 30px ${HEAD}`
  ctx.fillStyle = '#D1FAE5'
  ctx.fillText(`ANÁLISE DOS JOGOS DO DIA · ${formatGradeDate(date).toUpperCase()}`, 60, 195)
  ctx.font = `500 20px ${BODY}`
  ctx.fillStyle = '#BBF7D0'
  ctx.fillText('Horários de Brasília · médias gerais por partida · a fonte não informa o minuto dos escanteios', 60, 245)

  // Linhas
  let y = headerH + 30
  if (!list.length) {
    ctx.fillStyle = DARK
    ctx.font = `600 30px ${HEAD}`
    ctx.fillText('Sem amostra suficiente para esta grade.', 60, y + 60)
    y += rowH
  }
  list.forEach((r, i) => {
    ctx.save()
    ctx.shadowColor = 'rgba(6,78,59,0.12)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 6
    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, 40, y, W - 80, rowH - 18, 22)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = GREEN
    roundRect(ctx, 40, y, 12, rowH - 18, 6)
    ctx.fill()

    ctx.fillStyle = DARK
    ctx.font = `800 40px ${HEAD}`
    ctx.fillText(String(i + 1), 76, y + 68)
    ctx.font = `700 22px ${HEAD}`
    ctx.fillStyle = GREEN
    ctx.fillText(r.local_time, 130, y + 42)
    ctx.fillStyle = '#52665C'
    ctx.font = `500 20px ${BODY}`
    ctx.fillText(fit(ctx, r.league_name, 420), 210, y + 42)
    ctx.fillStyle = '#0B1F17'
    ctx.font = `700 30px ${HEAD}`
    ctx.fillText(fit(ctx, `${r.team} (${r.venue})`, 560), 130, y + 82)
    ctx.fillStyle = '#52665C'
    ctx.font = `500 19px ${BODY}`
    ctx.fillText(fit(ctx, `x ${r.opponent} · amostra ${r.sample} jogos · 5+ em ${r.atLeast5}/${r.sample}`, 560), 130, y + 106)

    const stats: Array<[string, string]> = [
      ['A FAVOR', fmt(r.forAvg)],
      ['ADV. CEDE', fmt(r.opponentConcededAvg)],
      ['COMBINADA', fmt(r.combinedAvg)],
    ]
    stats.forEach(([label, value], k) => {
      const x = 720 + k * 108
      ctx.fillStyle = k === 2 ? DARK : '#E8F5EC'
      roundRect(ctx, x, y + 22, 96, 72, 14)
      ctx.fill()
      ctx.fillStyle = k === 2 ? '#FFFFFF' : DARK
      ctx.font = `800 30px ${HEAD}`
      ctx.textAlign = 'center'
      ctx.fillText(value, x + 48, y + 64)
      ctx.font = `700 12px ${BODY}`
      ctx.fillText(label, x + 48, y + 85)
      ctx.textAlign = 'left'
    })
    y += rowH
  })

  // Rodapé
  y += 10
  ctx.fillStyle = DARK
  ctx.fillRect(0, y, W, H - y)
  ctx.fillStyle = '#4ADE80'
  ctx.font = `800 30px ${HEAD}`
  ctx.textAlign = 'center'
  ctx.fillText('FOCO + ESTATÍSTICA + CONTEXTO = MELHORES DECISÕES', W / 2, y + 70)
  ctx.fillStyle = '#D1FAE5'
  ctx.font = `500 19px ${BODY}`
  ctx.fillText('“Combinada” = média simples entre escanteios a favor do time e cedidos pelo adversário. Não é probabilidade.', W / 2, y + 115)
  ctx.fillText('Estatísticas representam o histórico e não garantem resultados futuros. 18+ · Apostas envolvem risco.', W / 2, y + 145)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem.'))), 'image/png'))
}
