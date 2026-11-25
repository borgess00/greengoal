import { createFileRoute, Link } from '@tanstack/react-router'
import { BarChart3, Cpu, Database, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'
import { FAQ } from '@/lib/faq'

export const Route = createFileRoute('/sobre')({
  head: () => seo({ title: 'Sobre o GreenGoal e perguntas frequentes', description: 'O que é o GreenGoal, de onde vêm os dados, como as análises são feitas e respostas para as dúvidas mais comuns.', path: '/sobre' }),
  component: SobrePage,
})


function SobrePage() {
  return (
    <>
      <PageHeader eyebrow="Sobre" title="Futebol explicado em números" description="O GreenGoal organiza dados de partidas para você entender cada jogo com mais clareza — sem promessas." />
      <div className="container-page py-12">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Database, t: 'Dados reais', d: 'Partidas, estatísticas e retrospectos de uma fonte especializada, armazenados e organizados para consulta rápida.' },
            { icon: Sparkles, t: 'Análise objetiva', d: 'Textos curtos, por tema, baseados apenas nos números disponíveis. Sem dados, sem seção.' },
            { icon: ShieldCheck, t: 'Responsabilidade', d: 'Conteúdo 18+, avisos de risco em todas as páginas e nenhuma promessa de resultado.' },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border bg-card p-6 shadow-soft">
              <c.icon className="mb-3 size-7 text-primary" />
              <h2 className="font-display text-lg font-semibold text-brand-dark">{c.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-secondary/60 p-6 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-deep text-white">
            <Cpu className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-dark">Desenvolvido pela {SITE.developer}</h2>
            <p className="text-sm text-secondary-foreground">O GreenGoal é desenvolvido pela {SITE.developer}, responsável pela tecnologia, pelos dados e pelas análises com inteligência artificial da plataforma.</p>
          </div>
        </div>

        <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq">
          <h2 id="faq" className="mb-4 flex items-center gap-2 font-display text-3xl font-bold text-brand-dark">
            <BarChart3 className="size-7 text-primary" /> Perguntas frequentes
          </h2>
          <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5 shadow-soft">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`q${i}`}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-secondary-foreground">
              Ainda com dúvidas? Fale com o suporte no nosso Discord ou escreva para{' '}
              <a href={`mailto:${SITE.contactEmail}`} className="font-semibold text-primary">
                {SITE.contactEmail}
              </a>
              .
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild className="bg-[#5865F2] shadow-none hover:bg-[#4752c4]">
                <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Discord de suporte
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/planos">Ver planos</Link>
              </Button>
            </div>
          </div>
        </section>
        <RiskNotice className="mx-auto mt-10 max-w-3xl" />
      </div>
    </>
  )
}
