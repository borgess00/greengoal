import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Flag, Info, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { TeamCrest } from '@/components/common/team-crest'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth, useMe } from '@/hooks/use-auth'
import { renderCornerReport } from '@/lib/corner-report'
import { MIN_CORNER_SAMPLE } from '@/lib/corners'
import { errorMessage, formatNumber } from '@/lib/format'
import { addDays, currentGradeDate, formatGradeDate, isValidDate } from '@/lib/grade'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getCornerRadar } from '@/server/corners.functions'

export const Route = createFileRoute('/escanteios')({
  validateSearch: z.object({ data: z.string().refine(isValidDate).optional().catch(undefined) }),
  head: () =>
    seo({
      title: 'Radar de escanteios',
      description: 'Médias de escanteios a favor e cedidos de todas as equipes da grade do dia, com amostras e frequências. Recurso para assinantes.',
      path: '/escanteios',
    }),
  component: EscanteiosPage,
})

function EscanteiosPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/escanteios' })
  const date = search.data ?? currentGradeDate()
  const { user, loading: authLoading } = useAuth()
  const { me, loading } = useMe()
  const allowed = !!me && (me.hasActiveSubscription || me.isAdmin)
  const radar = useQuery({
    queryKey: ['corner-radar', date],
    queryFn: () => getCornerRadar({ data: { date } }),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })
  const [exporting, setExporting] = React.useState(false)
  const setDate = (d: string) => navigate({ search: { data: d === currentGradeDate() ? undefined : d } })

  async function exportImage() {
    if (!radar.data) return
    setExporting(true)
    try {
      const blob = await renderCornerReport(radar.data.rows, date, 15)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `greengoal-escanteios-${date}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Assinantes" title="Radar de escanteios" description="Todas as equipes da grade com amostra disponível, ordenadas pela média combinada de escanteios a favor e cedidos pelo adversário.">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="white" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 truncate rounded-full sm:flex-none bg-white/10 px-4 py-2 text-center font-semibold ring-1 ring-white/20">{formatGradeDate(date)}</div>
          <Button size="icon" variant="white" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </PageHeader>
      <div className="container-page py-8">
        <div className="mb-6 flex gap-3 rounded-xl border border-primary/20 bg-secondary/60 p-4 text-sm text-secondary-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            As médias são <strong>totais por partida</strong>. A fonte de dados atual (API-Football) não informa o minuto de cada escanteio, então o radar <strong>não estima</strong> escanteios nos
            primeiros 10 minutos. “Combinada” é a média simples entre escanteios a favor da equipe e cedidos pelo adversário — não é probabilidade. Equipes com menos de {MIN_CORNER_SAMPLE} jogos de
            amostra ficam no fim da lista.
          </p>
        </div>

        {authLoading || loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : !user || !allowed ? (
          <EmptyState
            icon={Lock}
            title="Recurso exclusivo para assinantes"
            description="O radar de escanteios fica disponível com qualquer plano ativo."
            action={
              <Button asChild>
                <Link to={user ? '/planos' : '/auth'} search={user ? undefined : { redirect: '/escanteios' }}>
                  {user ? 'Assine para liberar' : 'Entrar'}
                </Link>
              </Button>
            }
          />
        ) : radar.isLoading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : radar.isError ? (
          <EmptyState icon={Flag} title="Não foi possível carregar o radar" description={errorMessage(radar.error)} action={<Button onClick={() => radar.refetch()}>Tentar novamente</Button>} />
        ) : !radar.data?.rows.length ? (
          <EmptyState
            icon={Flag}
            title="Sem dados de escanteios para esta grade"
            description={radar.data?.fixtures ? `${radar.data.fixtures} partida(s) na grade, mas os dados de escanteios ainda não foram coletados.` : 'Não há partidas armazenadas para esta data.'}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {radar.data.rows.length} equipes · {radar.data.covered} de {radar.data.fixtures} partidas com dados
              </p>
              <Button variant="outline" onClick={exportImage} disabled={exporting}>
                <Download /> {exporting ? 'Gerando…' : 'Baixar relatório (imagem)'}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Equipe</th>
                    <th className="px-4 py-3 text-right font-semibold" title="Média de escanteios a favor">A favor</th>
                    <th className="px-4 py-3 text-right font-semibold" title="Média a favor no mesmo mando">No mando</th>
                    <th className="px-4 py-3 text-right font-semibold" title="Média de escanteios cedidos pelo adversário">Adv. cede</th>
                    <th className="px-4 py-3 text-right font-semibold">Combinada</th>
                    <th className="px-4 py-3 text-right font-semibold" title="Jogos com 5 ou mais escanteios a favor">5+ a favor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {radar.data.rows.map((r, i) => {
                    const small = r.sample < MIN_CORNER_SAMPLE
                    return (
                      <tr key={`${r.fixtureId}-${r.venue}`} className={cn(small && 'opacity-60')}>
                        <td className="px-4 py-3 font-display font-bold text-brand-dark tabular">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link to="/jogo/$id" params={{ id: String(r.fixtureId) }} className="flex items-center gap-2.5 hover:underline">
                            <TeamCrest name={r.team} logo={r.teamLogo} size={24} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {r.team} <span className="text-xs font-normal text-muted-foreground">({r.venue})</span>
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {r.local_time} · x {r.opponent} · {r.league_name}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular">{formatNumber(r.forAvg, 1)}</td>
                        <td className="px-4 py-3 text-right tabular">{r.venueSample ? `${formatNumber(r.venueForAvg, 1)} (${r.venueSample})` : '—'}</td>
                        <td className="px-4 py-3 text-right tabular">{r.opponentSample ? formatNumber(r.opponentConcededAvg, 1) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="rounded-md bg-brand-dark px-2 py-1 font-display font-bold text-white tabular">{formatNumber(r.combinedAvg, 1)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {r.atLeast5}/{r.sample}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <RiskNotice className="mt-8" />
      </div>
    </>
  )
}
