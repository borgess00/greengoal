import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const OUT = process.argv[2]
const b = await chromium.launch()
for (const [n, vp] of [['desk', { width: 1366, height: 900 }], ['mob', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  await ctx.addInitScript(() => localStorage.setItem('greengoal:age-confirmed', 'yes'))
  const p = await ctx.newPage()
  await p.goto('http://localhost:3000/'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/home-${n}.png`, fullPage: true })
  console.log(n, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth))
  await p.goto('http://localhost:3000/planos'); await p.waitForLoadState('networkidle')
  await p.screenshot({ path: `${OUT}/planos-${n}.png`, fullPage: true })
}
await b.close()
