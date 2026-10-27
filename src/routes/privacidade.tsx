import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/common/page-header'
import { Prose } from '@/components/common/prose'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const Route = createFileRoute('/privacidade')({
  head: () => seo({ title: 'Política de privacidade', description: 'Quais dados o GreenGoal coleta, para quê, como protege e quais são os seus direitos segundo a LGPD.', path: '/privacidade' }),
  component: () => (
    <>
      <PageHeader eyebrow="Institucional" title="Política de privacidade" description="Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018). Última atualização: outubro de 2026." />
      <div className="container-page py-12">
        <Prose>
          <h2>Dados que coletamos</h2>
          <ul>
            <li><strong>Cadastro:</strong> nome e e-mail; a senha é armazenada de forma criptografada pelo provedor de autenticação.</li>
            <li><strong>Assinatura e pagamento:</strong> plano, datas de início e vencimento, método (cartão ou Pix), status dos pagamentos e CPF/CNPJ do pagador. Os pagamentos são processados pelo Asaas, que recebe nome, e-mail e CPF/CNPJ para emitir as cobranças. Os dados do cartão são digitados na página do Asaas e não passam pelo GreenGoal.</li>
            <li><strong>Uso:</strong> bilhetes que você envia para conferência e os resultados gerados.</li>
            <li><strong>Navegador:</strong> a confirmação de idade e a sessão de login ficam salvas no armazenamento local do seu navegador.</li>
          </ul>
          <h2>Para que usamos</h2>
          <ul>
            <li>Criar e manter sua conta e autenticar o acesso.</li>
            <li>Liberar recursos da assinatura e exibir seu histórico.</li>
            <li>Conferir bilhetes e guardar o histórico das conferências.</li>
            <li>Segurança, prevenção a fraudes e cumprimento de obrigações legais.</li>
          </ul>
          <h2>Compartilhamento</h2>
          <p>
            Usamos provedores de infraestrutura (hospedagem, banco de dados e autenticação). Os dados das partidas vêm da API-Football e as análises são redigidas por um provedor de inteligência
            artificial que recebe apenas dados esportivos — nunca dados pessoais. Não vendemos seus dados.
          </p>
          <h2>Segurança</h2>
          <p>
            O acesso ao banco é controlado por regras de segurança por linha: cada usuário só consegue ler o próprio perfil, assinatura, pagamentos e bilhetes. Chaves privadas ficam apenas em
            segredos do servidor.
          </p>
          <h2>Seus direitos</h2>
          <p>Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados, além de revogar consentimentos. Os bilhetes podem ser excluídos por você a qualquer momento.</p>
          <h2>Retenção</h2>
          <p>Mantemos os dados enquanto a conta estiver ativa ou pelo prazo exigido por lei. Ao excluir a conta, os dados pessoais associados são removidos.</p>
          <h2>Contato do encarregado</h2>
          <p>
            Para exercer seus direitos: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </Prose>
      </div>
    </>
  ),
})
