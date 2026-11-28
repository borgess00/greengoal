import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarDays, Layers, Search, Sparkles, Star } from 'lucide-react'
import { PricingPlans } from '@/components/billing/pricing-plans'
import { EmptyState } from '@/components/common/empty-state'
import { TeamCrest } from '@/components/common/team-crest'
import { FixtureCard, FixtureCardSkeleton } from '@/components/fixtures/fixture-card'
import { FeaturedMatchCard } from '@/components/stats/featured-match'
import { MarketAngleCard } from '@/components/stats/market-angles'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/use-auth'
import { FAQ } from '@/lib/faq'
import { formatGradeDate } from '@/lib/grade'
import { FALLBACK_PLANS } from '@/lib/plans'
import { seo } from '@/lib/seo'
import type { PlanRow } from '@/lib/types'
import { getHomeFixtures } from '@/server/fixtures.functions'
import { getPlans } from '@/server/plans.functions'
import { getFeaturedMatch, type FeaturedMatch } from '@/server/stats.functions'

const homeFixturesQuery = queryOptions({ queryKey: ['home-fixtures'], queryFn: () => getHomeFixtures(), staleTime: 60_000 })
const featuredQuery = queryOptions({ queryKey: ['featured-match'], queryFn: () => getFeaturedMatch(), staleTime: 5 * 60_000 })
const plansQuery = queryOptions({ queryKey: ['plans'], queryFn: () => getPlans(), staleTime: 10 * 60_000 })

export const Route = createFileRoute('/')({
  head: () =>
    seo({
      title: 'GreenGoal — Cada jogo, em números.',
      description: 'Estatísticas, forma recente, mercados testados por vários ângulos e análises de futebol em português. Informação para decidir melhor, sem promessa de resultado. 18+.',
      path: '/',
    }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.prefetchQuery(homeFixturesQuery), context.queryClient.prefetchQuery(featuredQuery), context.queryClient.prefetchQuery(plansQuery)]),
  component: HomePage,
})

const FAQ_KEYS = ['garante', 'Mercados por ângulo', 'De onde vêm os dados', 'bilhetes prontos', 'Quais planos', 'cancelar']
const HOME_FAQ = FAQ_KEYS.map((k) => FAQ.find((f) => f.q.includes(k))).filter((f): f is (typeof FAQ)[number] => !!f)

function HomePage() {
  const { data, isLoading } = useQuery(homeFixturesQuery)
  const featured = useQuery(featuredQuery)
  const { data: plans = FALLBACK_PLANS } = useQuery(plansQuery)
  const { user, me } = useMe()
  const navigate = useNavigate()
  const subscribed = !!me?.hasActiveSubscription

  function choose(plan: PlanRow) {
    if (user) navigate({ to: '/planos', search: { plano: plan.id as 'weekly' | 'monthly' | 'annual' } })
    else navigate({ to: '/auth', search: { redirect: `/planos?plano=${plan.id}`, modo: 'cadastro' } })
  }

  return (
    // Fundo escuro até o rodapé (cobre a margem superior dele).
    <div className="-mb-20 overflow-hidden bg-ink pb-20 text-white">
      {/* ---------------- Entrada ---------------- */}
      <section className="relative">
        <div className="glow-band pointer-events-none absolute inset-x-[-20%] top-[52%] h-[520px] -rotate-6 opacity-80" aria-hidden />
        <div className="pitch-lines pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" aria-hidden />
        <div className="container-page relative grid items-center gap-10 pt-12 pb-16 sm:pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:pt-20 lg:pb-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
              <BarChart3 className="size-3.5 text-brand-light" /> Estatística de futebol em português · 18+
            </p>
            <h1 className="font-display text-[3.1rem] leading-[0.98] font-black tracking-tight whitespace-nowrap uppercase min-[400px]:text-[3.4rem] sm:text-7xl lg:text-[4.4rem] xl:text-[5rem]">
              <span className="text-glow text-brand-light">Cada jogo,</span>
              <br />
              em números.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              Forma recente, médias dos últimos 5 e 10 jogos e cada mercado testado por vários ângulos — para você saber com que frequência algo aconteceu antes de decidir.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-brand-light text-ink shadow-[0_0_30px_rgb(74_222_128/0.35)] hover:bg-brand-light/90">
                <Link to="/jogos">
                  <CalendarDays /> Ver jogos de hoje
                </Link>
              </Button>
              {!subscribed && (
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <a href="#planos">
                    Ver planos <ArrowRight />
                  </a>
                </Button>
              )}
            </div>
            <p className="mt-5 text-sm text-white/55">Comece grátis. Plano completo a partir de R$ 7,90 por semana.</p>
          </div>
          <figure className="relative mx-auto w-full max-w-[540px] lg:order-first">
            <div className="absolute inset-[12%] rounded-full bg-brand-light/30 blur-3xl" aria-hidden />
            <img
              src="/celulares-app.webp"
              srcSet="/celulares-app-640.webp 533w, /celulares-app.webp 1066w"
              sizes="(min-width: 1024px) 540px, 90vw"
              width={1066}
              height={1195}
              alt="Telas do GreenGoal no celular: jogos do dia, forma recente, estatísticas da partida, gráfico de gols e leitura da partida"
              className="relative w-full drop-shadow-[0_30px_60px_rgb(0_0_0/0.55)]"
              fetchPriority="high"
            />
            <figcaption className="relative mt-1 text-center text-[11px] text-white/40">Imagem ilustrativa — os números do site vêm dos jogos reais.</figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------- Jogos de hoje ---------------- */}
      <section className="container-page relative z-10 -mt-6 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-brand-light uppercase">Grade de hoje</p>
            <h2 className="font-display text-3xl font-bold">{data ? formatGradeDate(data.date) : 'Jogos do dia'}</h2>
          </div>
          <Button asChild variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
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
          <div className="grid gap-4 text-foreground md:grid-cols-3">
            {data.fixtures.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="Nenhuma partida publicada ainda" description="Os jogos de hoje aparecem aqui assim que a grade do dia for carregada." className="border-white/15 bg-white/5 py-10 text-white" />
        )}
      </section>

      {/* ---------------- Ângulos ---------------- */}
      <section className="container-page relative pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold text-brand-light">A gente faz a pesquisa por você</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-5xl">Cada mercado, testado por vários ângulos</h2>
            <p className="mt-4 text-white/65 sm:text-lg">
              Olhamos cada time nos últimos 10 e 5 jogos, no mesmo mando, na mesma competição e no confronto direto. Você vê em quantos jogos o mercado aconteceu e percebe se é um padrão ou só uma fase.
            </p>
            <ul className="mt-6 space-y-3">
              {['Em quantos jogos o mercado aconteceu', 'Casa, fora, competição e confronto direto lado a lado', 'Os mais consistentes aparecem primeiro', 'Frequência do passado — não é previsão'].map((n) => (
                <li key={n} className="flex items-center gap-3 text-white/80">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-light/15 text-xs font-bold text-brand-light">✓</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <AnglesShowcase featured={featured.data ?? null} />
        </div>
      </section>

      {featured.data && (
        <section className="container-page pb-24 text-foreground">
          <FeaturedMatchCard data={featured.data} />
        </section>
      )}

      {/* ---------------- O que você recebe ---------------- */}
      <section className="container-page pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
          <h2 className="font-display text-3xl font-bold sm:text-5xl">O que você recebe?</h2>
          <p className="mt-3 max-w-xl text-white/65 sm:text-lg">Os números por trás de cada jogo, os recortes que mudam a leitura e tudo organizado no celular.</p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              { icon: BarChart3, title: 'Estatísticas que fazem a diferença', text: 'Últimos 5 e 10 jogos de cada time: gols, finalizações, escanteios, cartões e posse, com gráficos, radar comparativo e leitura da partida.' },
              { icon: Layers, title: 'Mercados por ângulo', text: 'Mais de 1,5 gols, ambos marcam, escanteios, cartões… cada mercado com a frequência geral, em casa ou fora, na competição e no confronto direto.' },
              { icon: Sparkles, title: 'Análises e bilhetes prontos', text: 'Análises escritas a partir dos dados reais da partida e bilhetes do dia em quatro faixas: odd baixa, média, alta e altíssima, com odds quando a fonte informa.' },
              { icon: Star, title: 'Meus bilhetes e favoritos', text: 'Monte seus bilhetes no site e acompanhe sozinho se bateram, com taxa de acerto e resultado em unidades. Siga seus times e busque qualquer jogo.' },
            ].map((f) => (
              <li key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="mb-3 grid size-11 place-items-center rounded-xl border border-brand-light/30 bg-brand-light/10 text-brand-light">
                  <f.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{f.title}</h3>
                  <p className="mt-1 text-white/65">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
          </div>
          <figure className="relative">
            <div className="absolute inset-[15%] rounded-full bg-brand-light/20 blur-3xl" aria-hidden />
            <img
              src="/painel-app.webp"
              srcSet="/painel-app-410.webp 410w, /painel-app.webp 820w"
              sizes="(min-width: 1024px) 560px, 92vw"
              width={820}
              height={560}
              loading="lazy"
              alt="Painel do GreenGoal com jogos do dia, gráfico de estatísticas da partida e cartões de análise"
              className="relative w-full"
            />
            <figcaption className="relative mt-1 text-center text-[11px] text-white/40">Imagem ilustrativa.</figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------- Planos ---------------- */}
      <section id="planos" className="container-page scroll-mt-24 pb-24">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-5xl">Escolha seu plano</h2>
          <p className="mt-3 text-white/65 sm:text-lg">Comece grátis e assine quando quiser.</p>
        </div>
        <PricingPlans
          plans={plans}
          tone="dark"
          onChoose={choose}
          freeAction={
            <Button asChild variant="outline" size="lg" className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              {user ? <Link to="/jogos">Ver jogos de hoje</Link> : <Link to="/auth" search={{ modo: 'cadastro' }}>Criar conta grátis</Link>}
            </Button>
          }
        />
      </section>

      {/* ---------------- Perguntas ---------------- */}
      <section className="container-page grid gap-10 pb-24 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-display text-3xl font-bold sm:text-5xl">Perguntas frequentes</h2>
          <p className="mt-3 text-white/65 sm:text-lg">O que você precisa saber antes de começar.</p>
          <p className="mt-6 text-sm">
            <Link to="/sobre" className="font-semibold text-brand-light hover:underline">
              Ver todas as perguntas →
            </Link>
          </p>
        </div>
        <Accordion type="single" collapsible defaultValue="0" className="space-y-3">
          {HOME_FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={String(i)} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 last:border-b">
              <AccordionTrigger className="text-base text-white hover:text-brand-light [&>svg]:text-white/60">{f.q}</AccordionTrigger>
              <AccordionContent className="text-white/65">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ---------------- Chamada final ---------------- */}
      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl border border-brand-light/30 bg-gradient-to-b from-brand-deep to-ink px-6 py-12 text-center text-white sm:px-12">
          <div className="glow-band pointer-events-none absolute inset-x-0 -bottom-40 h-72 opacity-60" aria-hidden />
          <img src="/logo.png" alt="" width={520} height={399} className="relative mx-auto w-40 drop-shadow-2xl sm:w-48" />
          <div className="relative mx-auto mt-4 max-w-2xl">
            <h2 className="font-display text-3xl leading-tight font-bold sm:text-5xl">Os jogos de hoje já estão esperando</h2>
            <p className="mt-4 text-lg text-white/75">Veja a grade do dia, a forma dos times e os números de cada partida. Assine o Pro quando quiser liberar tudo.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-brand-light text-ink hover:bg-brand-light/90">
                <Link to="/jogos">
                  <CalendarDays /> Ver jogos de hoje
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/busca">
                  <Search /> Buscar um time
                </Link>
              </Button>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-white/50">
          18+. O GreenGoal oferece estatísticas e análises de futebol. Não é casa de apostas: não recebe apostas nem guarda dinheiro. Números descrevem o passado e não garantem resultados.{' '}
          <Link to="/jogo-responsavel" className="underline hover:text-white">
            Jogue com responsabilidade
          </Link>
          .
        </p>
      </section>
    </div>
  )
}

/** Vitrine dos mercados por ângulo com dados reais do destaque do dia. */
function AnglesShowcase({ featured }: { featured: FeaturedMatch | null }) {
  const markets = featured?.markets ?? []
  const logoOf = (side: 'home' | 'away') => (side === 'home' ? featured?.fixture.home_team_logo : featured?.fixture.away_team_logo)
  if (!markets.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white/75">
        <p className="font-display text-lg font-bold text-white">Exemplo de leitura</p>
        <p className="mt-2">
          <strong className="text-brand-light">7/10</strong> nos últimos 10 jogos · <strong className="text-brand-light">4/5</strong> jogando em casa ·{' '}
          <strong className="text-brand-light">3/3</strong> no confronto direto
        </p>
        <p className="mt-3 text-xs text-white/45">Os mercados reais aparecem aqui quando as estatísticas do dia forem coletadas.</p>
      </div>
    )
  }
  return (
    <div className="relative space-y-4">
      <div className="absolute inset-8 rounded-full bg-brand-light/20 blur-3xl" aria-hidden />
      {markets.map((m, i) => (
        <div key={m.key} className={i === 1 ? 'relative sm:ml-10' : 'relative sm:mr-10'}>
          <MarketAngleCard m={m} tone="dark" defaultOpen={i === 0} logo={<TeamCrest name={m.team} logo={logoOf(m.side)} size={32} />} />
        </div>
      ))}
      <p className="relative text-right text-xs text-white/45">
        Dados reais de {featured!.fixture.home_team_name} x {featured!.fixture.away_team_name}, hoje às {featured!.fixture.local_time}.
      </p>
    </div>
  )
}
