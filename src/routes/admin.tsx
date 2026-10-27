import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CalendarDays, CircleCheck, CircleX, Database, DownloadCloud, Flag, Loader2, Play, Plus, RefreshCw, Settings, ShieldCheck, Square, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage, formatDateTime } from '@/lib/format'
import { addDays, currentGradeDate, formatGradeDate, isValidDate } from '@/lib/grade'
import { requireAdminRole } from '@/lib/guards'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { addLeague, adminOverview, getSettings, listLeagues, syncFixtures, updateLeague, updateSettings, verifyLeaguesFn, type AdminFixture } from '@/server/admin.functions'
import { generateAnalysis } from '@/server/analysis.functions'
import { collectCornersForFixture } from '@/server/corners.functions'

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: ({ location }) => requireAdminRole(location),
  head: () => seo({ title: 'Administração', description: 'Painel administrativo do GreenGoal.', path: '/admin', noindex: true }),
  component: AdminPage,
})

const STALE_MS = 10 * 60_000

type RowStatus = 'none' | 'done' | 'generating' | 'error'
function rowStatus(f: AdminFixture): RowStatus {
  const a = f.analysis
  if (!a || a.status === 'pending') return 'none'
  if (a.status === 'generating' && Date.now() - Date.parse(a.updated_at) > STALE_MS) return 'error'
  return a.status as RowStatus
}

const STATUS_UI: Record<RowStatus, { label: string; variant: 'muted' | 'success' | 'warning' | 'danger' }> = {
  none: { label: 'Sem análise', variant: 'muted' },
  done: { label: 'Gerada', variant: 'success' },
  generating: { label: 'Gerando', variant: 'warning' },
  error: { label: 'Com erro', variant: 'danger' },
}

function AdminPage() {
  const [date, setDate] = React.useState(currentGradeDate())
  return (
    <>
      <PageHeader eyebrow="Administração" title="Painel do GreenGoal" description="Sincronize a grade, gere análises e acompanhe o consumo diário de IA. As operações são iniciadas manualmente — não há agendamento automático." />
      <div className="container-page py-8">
        <Tabs defaultValue="grade">
          <TabsList>
            <TabsTrigger value="grade">
              <CalendarDays /> Grade e análises
            </TabsTrigger>
            <TabsTrigger value="ligas">
              <Flag /> Campeonatos
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings /> Coleta
            </TabsTrigger>
          </TabsList>
          <TabsContent value="grade">
            <GradePanel date={date} setDate={setDate} />
          </TabsContent>
          <TabsContent value="ligas">
            <LeaguesPanel />
          </TabsContent>
          <TabsContent value="config">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function GradePanel({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const queryClient = useQueryClient()
  const overview = useQuery({
    queryKey: ['admin-overview', date],
    queryFn: () => adminOverview({ data: { date } }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const [busy, setBusy] = React.useState<Set<number>>(new Set())
  const [batch, setBatch] = React.useState<{ running: boolean; done: number; total: number; label: string } | null>(null)
  const stopRef = React.useRef(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-overview'] })

  const sync = useMutation({
    mutationFn: () => syncFixtures({ data: { date } }),
    onSuccess: (r) => {
      toast.success(`${r.saved} partida(s) salvas para ${formatGradeDate(date)}.`)
      refresh()
      queryClient.invalidateQueries({ queryKey: ['grade'] })
      queryClient.invalidateQueries({ queryKey: ['home-fixtures'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  async function generateOne(id: number, force: boolean) {
    setBusy((s) => new Set(s).add(id))
    try {
      const r = await generateAnalysis({ data: { fixtureId: id, force } })
      if (r.ok) {
        if (!r.skipped) toast.success('Análise gerada.')
      } else if ('limitReached' in r && r.limitReached) {
        toast.error(`Limite diário de IA atingido (${r.used}/${r.limit}).`)
      } else if ('error' in r) {
        toast.error(r.error)
      }
      return r
    } catch (e) {
      toast.error(errorMessage(e))
      return null
    } finally {
      setBusy((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
      refresh()
    }
  }

  /** Geração em lote: sequencial, pula concluídas e para ao atingir o teto. */
  async function generateAll() {
    const list = (overview.data?.fixtures ?? []).filter((f) => rowStatus(f) !== 'done')
    if (!list.length) return toast.info('Todas as partidas desta grade já têm análise.')
    stopRef.current = false
    setBatch({ running: true, done: 0, total: list.length, label: 'Gerando análises' })
    let ok = 0
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break
      const r = await generateOne(list[i].id, false)
      if (r && !r.ok && 'limitReached' in r && r.limitReached) break
      if (r?.ok) ok++
      setBatch((b) => (b ? { ...b, done: i + 1 } : b))
    }
    setBatch(null)
    toast.message(`Lote finalizado: ${ok} análise(s) concluída(s).`)
  }

  async function collectCorners() {
    const list = (overview.data?.fixtures ?? []).filter((f) => !f.has_data)
    if (!list.length) return toast.info('Todas as partidas já têm dados coletados.')
    stopRef.current = false
    setBatch({ running: true, done: 0, total: list.length, label: 'Coletando dados de escanteios' })
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break
      try {
        await collectCornersForFixture({ data: { fixtureId: list[i].id } })
      } catch (e) {
        toast.error(`${list[i].home_team_name} x ${list[i].away_team_name}: ${errorMessage(e)}`)
      }
      setBatch((b) => (b ? { ...b, done: i + 1 } : b))
    }
    setBatch(null)
    refresh()
    toast.message('Coleta de escanteios finalizada.')
  }

  const data = overview.data
  const usagePct = data ? (data.usage.used / data.usage.limit) * 100 : 0
  const limitReached = !!data && data.usage.used >= data.usage.limit
  const counts = (data?.fixtures ?? []).reduce<Record<RowStatus, number>>((a, f) => ({ ...a, [rowStatus(f)]: a[rowStatus(f)] + 1 }), { none: 0, done: 0, generating: 0, error: 0 })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Data dos jogos</CardTitle>
            <CardDescription>Jogos do dia no horário de Brasília (00h00 às 23h59).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="adm-date">Data</Label>
              <Input id="adm-date" type="date" value={date} onChange={(e) => isValidDate(e.target.value) && setDate(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" onClick={() => setDate(addDays(date, -1))}>
              Anterior
            </Button>
            <Button variant="outline" onClick={() => setDate(addDays(date, 1))}>
              Próxima
            </Button>
            <div className="flex w-full flex-wrap gap-2 pt-2">
              <Button onClick={() => sync.mutate()} disabled={sync.isPending || !!batch || !data?.config.football}>
                {sync.isPending ? <Loader2 className="animate-spin" /> : <DownloadCloud />} Buscar jogos do dia
              </Button>
              <Button variant="dark" onClick={generateAll} disabled={!!batch || limitReached || !data?.config.ai || !data?.config.football}>
                <Wand2 /> Gerar análises do dia
              </Button>
              <Button variant="outline" onClick={collectCorners} disabled={!!batch || !data?.config.football}>
                <Flag /> Coletar escanteios
              </Button>
              {batch && (
                <Button variant="destructive" onClick={() => (stopRef.current = true)}>
                  <Square /> Parar
                </Button>
              )}
            </div>
            {batch && (
              <div className="w-full space-y-1 pt-2">
                <p className="text-sm font-medium">
                  {batch.label}: {batch.done}/{batch.total}
                </p>
                <Progress value={(batch.done / batch.total) * 100} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-primary" /> Uso diário de IA
            </CardTitle>
            <CardDescription>Teto global por dia (São Paulo), não por assinante.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data ? (
              <>
                <p className="font-display text-3xl font-bold tabular">
                  {data.usage.used}
                  <span className="text-lg text-muted-foreground">/{data.usage.limit}</span>
                </p>
                <Progress value={usagePct} indicatorClassName={cn(usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 && 'bg-amber-500')} />
                {limitReached && <p className="text-sm font-semibold text-red-600">Limite atingido. Novas gerações bloqueadas até amanhã.</p>}
                <div className="space-y-1 pt-1 text-xs">
                  <ConfigLine ok={data.config.football} label="API_FOOTBALL_KEY" />
                  <ConfigLine ok={data.config.ai} label={`${data.config.aiKey} (${data.config.model})`} />
                  {data.apiRemaining != null && <p className="text-muted-foreground">API-Football: {data.apiRemaining} requisições restantes hoje (última leitura).</p>}
                </div>
              </>
            ) : (
              <Skeleton className="h-20" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Partidas de {formatGradeDate(date)}</CardTitle>
            <CardDescription>
              {data?.fixtures.length ?? 0} partidas · {counts.done} geradas · {counts.none} sem análise · {counts.error} com erro
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className={overview.isFetching ? 'animate-spin' : ''} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {overview.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-40" />
            </div>
          ) : !data?.fixtures.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma partida salva para esta data. Use “Buscar jogos do dia”.</p>
          ) : (
            <ul className="divide-y">
              {data.fixtures.map((f) => {
                const st = rowStatus(f)
                const isBusy = busy.has(f.id) || st === 'generating'
                return (
                  <li key={f.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-12 font-display font-bold tabular text-brand-dark">{f.local_time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {f.home_team_name} x {f.away_team_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.league_name} · #{f.id}
                        {f.has_data && ' · dados coletados'}
                      </p>
                      {st === 'error' && f.analysis?.error && <p className="mt-1 text-xs text-red-600">{f.analysis.error}</p>}
                      {st === 'error' && !f.analysis?.error && <p className="mt-1 text-xs text-red-600">Geração interrompida (sem resposta há mais de 10 min).</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_UI[busy.has(f.id) ? 'generating' : st].variant}>{STATUS_UI[busy.has(f.id) ? 'generating' : st].label}</Badge>
                      <Button size="sm" variant={st === 'done' ? 'outline' : 'default'} disabled={isBusy || !!batch || limitReached} onClick={() => generateOne(f.id, st === 'done' || st === 'error')}>
                        {isBusy ? <Loader2 className="animate-spin" /> : <Play />}
                        {st === 'done' || st === 'error' ? 'Gerar de novo' : 'Gerar'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {data && data.runs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-primary" /> Últimas operações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.runs.map((r) => (
                <li key={r.id as string} className="flex flex-wrap items-center gap-2 py-2">
                  {r.status === 'ok' ? <CircleCheck className="size-4 text-green-600" /> : <CircleX className="size-4 text-red-600" />}
                  <span className="font-semibold">{({ sync: 'Sincronização', generate: 'Geração', collect: 'Coleta', leagues: 'Campeonatos' } as Record<string, string>)[r.kind as string] ?? r.kind}</span>
                  {r.fixture_id ? <span className="text-muted-foreground">#{r.fixture_id as number}</span> : null}
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at as string)}</span>
                  <span className="w-full truncate text-xs text-muted-foreground sm:w-auto sm:flex-1">{summarizeRun(r.details as Record<string, unknown>)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function summarizeRun(d: Record<string, unknown>) {
  if (d.message) return String(d.message)
  const parts: string[] = []
  if (d.saved != null) parts.push(`${d.saved} salvas`)
  if (d.api_calls != null) parts.push(`${d.api_calls} chamadas à API`)
  if (d.cached != null) parts.push(`${d.cached} do cache`)
  if (d.checked != null) parts.push(`${d.checked} verificados`)
  return parts.join(' · ')
}

function ConfigLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={cn('flex items-center gap-1.5', ok ? 'text-green-700' : 'text-red-600')}>
      {ok ? <ShieldCheck className="size-3.5" /> : <CircleX className="size-3.5" />} {label} {ok ? 'configurada' : 'ausente'}
    </p>
  )
}

function LeaguesPanel() {
  const queryClient = useQueryClient()
  const leagues = useQuery({ queryKey: ['admin-leagues'], queryFn: () => listLeagues() })
  const [newId, setNewId] = React.useState('')
  const [newName, setNewName] = React.useState('')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-leagues'] })
  const toggle = useMutation({ mutationFn: (v: { id: number; enabled: boolean }) => updateLeague({ data: v }), onSuccess: invalidate, onError: (e) => toast.error(errorMessage(e)) })
  const add = useMutation({
    mutationFn: () => addLeague({ data: { id: Number(newId), name: newName } }),
    onSuccess: () => {
      toast.success('Campeonato adicionado. Use “Verificar” para conferir na API.')
      setNewId('')
      setNewName('')
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const verify = useMutation({
    mutationFn: () => verifyLeaguesFn({ data: {} }),
    onSuccess: (r) => {
      const bad = r.filter((x) => !x.ok).length
      toast.success(`${r.length - bad} confirmados${bad ? `, ${bad} não encontrados (desativados)` : ''}.`)
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const enabled = leagues.data?.filter((l) => l.enabled).length ?? 0
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobertura</CardTitle>
          <CardDescription>
            A sincronização busca todas as partidas da data em uma única consulta e mantém apenas os campeonatos habilitados — ampliar a lista não aumenta o número de chamadas da
            sincronização. {enabled} campeonato(s) habilitado(s).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="lg-id">ID na API-Football</Label>
            <Input id="lg-id" inputMode="numeric" value={newId} onChange={(e) => setNewId(e.target.value.replace(/\D/g, ''))} className="w-36" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lg-name">Nome</Label>
            <Input id="lg-name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-64" />
          </div>
          <Button onClick={() => add.mutate()} disabled={!newId || newName.trim().length < 2 || add.isPending}>
            <Plus /> Adicionar
          </Button>
          <Button variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>
            {verify.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verificar campeonatos pendentes
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 sm:p-0">
          {leagues.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-60" />
            </div>
          ) : (
            <ul className="divide-y">
              {leagues.data?.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  {l.logo ? <img src={l.logo} alt="" className="size-6 object-contain" /> : <span className="size-6 rounded bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {l.name} <span className="text-xs font-normal text-muted-foreground">#{l.id}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.country ?? '—'}
                      {l.api_name && l.api_name !== l.name && ` · API: ${l.api_name}`}
                    </p>
                  </div>
                  {l.core && <Badge variant="secondary">Base</Badge>}
                  {l.verified ? <Badge variant="success">Verificado</Badge> : <Badge variant="warning">Não verificado</Badge>}
                  <Switch checked={l.enabled} onCheckedChange={(v) => toggle.mutate({ id: l.id, enabled: v })} aria-label={`Habilitar ${l.name}`} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPanel() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => getSettings() })
  const [form, setForm] = React.useState<Record<string, number>>({})
  React.useEffect(() => {
    if (settings.data) setForm(settings.data)
  }, [settings.data])
  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        data: {
          collect_last_matches: form.collect_last_matches,
          collect_match_stats: form.collect_match_stats,
          collect_player_pages: form.collect_player_pages,
        },
      }),
    onSuccess: () => {
      toast.success('Configurações salvas.')
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const fields = [
    { key: 'collect_last_matches', label: 'Jogos recentes por equipe', help: 'Base da forma recente e das frequências (1 a 20).', min: 1, max: 20 },
    { key: 'collect_match_stats', label: 'Jogos com estatística detalhada', help: 'Escanteios, finalizações e cartões por partida (0 a 10). Cada jogo novo custa 1 chamada; encerrados ficam em cache.', min: 0, max: 10 },
    { key: 'collect_player_pages', label: 'Páginas de jogadores por equipe', help: 'Finalizadores da temporada, 20 jogadores por página (0 a 5).', min: 0, max: 5 },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profundidade da coleta</CardTitle>
        <CardDescription>
          Mais profundidade = análises mais completas e mais chamadas à API-Football. O teto diário de IA ({settings.data?.ai_daily_limit ?? 50} gerações) é fixo e controlado no banco.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type="number"
              min={f.min}
              max={f.max}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: Math.max(f.min, Math.min(f.max, Number(e.target.value))) }))}
            />
            <p className="text-xs text-muted-foreground">{f.help}</p>
          </div>
        ))}
        <Button className="justify-self-start" onClick={() => save.mutate()} disabled={save.isPending || settings.isLoading}>
          Salvar
        </Button>
      </CardContent>
    </Card>
  )
}
