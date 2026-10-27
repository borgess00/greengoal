import { createFileRoute, Link } from '@tanstack/react-router'
import { BarChart3, Cpu, Database, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
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
    q: 'O que são os bilhetes prontos?',
    a: 'Todos os dias, depois que as análises ficam prontas, a IA monta bilhetes separados por nível de risco (baixo, médio e médio-alto) usando apenas os mercados com mais sustentação nos dados. Quando a fonte informa, cada seleção traz a odd e o bilhete mostra a odd total. A odd muda até o início do jogo e nenhum bilhete tem garantia de resultado.',
  },
  {
    q: 'As análises são atualizadas automaticamente?',
    a: 'Sim. Uma rotina automática busca os jogos do dia, gera as análises das partidas prioritárias e monta os bilhetes prontos, sem ninguém precisar apertar botão.',
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
    q: 'Como os jogos do dia são organizados?',
    a: 'Mostramos todos os jogos da data escolhida, no horário de Brasília, agrupados por país e por competição. Você pode filtrar por país e por liga.',
  },
  {
    q: 'Quais planos existem e qual a diferença?',
    a: 'Semanal (R$ 13,90), mensal (R$ 41,90) e anual (R$ 399,90, equivalente a R$ 33,33/mês). Todos liberam os mesmos recursos.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'Os pagamentos são processados pelo Asaas, por Pix ou cartão, em uma página segura. O acesso é liberado assim que o pagamento é confirmado, e a assinatura renova automaticamente a cada período até você cancelar.',
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
    q: 'Como falo com o suporte?',
    a: 'Pelo nosso servidor no Discord (link no rodapé e no fim desta página) ou pelo e-mail contato.greengoal@gmail.com.',
  },
  {
    q: 'Quem desenvolve o GreenGoal?',
    a: 'O GreenGoal é desenvolvido pela PredyX IAs.',
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

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-secondary/60 p-6 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-dark text-white">
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
