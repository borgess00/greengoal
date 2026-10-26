import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarDays, Database, LineChart, Smartphone, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FixtureCard, FixtureCardSkeleton } from '@/components/fixtures/fixture-card'
import { EmptyState } from '@/components/common/empty-state'
import { RiskNotice } from '@/components/common/risk-notice'
import { getHomeFixtures } from '@/server/fixtures.functions'
import { formatGradeDate } from '@/lib/grade'
import { seo } from '@/lib/seo'
import { useMe } from '@/hooks/use-auth'

const homeFixturesQuery = queryOptions({ queryKey: ['home-fixtures'], queryFn: () => getHomeFixtures(), staleTime: 60_000 })

export const Route = createFileRoute('/')({
  head: () =>
    seo({
      title: 'GreenGoal — Cada jogo, em números.',
      description: 'Estatísticas, forma recente, confrontos diretos e análises de futebol em português. Informação para decidir melhor, sem promessa de resultado. 18+.',
      path: '/',
    }),
  loader: ({ context }) => context.queryClient.prefetchQuery(homeFixturesQuery),
  component: HomePage,
})

const BENEFITS = [
  { icon: Sparkles, title: 'Análises por partida', text: 'Contexto, forma recente, gols, cartões e finalizadores organizados em seções objetivas, escritas a partir de dados reais.' },
  { icon: CalendarDays, title: 'Jogos organizados', text: 'A grade do dia separada em Tarde e Noite, com filtro por campeonato e horário de Brasília.' },
  { icon: Database, title: 'Dados objetivos', text: 'Números da API-Football. Quando um dado não existe, ele não aparece — nada é inventado para preencher lacunas.' },
  { icon: Smartphone, title: 'Feito para o celular', text: 'Layout pensado para a tela do celular. Adicione o GreenGoal à tela inicial e acesse com um toque.' },
]

function HomePage() {
  const { data, isLoading } = useQuery(homeFixturesQuery)
  const { me } = useMe()
  const subscribed = !!me?.hasActiveSubscription

  return (
    <>
      <section className="hero-pitch relative overflow-hidden text-white">
        <div className="pitch-lines absolute inset-0 opacity-70" aria-hidden />
        <div className="container-page relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
              <BarChart3 className="size-3.5" /> Estatística de futebol em português
            </p>
            <h1 className="font-display text-5xl leading-[1.02] font-bold sm:text-6xl lg:text-7xl">
              Cada jogo,
              <br />
              <span className="text-brand-light">em números.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-emerald-50/90">
              O GreenGoal reúne estatísticas, retrospecto e análises das partidas do dia para você entender o jogo com mais clareza. É fonte de informação — não é garantia de resultado.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {!subscribed && (
                <Button asChild size="lg" variant="white">
                  <Link to="/planos">
                    Assinar <ArrowRight />
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" className="border border-white/25 bg-white/10 text-white shadow-none hover:bg-white/20">
                <Link to="/jogos">
                  <CalendarDays /> Ver jogos de hoje
                </Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-emerald-100/80">
              <span className="grid size-7 place-items-center rounded-full border border-white/60 text-[10px] font-bold">18+</span>
              Somente para maiores de 18 anos. Apostas envolvem risco.
            </p>
          </div>
          <div className="relative hidden justify-center lg:flex">
            <div className="absolute inset-6 rounded-full bg-brand-light/25 blur-3xl" aria-hidden />
            <img src="/logo.png" alt="Logo GreenGoal: barras de crescimento e bola de futebol" width={520} height={399} className="relative w-full max-w-md drop-shadow-2xl" />
          </div>
        </div>
      </section>

      <section className="container-page -mt-8 relative z-10">
        <div className="rounded-2xl border bg-card p-5 shadow-lift sm:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Grade de hoje</p>
              <h2 className="font-display text-2xl font-bold text-brand-dark">{data ? formatGradeDate(data.date) : 'Jogos do dia'}</h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/jogos">
                Ver todos <ArrowRight />
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <FixtureCardSkeleton />
              <FixtureCardSkeleton />
              <FixtureCardSkeleton />
            </div>
          ) : data?.fixtures.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {data.fixtures.map((f) => (
                <FixtureCard key={f.id} fixture={f} />
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="Nenhuma partida publicada ainda" description="Os jogos de hoje aparecem aqui assim que a grade do dia for carregada." className="py-10" />
          )}
        </div>
      </section>

      <section className="container-page mt-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Por que GreenGoal</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-brand-dark sm:text-4xl">Informação organizada, sem atalhos.</h2>
          <p className="mt-3 text-muted-foreground">Menos achismo, mais contexto. Você vê os números da partida e decide por conta própria.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border bg-card p-6 shadow-soft">
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                <b.icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-brand-dark">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page mt-20">
        <div className="hero-pitch relative overflow-hidden rounded-3xl px-6 py-12 text-white sm:px-12">
          <div className="pitch-lines absolute inset-0 opacity-50" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <LineChart className="mb-4 size-9 text-brand-light" />
              <h2 className="font-display text-3xl font-bold">Planos a partir de R$ 19,90</h2>
              <p className="mt-2 text-emerald-50/85">Semanal, mensal ou anual — todos liberam os mesmos recursos: análises completas, conferência de bilhete e radar de escanteios.</p>
            </div>
            <Button asChild size="lg" variant="white">
              <Link to="/planos">
                Conhecer os planos <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
        <RiskNotice className="mt-8" />
      </section>
    </>
  )
}
