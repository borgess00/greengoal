import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search, SearchX } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { FixtureCard, FixtureCardSkeleton } from '@/components/fixtures/fixture-card'
import { Input } from '@/components/ui/input'
import { formatGradeDate } from '@/lib/grade'
import { seo } from '@/lib/seo'
import type { FixtureRow } from '@/lib/types'
import { searchFixtures } from '@/server/stats.functions'

export const Route = createFileRoute('/busca')({
  validateSearch: z.object({ q: z.string().max(60).optional().catch(undefined) }),
  head: () => seo({ title: 'Buscar jogos', description: 'Encontre jogos por time ou campeonato.', path: '/busca' }),
  component: BuscaPage,
})

function BuscaPage() {
  const { q = '' } = Route.useSearch()
  const navigate = useNavigate({ from: '/busca' })
  const [text, setText] = React.useState(q)
  // Atualiza a URL (e a busca) depois de uma pausa na digitação.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) navigate({ search: { q: text.trim() || undefined }, replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [text, q, navigate])
  const term = q.trim()
  const results = useQuery({
    queryKey: ['search', term],
    queryFn: () => searchFixtures({ data: { q: term } }),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const byDate = React.useMemo(() => {
    const m = new Map<string, FixtureRow[]>()
    for (const f of results.data?.fixtures ?? []) m.set(f.grade_date, [...(m.get(f.grade_date) ?? []), f])
    return [...m.entries()].map(([d, l]) => [d, l.sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))] as const)
  }, [results.data])

  return (
    <>
      <PageHeader eyebrow="Busca" title="Buscar jogos" description="Digite o nome de um time ou campeonato. A busca cobre os jogos carregados dos últimos e dos próximos 7 dias.">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            navigate({ search: { q: text.trim() || undefined }, replace: true })
          }}
          className="relative max-w-xl"
        >
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: Flamengo, Premier League…"
            aria-label="Time ou campeonato"
            maxLength={60}
            className="h-12 rounded-full bg-white pl-12 text-base text-foreground"
          />
        </form>
      </PageHeader>
      <div className="container-page py-8">
        {term.length < 2 ? (
          <EmptyState icon={Search} title="O que você procura?" description="Digite pelo menos 2 letras do nome do time ou do campeonato." />
        ) : results.isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <FixtureCardSkeleton />
            <FixtureCardSkeleton />
            <FixtureCardSkeleton />
          </div>
        ) : results.isError ? (
          <EmptyState icon={SearchX} title="Não foi possível buscar agora" description="Tente novamente em instantes." />
        ) : !byDate.length ? (
          <EmptyState icon={SearchX} title={`Nenhum jogo encontrado para “${term}”`} description="Confira a grafia ou tente outro nome. Só aparecem jogos dos campeonatos cobertos e já carregados." />
        ) : (
          <div className="space-y-8">
            {byDate.map(([date, list]) => (
              <section key={date}>
                <h2 className="mb-3 font-display text-lg font-bold text-brand-dark">{formatGradeDate(date)}</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {list.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
