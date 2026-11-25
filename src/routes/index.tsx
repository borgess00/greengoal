import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarDays, Layers, Search, Sparkles, Star } from 'lucide-react'
import { PricingPlans } from '@/components/billing/pricing-plans'
import { EmptyState } from '@/components/common/empty-state'
import { TeamCrest } from '@/components/common/team-crest'
import { FixtureCard, FixtureCardSkeleton } from '@/components/fixtures/fixture-card'
import { FeaturedMatchCard } from '@/components/stats/featured-match'
import { FormBadges } from '@/components/stats/form-badges'
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
        <div className="container-page relative grid items-center gap-10 pt-12 pb-16 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20 lg:pb-28">
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
          <figure className="relative mx-auto w-full max-w-[540px]">
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

      {/* ---------------- Ângulos ---------------- */}
      <section className="container-page relative pt-6 pb-20 text-center">
        <p className="text-sm font-semibold text-white/60">A gente faz a pesquisa por você</p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-5xl">Cada mercado, testado por vários ângulos</h2>
        <p className="mx-auto mt-4 max-w-2xl text-white/65 sm:text-lg">
          Olhamos cada time nos últimos 10 e 5 jogos, no mesmo mando, na mesma competição e no confronto direto. Você vê em quantos jogos o mercado aconteceu e percebe se é um padrão ou só uma fase.
        </p>
        <AnglesShowcase featured={featured.data ?? null} />
      </section>

      {/* ---------------- Jogos de hoje ---------------- */}
      <section className="container-page pb-20">
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

      {featured.data && (
        <section className="container-page pb-24 text-foreground">
          <FeaturedMatchCard data={featured.data} />
        </section>
      )}

      {/* ---------------- O que você recebe ---------------- */}
      <section className="container-page pb-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-5xl">O que você recebe?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65 sm:text-lg">Os números por trás de cada jogo, os recortes que mudam a leitura e tudo organizado no celular.</p>
        </div>
        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2">
          <PhonePreview featured={featured.data ?? null} />
          <ul className="space-y-8">
            {[
              { icon: BarChart3, title: 'Estatísticas que fazem a diferença', text: 'Últimos 5 e 10 jogos de cada time: gols, finalizações, escanteios, cartões e posse, com gráficos, radar comparativo e leitura da partida.' },
              { icon: Layers, title: 'Mercados por ângulo', text: 'Mais de 1,5 gols, ambos marcam, escanteios, cartões… cada mercado com a frequência geral, em casa ou fora, na competição e no confronto direto.' },
              { icon: Sparkles, title: 'Análises e bilhetes prontos', text: 'Análises escritas a partir dos dados reais da partida e bilhetes do dia em quatro faixas: odd baixa, média, alta e altíssima, com odds quando a fonte informa.' },
              { icon: Star, title: 'Meus bilhetes e favoritos', text: 'Monte seus bilhetes no site e acompanhe sozinho se bateram, com taxa de acerto e resultado em unidades. Siga seus times e busque qualquer jogo.' },
            ].map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand-light/30 bg-brand-light/10 text-brand-light">
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
      <section className="container-page pb-24">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-5xl">Perguntas frequentes</h2>
          <p className="mt-3 text-white/65 sm:text-lg">O que você precisa saber antes de começar.</p>
        </div>
        <Accordion type="single" collapsible defaultValue="0" className="mx-auto max-w-3xl space-y-3">
          {HOME_FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={String(i)} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 last:border-b">
              <AccordionTrigger className="text-base text-white hover:text-brand-light [&>svg]:text-white/60">{f.q}</AccordionTrigger>
              <AccordionContent className="text-white/65">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-center text-sm">
          <Link to="/sobre" className="font-semibold text-brand-light hover:underline">
            Ver todas as perguntas
          </Link>
        </p>
      </section>

      {/* ---------------- Chamada final ---------------- */}
      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-light via-[#22c55e] to-[#15803d] px-6 py-12 text-ink sm:px-12">
          <img src="/logo.png" alt="" width={520} height={399} className="pointer-events-none absolute -right-10 -bottom-10 hidden w-[380px] opacity-90 drop-shadow-2xl md:block" />
          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl leading-tight font-bold sm:text-5xl">Os jogos de hoje já estão esperando</h2>
            <p className="mt-4 text-lg text-ink/80">Veja a grade do dia, a forma dos times e os números de cada partida. Assine o Pro quando quiser liberar tudo.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-ink text-white hover:bg-ink/85">
                <Link to="/jogos">
                  <CalendarDays /> Ver jogos de hoje
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ink/40 bg-transparent text-ink hover:bg-ink/10 hover:text-ink">
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
  const notes = ['Veja em quantos jogos o mercado aconteceu', 'Compare casa, fora, competição e confronto direto', 'Os mais consistentes aparecem primeiro', 'Frequência do passado — não é previsão']
  const markets = featured?.markets ?? []
  const logoOf = (side: 'home' | 'away') => (side === 'home' ? featured?.fixture.home_team_logo : featured?.fixture.away_team_logo)
  return (
    <div className="relative mx-auto mt-12 grid max-w-5xl items-center gap-6 lg:grid-cols-[1fr_1.6fr_1fr]">
      <ul className="hidden space-y-6 lg:block">
        {notes.slice(0, 2).map((n) => (
          <li key={n} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-white/75">
            {n}
          </li>
        ))}
      </ul>
      {markets.length ? (
        <div className="relative space-y-4">
          <div className="absolute inset-6 rounded-full bg-brand-light/20 blur-3xl" aria-hidden />
          {markets.map((m, i) => (
            <div key={m.key} className={i === 1 ? 'relative lg:translate-x-8' : 'relative lg:-translate-x-4'}>
              <MarketAngleCard m={m} tone="dark" defaultOpen={i === 0} logo={<TeamCrest name={m.team} logo={logoOf(m.side)} size={32} />} />
            </div>
          ))}
          <p className="relative text-xs text-white/45">
            Dados reais de {featured!.fixture.home_team_name} x {featured!.fixture.away_team_name}, hoje às {featured!.fixture.local_time}.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left text-white/75">
          <p className="font-display text-lg font-bold text-white">Exemplo de leitura</p>
          <p className="mt-2">
            <strong className="text-brand-light">7/10</strong> nos últimos 10 jogos · <strong className="text-brand-light">4/5</strong> jogando em casa ·{' '}
            <strong className="text-brand-light">3/3</strong> no confronto direto
          </p>
          <p className="mt-3 text-xs text-white/45">Os mercados reais aparecem aqui quando as estatísticas do dia forem coletadas.</p>
        </div>
      )}
      <ul className="hidden space-y-6 lg:block">
        {notes.slice(2).map((n) => (
          <li key={n} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-white/75">
            {n}
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap justify-center gap-2 lg:hidden">
        {notes.map((n) => (
          <li key={n} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70">
            {n}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Moldura de celular com cartões reais do destaque do dia (ou a imagem do app). */
function PhonePreview({ featured }: { featured: FeaturedMatch | null }) {
  if (!featured) {
    return <img src="/celulares-app-640.webp" alt="" width={533} height={598} className="mx-auto w-full max-w-sm drop-shadow-2xl" loading="lazy" />
  }
  const f = featured.fixture
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="absolute -inset-8 rounded-[3rem] bg-brand-light/25 blur-3xl" aria-hidden />
      <div className="relative rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02] p-2.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
        <div className="overflow-hidden rounded-[2.1rem] border border-white/10 bg-ink-2 px-4 pt-4 pb-6">
          <div className="mx-auto mb-4 h-6 w-28 rounded-full bg-black" aria-hidden />
          <p className="text-xs text-white/50">{f.league_name} · hoje {f.local_time}</p>
          <p className="mt-1 font-display text-lg font-bold">
            {f.home_team_name} x {f.away_team_name}
          </p>
          <div className="mt-4 space-y-2">
            {[
              { name: f.home_team_name, logo: f.home_team_logo, form: featured.form.home },
              { name: f.away_team_name, logo: f.away_team_logo, form: featured.form.away },
            ].map((t) => (
              <div key={t.name} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <TeamCrest name={t.name} logo={t.logo} size={20} />
                  <span className="truncate">{t.name}</span>
                </span>
                <FormBadges form={t.form} size="sm" />
              </div>
            ))}
          </div>
          {featured.markets[0] && (
            <div className="mt-4">
              <MarketAngleCard m={featured.markets[0]} tone="dark" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
