import * as React from 'react'

export interface BarPoint {
  value: number | null
  /** Texto do tooltip (ex.: "12/11 · x Arsenal (casa) · 3 x 1"). */
  detail: string
}

export interface BarSeries {
  name: string
  color: string // variável CSS, ex.: var(--series-home)
  points: BarPoint[] // do mais antigo para o mais recente
}

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100]
  return steps.find((s) => s >= v) ?? Math.ceil(v / 10) * 10
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/**
 * Barras agrupadas por jogo (uma barra por equipe), do jogo mais antigo à
 * esquerda ao mais recente à direita. Tooltip ao passar o mouse ou tocar.
 */
export function GroupedBars({ series, unit, height = 220, ariaLabel }: { series: BarSeries[]; unit: string; height?: number; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = React.useState<{ s: number; i: number } | null>(null)
  const groups = Math.max(0, ...series.map((s) => s.points.length))
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v != null)
  if (!groups || !values.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem dados suficientes para o gráfico.</p>
  }
  const max = niceMax(Math.max(...values))
  const ticks = [0, max / 2, max]
  const pad = { top: 12, right: 8, bottom: 26, left: 30 }
  const plotW = Math.max(0, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const groupW = groups ? plotW / groups : 0
  const gap = 2
  const barW = Math.max(3, Math.min(22, (groupW * 0.62 - gap * (series.length - 1)) / series.length))
  const y = (v: number) => pad.top + plotH - (v / max) * plotH
  // Alinha pela direita: o jogo mais recente de cada equipe fica na última coluna.
  const pointAt = (s: BarSeries, i: number) => s.points[i - (groups - s.points.length)]
  const active = hover ? pointAt(series[hover.s], hover.i) : null

  return (
    <div ref={ref} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular">
                {fmt(t)}
              </text>
            </g>
          ))}
          {Array.from({ length: groups }, (_, i) => {
            const gx = pad.left + i * groupW + (groupW - (barW * series.length + gap * (series.length - 1))) / 2
            return (
              <g key={i}>
                {series.map((s, si) => {
                  const p = pointAt(s, i)
                  if (!p || p.value == null) return null
                  const x = gx + si * (barW + gap)
                  const h = Math.max(p.value > 0 ? 2 : 0, plotH - (y(p.value) - pad.top))
                  const r = Math.min(4, barW / 2, h)
                  const top = pad.top + plotH - h
                  const dim = hover && !(hover.s === si && hover.i === i)
                  return (
                    <path
                      key={si}
                      d={`M${x},${pad.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + plotH} Z`}
                      fill={s.color}
                      opacity={dim ? 0.45 : 1}
                    />
                  )
                })}
                {/* área de toque maior que a barra */}
                {series.map((s, si) =>
                  pointAt(s, i) ? (
                    <rect
                      key={`hit-${si}`}
                      x={gx + si * (barW + gap) - gap}
                      y={pad.top}
                      width={barW + gap * 2}
                      height={plotH}
                      fill="transparent"
                      onMouseEnter={() => setHover({ s: si, i })}
                      onClick={() => setHover({ s: si, i })}
                    />
                  ) : null,
                )}
                <text x={pad.left + i * groupW + groupW / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular">
                  {i === groups - 1 ? 'último' : groups - i}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {hover && active && active.value != null && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[240px] -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-xs shadow-lift"
          style={{
            left: Math.min(Math.max(pad.left + hover.i * groupW + groupW / 2, 90), width - 90),
            top: Math.max(0, y(active.value) - 64),
          }}
        >
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <span className="size-2.5 rounded-full" style={{ background: series[hover.s].color }} />
            {series[hover.s].name}: {fmt(active.value)} {unit}
          </p>
          <p className="mt-0.5 text-muted-foreground">{active.detail}</p>
        </div>
      )}
    </div>
  )
}

export function ChartLegend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: it.color }} aria-hidden />
          <span className="text-foreground">{it.name}</span>
        </li>
      ))}
    </ul>
  )
}
