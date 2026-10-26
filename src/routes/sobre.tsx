import { createFileRoute, Link } from '@tanstack/react-router'
import { BarChart3, Database, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { RiskNotice } from '@/components/common/risk-notice'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const Route = createFileRoute('/sobre')({
  head: () => seo({ title: 'Sobre o GreenGoal e perguntas frequentes', description: 'O que é o GreenGoal, de onde vêm os dados, como as análises são feitas e respostas para as dúvidas mais comuns.', path: '/sobre' }),
  component: SobrePage,
})

const FAQ = [
  {
    q: 'O GreenGoal garante resultados ou lucro?',
    a: 'Não. O GreenGoal é uma fonte de informação estatística. Números descrevem o que já aconteceu e ajudam a entender uma partida, mas não garantem o que vai acontecer. Apostas envolvem risco de perda financeira.',
  },
  {
    q: 'De onde vêm os dados?',
    a: 'As partidas, placares, estatísticas de equipes e jogadores, confrontos diretos e previsões vêm da API-Football (API-Sports). Os dados ficam armazenados no nosso banco e as páginas consultam esse banco — nunca chamam a API diretamente pelo navegador.',
  },
  {
    q: 'Como as análises são escritas?',
    a: 'Um modelo de inteligência artificial recebe somente os dados coletados da partida e escreve até nove seções (importância do jogo, confrontos, forma, probabilidade, gols, escanteios, cartões, árbitro e finalizações). Ele é instruído a não inventar números; seções sem dados de apoio são removidas antes da publicação.',
  },
  {
    q: 'Por que algumas análises não têm todas as seções?',
    a: 'Porque preferimos omitir a preencher lacunas com suposições. Algumas competições têm menos estatísticas disponíveis. Sobre o árbitro, por exemplo, a fonte informa apenas o nome, não o histórico de cartões.',
  },
  {
    q: 'O que são as probabilidades exibidas?',
    a: 'Os percentuais de vitória, empate e derrota vêm do modelo estatístico da própria API-Football. Quando há odds disponíveis, mostramos também a probabilidade implícita no mercado, sem a margem da casa. São estimativas, não certezas.',
  },
  {
    q: 'O radar de escanteios mostra escanteios nos primeiros 10 minutos?',
    a: 'Não. A fonte atual informa o total de escanteios por partida, sem o minuto de cada um. O radar mostra médias gerais a favor e cedidas, com o tamanho da amostra, e deixa essa limitação explícita.',
  },
  {
    q: 'Como funciona a grade de Tarde e Noite?',
    a: 'Usamos o horário de Brasília. Tarde vai das 08h às 17h59; Noite vai das 18h às 07h59 do dia seguinte. Jogos de madrugada (antes das 08h) pertencem à grade do dia anterior.',
  },
  {
    q: 'Quais planos existem e qual a diferença?',
    a: 'Semanal (R$ 19,90), mensal (R$ 49,90) e anual (R$ 399,90, equivalente a R$ 33,33/mês). Todos liberam os mesmos recursos.',
  },
  {
    q: 'O pagamento já é real?',
    a: 'Ainda não. Nesta versão a contratação funciona em modo demonstração: nenhuma cobrança é feita e o acesso é liberado pelo prazo do plano apenas para testes. O pagamento real dependerá da integração com um provedor de pagamentos.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Em Minha conta › Assinatura você cancela com um clique. O acesso continua até o fim do período já contratado.',
  },
  {
    q: 'Funciona no celular? Funciona sem internet?',
    a: 'O site foi feito para o celular e pode ser adicionado à tela inicial. Ele precisa de internet para carregar jogos e análises — não há modo offline.',
  },
  {
    q: 'Vocês aceitam apostas?',
    a: 'Não. O GreenGoal não é casa de apostas, não recebe apostas e não intermedeia pagamentos de apostas.',
  },
]

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
              Ainda com dúvidas? Escreva para <a href={`mailto:${SITE.contactEmail}`} className="font-semibold text-primary">{SITE.contactEmail}</a>.
            </p>
            <Button asChild>
              <Link to="/planos">Ver planos</Link>
            </Button>
          </div>
        </section>
        <RiskNotice className="mx-auto mt-10 max-w-3xl" />
      </div>
    </>
  )
}
