import * as React from 'react'

/**
 * Número que "sobe" até o valor final ao aparecer. Aceita textos como
 * "50%", "+1,5u" ou "12"; o que não for número aparece direto.
 */
export function AnimatedNumber({ value, duration = 700 }: { value: React.ReactNode; duration?: number }) {
  const text = String(value)
  const m = /^([+-]?)(\d+(?:[.,]\d+)?)(.*)$/.exec(text)
  const target = m ? Number(m[2].replace(',', '.')) : null
  const decimals = m && /[.,]/.test(m[2]) ? m[2].split(/[.,]/)[1].length : 0
  const [shown, setShown] = React.useState(target ?? 0)
  React.useEffect(() => {
    if (target == null) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setShown(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  if (!m || target == null) return <>{value}</>
  return (
    <>
      {m[1]}
      {shown.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {m[3]}
    </>
  )
}
