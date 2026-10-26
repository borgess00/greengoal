import { createFileRoute } from '@tanstack/react-router'
import { HeartHandshake } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { Prose } from '@/components/common/prose'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const Route = createFileRoute('/jogo-responsavel')({
  head: () => seo({ title: 'Jogo responsável', description: 'Orientações para apostar com responsabilidade, sinais de alerta e onde buscar ajuda.', path: '/jogo-responsavel' }),
  component: () => (
    <>
      <PageHeader eyebrow="Cuidado" title="Jogo responsável" description="Estatística ajuda a entender o jogo. Ela não elimina o risco." />
      <div className="container-page py-12">
        <Prose>
          <p>
            O GreenGoal é <strong>exclusivo para maiores de 18 anos</strong> e não promete resultados. Se você aposta, estas orientações ajudam a manter a atividade sob controle.
          </p>
          <h2>Boas práticas</h2>
          <ul>
            <li>Aposte apenas dinheiro que você pode perder sem afetar contas, alimentação, moradia ou dívidas.</li>
            <li>Defina antes um limite de valor e de tempo — e respeite-o.</li>
            <li>Nunca tente recuperar perdas aumentando apostas.</li>
            <li>Não aposte sob efeito de álcool, estresse ou emoções fortes.</li>
            <li>Lembre que probabilidade alta não é certeza: eventos prováveis também falham.</li>
            <li>Mantenha outras atividades de lazer; apostas não são fonte de renda.</li>
          </ul>
          <h2>Sinais de alerta</h2>
          <ul>
            <li>Gastar mais do que planejou com frequência.</li>
            <li>Esconder apostas de familiares ou pedir dinheiro emprestado para apostar.</li>
            <li>Sentir ansiedade ou irritação quando não está apostando.</li>
            <li>Deixar de lado trabalho, estudos ou relações por causa das apostas.</li>
          </ul>
          <h2>Ferramentas de controle</h2>
          <p>
            Casas de apostas autorizadas no Brasil devem oferecer limites de depósito, pausas e autoexclusão. Use esses recursos. Bancos também permitem bloquear pagamentos para sites de apostas.
          </p>
          <h2>Onde buscar ajuda</h2>
          <div className="not-prose grid gap-3 sm:grid-cols-2">
            {SITE.helpLines.map((h) => (
              <a key={h.name} href={h.href} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-xl border bg-card p-4 !no-underline shadow-soft hover:border-primary">
                <HeartHandshake className="size-6 shrink-0 text-primary" />
                <span>
                  <span className="block font-semibold text-brand-dark">{h.name}</span>
                  <span className="block text-sm font-normal text-muted-foreground">{h.detail}</span>
                </span>
              </a>
            ))}
          </div>
          <p>Os Centros de Atenção Psicossocial (CAPS) do SUS também oferecem atendimento gratuito para dependência de jogos.</p>
        </Prose>
      </div>
    </>
  ),
})
