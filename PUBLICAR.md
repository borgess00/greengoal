# Como publicar o GreenGoal

Você precisa de duas coisas: um **banco Supabase** (ou o Lovable Cloud, que é Supabase) e uma **hospedagem que rode Node.js 22**.

## 1. Banco de dados (Supabase / Lovable Cloud)

1. Crie um projeto em https://supabase.com (ou use o banco do seu projeto Lovable Cloud).
2. Abra **SQL Editor** e execute, nesta ordem, o conteúdo dos arquivos:
   - `supabase/migrations/20261026120000_core_schema.sql`
   - `supabase/migrations/20261026120100_seed_leagues.sql`
   - `supabase/migrations/20261027120000_precos_e_dia_calendario.sql`
3. Em **Authentication › URL Configuration**:
   - *Site URL*: o endereço final do site (ex.: `https://greengoal.com.br`)
   - *Redirect URLs*: `https://SEU-DOMINIO/auth` e `https://SEU-DOMINIO/reset-password`
4. Em **Authentication › Providers › Email**, deixe a confirmação de e-mail ligada. Para enviar e-mails em volume, configure um SMTP próprio em **Authentication › SMTP** (o envio padrão do Supabase é limitado).
5. Em **Project Settings › API**, copie: *Project URL*, a chave *anon/publishable* e a chave *service_role* (secreta).

## 2a. Hospedagem no Netlify (recomendado)

> **Não use "arrastar arquivos" (Dropped files / Netlify Drop).** Isso só envia arquivos estáticos e o site responde "Page not found": ele precisa do build e das funções de servidor.

1. No Netlify: **Add new project › Import an existing project › GitHub** › escolha `borgess00/greengoal`.
2. As configurações vêm do `netlify.toml` (build `npm run build`, pasta `dist/client`, Node 22) — não precisa mudar nada.
3. Antes do primeiro deploy, em **Project configuration › Environment variables**, cadastre as variáveis da tabela abaixo.
4. Clique em **Deploy**. Depois, em **Domain management**, adicione seu domínio, se tiver.
5. Atualize o *Site URL* e as *Redirect URLs* do Supabase com o endereço `https://SEU-SITE.netlify.app`.

## 2b. Outra hospedagem (exemplo: Render — funciona igual no Railway ou num servidor próprio)

1. Envie o código para um repositório no GitHub (descompacte o .zip e faça o push).
2. No Render: **New › Web Service** › escolha o repositório.
   - Runtime: Node · Versão: 22
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
3. Em **Environment**, cadastre:

| Variável | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave anon/publishable |
| `VITE_SITE_URL` | endereço final do site |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (**secreta**) |
| `API_FOOTBALL_KEY` | sua chave da API-Football (**secreta**) |
| `OPENAI_API_KEY` | sua chave da OpenAI (**secreta**) |

   As variáveis `VITE_` entram no build: depois de mudá-las, faça um novo deploy.
4. Aponte seu domínio para o serviço (Settings › Custom Domains).

> Não cadastre `API_FOOTBALL_BASE_URL` nem `OPENAI_BASE_URL` em produção — servem só para os testes locais.

## 3. Primeiro acesso

1. Abra o site e **cadastre-se com `contato.greengoal@gmail.com`**: essa conta recebe o papel de administrador automaticamente.
2. Em **Admin › Campeonatos**, clique em **Verificar campeonatos pendentes**.
3. Em **Admin › Grade e análises**, clique em **Buscar jogos do dia** e depois em **Gerar análises do dia**.

## Usando o Lovable

Se você já tem um projeto no Lovable conectado ao GitHub, envie este código para o repositório desse projeto: o Lovable sincroniza a partir do GitHub. Cadastre `API_FOOTBALL_KEY`, `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` como segredos do projeto, e execute as migrações no banco do Lovable Cloud (passo 1).

## Lembretes

- O pagamento é **demonstração**: ninguém é cobrado. Para cobrar de verdade é preciso integrar um provedor (Stripe, Mercado Pago) com webhook.
- Não há tarefas agendadas: buscar jogos e gerar análises são botões do painel admin.
