import { Activity, BarChart3, ClipboardList, Crosshair, Flag, Goal, Info, ShieldAlert, Square, Swords, Trophy, TriangleAlert, UserRound, UsersRound } from 'lucide-react'
import type * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RISK_LABELS, SECTIONS, type AnalysisContent, type Highlight, type SectionKey } from '@/lib/analysis'
import type { Shooter } from '@/lib/facts'
import { formatDateTime, formatNumber } from '@/lib/format'
import { formatShortDate } from '@/lib/grade'
import { cn } from '@/lib/utils'

const SECTION_ICONS: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
  importancia: Trophy,
  confrontos: Swords,
  forma: Activity,
  probabilidade: BarChart3,
  gols: Goal,
  escanteios: Flag,
  cartoes: Square,
  arbitro: UserRound,
  finalizacoes: Crosshair,
}

const CONFIDENCE: Record<AnalysisContent['confianca_dados'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  alta: { label: 'Dados: boa cobertura', variant: 'success' },
  media: { label: 'Dados: cobertura parcial', variant: 'warning' },
  baixa: { label: 'Dados: cobertura limitada', variant: 'danger' },
}

export function AnalysisView({ content, home, away }: { content: AnalysisContent; home: string; away: string }) {
  const d = content.display
  const conf = CONFIDENCE[content.confianca_dados] ?? CONFIDENCE.media
  return (
    <div className="space-y-6">
      {content.resumo && (
        <Card className="border-primary/30 bg-gradient-to-br from-white to-secondary/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-brand-dark">
                <ClipboardList className="size-5 text-primary" /> Resumo
              </CardTitle>
              <Badge variant={conf.variant}>{conf.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{content.resumo}</p>
          </CardContent>
        </Card>
      )}

      {(d.percent || d.odds.length > 0) && <Probabilities content={content} home={home} away={away} />}

      {content.destaques.length > 0 && (
        <section aria-labelledby="destaques">
          <h2 id="destaques" className="mb-1 font-display text-xl font-bold text-brand-dark">
            Mercados em destaque
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Leituras com maior sustentação nos dados disponíveis. Probabilidades estimadas não são certezas.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {content.destaques.map((h, i) => (
              <HighlightCard key={i} h={h} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="secoes" className="space-y-4">
        <h2 id="secoes" className="font-display text-xl font-bold text-brand-dark">
          Análise por tema
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.filter((s) => content.secoes[s.key]).map((s, i) => {
            const Icon = SECTION_ICONS[s.key]
            return (
              <Card key={s.key} className={cn(i === 0 && 'md:col-span-2')}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary">
                      <Icon className="size-4" />
                    </span>
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground/90">{content.secoes[s.key]}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {content.meta.removed_sections.length > 0 && (
          <p className="text-xs text-muted-foreground">Seções sem dados de apoio suficientes foram omitidas.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {d.h2h.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Swords className="size-4 text-primary" /> Últimos confrontos diretos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {d.h2h.map((m, i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 py-2.5">
                    <span className="w-12 text-xs text-muted-foreground tabular">{formatShortDate(m.date)}</span>
                    <span className="truncate text-right font-medium">{m.home}</span>
                    <span className="rounded-md bg-brand-dark px-2 py-0.5 font-display text-xs font-bold text-white tabular">{m.score}</span>
                    <span className="truncate font-medium">{m.away}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {d.corners && (d.corners.home || d.corners.away) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="size-4 text-primary" /> Escanteios (médias por partida)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {(['home', 'away'] as const).map((side) => {
                  const c = d.corners?.[side]
                  return (
                    <div key={side} className="rounded-xl bg-muted/60 p-3 text-sm">
                      <p className="mb-2 truncate font-semibold">{side === 'home' ? home : away}</p>
                      {c ? (
                        <dl className="space-y-1 text-xs">
                          <Row label="A favor" value={formatNumber(c.forAvg)} />
                          <Row label="Contra" value={formatNumber(c.againstAvg)} />
                          <Row label={side === 'home' ? 'A favor em casa' : 'A favor fora'} value={c.venueSample ? `${formatNumber(c.venueForAvg)} (${c.venueSample} j.)` : '—'} />
                          <Row label="4+ a favor" value={`${c.atLeast4} de ${c.sample}`} />
                        </dl>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem dados.</p>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Totais por partida. A fonte não informa o minuto de cada escanteio.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {(d.shooters.home.length > 0 || d.shooters.away.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="size-4 text-primary" /> Finalizadores na temporada
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <ShootersTable team={home} rows={d.shooters.home} />
            <ShootersTable team={away} rows={d.shooters.away} />
            <p className="text-xs text-muted-foreground md:col-span-2">Médias por jogo disputado na temporada da competição. Titularidade não confirmada.</p>
          </CardContent>
        </Card>
      )}

      {d.injuries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="size-4 text-primary" /> Desfalques informados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(['mandante', 'visitante'] as const).map((side) => {
              const list = d.injuries.filter((i) => i.equipe === side)
              return (
                <div key={side}>
                  <p className="mb-1 text-sm font-semibold">{side === 'mandante' ? home : away}</p>
                  {list.length ? (
                    <ul className="space-y-1 text-sm">
                      {list.map((i, k) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span>{i.jogador}</span>
                          <span className="text-xs text-muted-foreground">{i.motivo ?? i.tipo ?? ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum desfalque informado.</p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {content.alertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
            <ShieldAlert className="size-4" /> Alertas e limitações
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {content.alertas.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Análise gerada em {formatDateTime(content.meta.generated_at)} a partir de dados da API-Football, com apoio de inteligência artificial. Os textos usam somente os números disponíveis e não garantem resultado.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  )
}

function Probabilities({ content, home, away }: { content: AnalysisContent; home: string; away: string }) {
  const p = content.display.percent
  const market = content.display.odds.find((o) => o.market === 'Resultado final')
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-primary" /> Probabilidade de resultado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {p && (
          <div>
            <div className="mb-2 grid grid-cols-3 text-center text-xs font-semibold text-muted-foreground">
              <span className="truncate">{home}</span>
              <span>Empate</span>
              <span className="truncate">{away}</span>
            </div>
            <div className="flex h-10 overflow-hidden rounded-full text-sm font-bold text-white tabular">
              <div className="grid place-items-center bg-primary" style={{ width: `${p.casa}%` }}>
                {p.casa}%
              </div>
              <div className="grid place-items-center bg-slate-400" style={{ width: `${p.empate}%` }}>
                {p.empate}%
              </div>
              <div className="grid place-items-center bg-brand-dark" style={{ width: `${p.fora}%` }}>
                {p.fora}%
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Percentuais do modelo estatístico da API-Football para esta partida.</p>
          </div>
        )}
        {market && (
          <div>
            <p className="mb-2 text-sm font-semibold">Probabilidade implícita no mercado ({market.bookmaker})</p>
            <div className="grid grid-cols-3 gap-2">
              {market.options.map((o) => (
                <div key={o.label} className="rounded-lg bg-muted/70 p-2 text-center">
                  <p className="text-xs text-muted-foreground">{o.label}</p>
                  <p className="font-display text-lg font-bold tabular">{formatNumber(o.implied, 1)}%</p>
                  <p className="text-[11px] text-muted-foreground tabular">odd {formatNumber(o.odd)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Calculada a partir das odds, sem a margem da casa ({formatNumber(market.margin, 1)}%). Odds mudam até o início do jogo.</p>
          </div>
        )}
        {content.display.odds.filter((o) => o.market !== 'Resultado final').length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {content.display.odds
              .filter((o) => o.market !== 'Resultado final')
              .map((m) => (
                <div key={m.market} className="rounded-lg border p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{m.market}</p>
                  {m.options.map((o) => (
                    <p key={o.label} className="flex justify-between tabular">
                      <span>{o.label}</span>
                      <span className="font-semibold">{formatNumber(o.implied, 1)}%</span>
                    </p>
                  ))}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const RISK_STYLE: Record<Highlight['risco'], string> = {
  baixo: 'bg-green-100 text-green-800',
  medio: 'bg-amber-100 text-amber-800',
  'medio-alto': 'bg-orange-100 text-orange-800',
}

function HighlightCard({ h }: { h: Highlight }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-soft">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-brand-dark">{h.mercado}</h3>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', RISK_STYLE[h.risco])}>{RISK_LABELS[h.risco]}</span>
      </div>
      <p className="text-sm leading-relaxed">{h.leitura}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {h.probabilidade_estimada != null && (
          <span className="rounded-md bg-secondary px-2 py-1 font-semibold text-secondary-foreground">Estimativa: {h.probabilidade_estimada}%</span>
        )}
        {h.frequencia_observada && <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">Frequência: {h.frequencia_observada}</span>}
      </div>
      <div className="mt-3 grid gap-2 border-t pt-3 text-xs">
        <p>
          <span className="font-semibold text-green-700">A favor: </span>
          {h.a_favor}
        </p>
        <p>
          <span className="font-semibold text-red-700">Contra: </span>
          {h.contra}
        </p>
      </div>
    </div>
  )
}

function ShootersTable({ team, rows }: { team: string; rows: Shooter[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{team}</p>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">Jogador</th>
                <th className="py-1 text-right font-medium" title="Finalizações por jogo">Fin./j</th>
                <th className="py-1 text-right font-medium" title="Finalizações no alvo por jogo">No alvo/j</th>
                <th className="py-1 text-right font-medium">Jogos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{r.name}</span>
                    {r.position && <span className="ml-1 text-xs text-muted-foreground">{r.position}</span>}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular">{formatNumber(r.shotsPerGame)}</td>
                  <td className="py-1.5 text-right tabular">{formatNumber(r.onTargetPerGame)}</td>
                  <td className="py-1.5 text-right text-muted-foreground tabular">{r.apps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <TriangleAlert className="size-3" /> Sem dados de finalizações.
        </p>
      )}
    </div>
  )
}
