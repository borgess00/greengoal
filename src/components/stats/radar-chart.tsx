import * as React from 'react'
import { RADAR_AXES, RADAR_SCALES, type RadarAxis } from '@/lib/match-stats'

export interface RadarSeries {
  name: string
  color: string
  values: Record<RadarAxis, number | null>
}

/**
 * Radar comparativo de 5 eixos (0–100, escalas fixas em RADAR_SCALES).
 * Eixo sem dado é desenhado no centro e marcado como "sem dado".
 */
export function RadarChart({ series, size = 300 }: { series: RadarSeries[]; size?: number }) {
  const [hover, setHover] = React.useState<RadarAxis | null>(null)
  const c = size / 2
  const r = size / 2 - 52
  const n = RADAR_AXES.length
  const point = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const
  }
  const ring = (v: number) => RADAR_AXES.map((_, i) => point(i, v).join(',')).join(' ')
  const missing = RADAR_AXES.filter((ax) => series.every((s) => s.values[ax] == null))

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px]" role="img" aria-label={`Radar comparativo: ${series.map((s) => `${s.name} — ${RADAR_AXES.map((a) => `${a} ${s.values[a] ?? 'sem dado'}`).join(', ')}`).join('; ')}`}>
        {[25, 50, 75, 100].map((v) => (
          <polygon key={v} points={ring(v)} fill={v === 100 ? 'var(--secondary)' : 'none'} fillOpacity={v === 100 ? 0.5 : 1} stroke="var(--border)" />
        ))}
        {RADAR_AXES.map((ax, i) => {
          const [x, y] = point(i, 100)
          const [lx, ly] = point(i, 128)
          return (
            <g key={ax} onMouseEnter={() => setHover(ax)} onMouseLeave={() => setHover(null)} onClick={() => setHover(ax)} className="cursor-default">
              <line x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" />
              <text x={lx} y={ly} textAnchor="middle" dy="0.32em" className={`text-[12px] font-semibold ${hover === ax ? 'fill-brand-dark' : 'fill-muted-foreground'}`}>
                {ax}
              </text>
              <circle cx={lx} cy={ly} r={24} fill="transparent" />
            </g>
          )
        })}
        {series.map((s) => {
          const pts = RADAR_AXES.map((ax, i) => point(i, s.values[ax] ?? 0))
          return (
            <g key={s.name}>
              <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={s.color} fillOpacity={0.22} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {pts.map(([x, y], i) =>
                s.values[RADAR_AXES[i]] == null ? null : <circle key={i} cx={x} cy={y} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />,
              )}
            </g>
          )
        })}
      </svg>
      <div className="min-h-[2.5rem] w-full text-center text-xs text-muted-foreground" aria-live="polite">
        {hover ? (
          <>
            <p className="font-semibold text-foreground">
              {hover}:{' '}
              {series.map((s, i) => (
                <span key={s.name}>
                  {i > 0 && ' · '}
                  {s.name} {s.values[hover] ?? 'sem dado'}
                </span>
              ))}
            </p>
            <p>Escala: {RADAR_SCALES[hover]}.</p>
          </>
        ) : (
          <p>Passe o mouse ou toque num eixo para ver os valores e a escala.</p>
        )}
        {missing.length > 0 && <p className="mt-1">Sem dado em: {missing.join(', ')} (a fonte não trouxe estatística detalhada desses jogos).</p>}
      </div>
    </div>
  )
}
