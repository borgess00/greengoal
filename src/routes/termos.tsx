import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/common/page-header'
import { Prose } from '@/components/common/prose'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const Route = createFileRoute('/termos')({
  head: () => seo({ title: 'Termos de uso', description: 'Condições de uso do GreenGoal: público 18+, natureza informativa do conteúdo, assinaturas e responsabilidades.', path: '/termos' }),
  component: () => (
    <>
      <PageHeader eyebrow="Institucional" title="Termos de uso" description="Última atualização: outubro de 2026." />
      <div className="container-page py-12">
        <Prose>
          <p>Ao acessar ou usar o GreenGoal você concorda com estes termos. Se não concordar, não utilize o serviço.</p>
          <h2>1. Público</h2>
          <p>O GreenGoal é destinado exclusivamente a pessoas com <strong>18 anos ou mais</strong>. A confirmação de idade feita no primeiro acesso é autodeclarada. Ao usar o site você declara cumprir esse requisito.</p>
          <h2>2. Natureza do serviço</h2>
          <ul>
            <li>O GreenGoal oferece informações estatísticas e análises sobre partidas de futebol.</li>
            <li>O conteúdo é <strong>informativo</strong> e não constitui recomendação, aconselhamento financeiro ou promessa de resultado, lucro ou ganho.</li>
            <li>O GreenGoal não é casa de apostas, não recebe apostas e não intermedeia valores de apostas.</li>
            <li>Apostas envolvem risco de perda financeira. Decisões tomadas a partir do conteúdo são de responsabilidade exclusiva do usuário.</li>
          </ul>
          <h2>3. Dados e análises</h2>
          <p>
            Os dados são obtidos de fornecedores terceiros (API-Football) e podem conter atrasos, falhas ou ausências. As análises são redigidas com apoio de inteligência artificial a partir
            desses dados e podem conter imprecisões. Seções sem dados de apoio são omitidas.
          </p>
          <h2>4. Conta</h2>
          <p>Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta. Informe-nos imediatamente sobre qualquer uso não autorizado.</p>
          <h2>5. Assinaturas</h2>
          <ul>
            <li>Planos disponíveis: semanal, mensal e anual, com os mesmos recursos.</li>
            <li>
              Os pagamentos são processados pelo <strong>Asaas</strong>, por Pix ou cartão. A assinatura <strong>renova automaticamente</strong> ao fim de cada período, pelo mesmo valor, até
              ser cancelada. Os valores e o período aparecem antes da confirmação.
            </li>
            <li>O acesso é liberado após a confirmação do pagamento. Estornos e contestações encerram o acesso.</li>
            <li>Enquanto o pagamento não estiver ativado no site, a contratação funciona em modo demonstração, sem cobrança, e isso é avisado na tela de contratação.</li>
            <li>O cancelamento interrompe a renovação e mantém o acesso até o fim do período vigente.</li>
          </ul>
          <h2>6. Uso aceitável</h2>
          <p>É proibido copiar, revender ou redistribuir o conteúdo em massa, tentar burlar controles de acesso, automatizar coletas ou usar o serviço para fins ilícitos.</p>
          <h2>7. Limitação de responsabilidade</h2>
          <p>Na extensão permitida pela lei, o GreenGoal não se responsabiliza por perdas decorrentes do uso das informações, de indisponibilidades ou de erros nos dados de terceiros.</p>
          <h2>8. Alterações</h2>
          <p>Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas no site.</p>
          <h2>9. Contato</h2>
          <p>
            Dúvidas: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Veja também a <Link to="/privacidade">Política de privacidade</Link> e as orientações de{' '}
            <Link to="/jogo-responsavel">Jogo responsável</Link>.
          </p>
        </Prose>
      </div>
    </>
  ),
})
