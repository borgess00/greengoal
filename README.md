# GreenGoal

Desenvolvido pela **PredyX IAs**.

Site de estatísticas e probabilidades de futebol por assinatura, em português do Brasil, **exclusivo para maiores de 18 anos**.
O GreenGoal é fonte de informação estatística — não promete lucro, ganho ou resultado. Apostas envolvem risco.

## Stack

- TanStack Start v1 (React 19, TypeScript), TanStack Router e TanStack Query
- Tailwind CSS v4 + componentes no padrão shadcn/ui (Radix), Lucide e Sonner
- Lovable Cloud (Supabase): autenticação, Postgres com RLS
- Funções de servidor com `createServerFn`
- API-Football (API-Sports) e OpenAI (`gpt-4.1-mini`) chamadas **somente no servidor**

## Estrutura

```
src/
  routes/                 páginas (/, /jogos, /jogo/$id, /planos, /auth, /reset-password,
                          /perfil, /bilhete, /admin, /escanteios, /sobre, /termos,
                          /privacidade, /jogo-responsavel) + 404 e tela de erro
  server/
    football.server.ts    helpers da API-Football (exclusivos do servidor)
    ai.server.ts          geração estruturada com OpenAI (exclusivo do servidor)
    access.server.ts      validação de token, papel e assinatura
    auth-middleware.ts    middlewares requireAuth / requireAdmin / requireSubscriber
    *.functions.ts        createServerFn (partidas, análises, admin, bilhete, planos, escanteios)
  lib/
    grade.ts              dia do calendário no fuso America/Sao_Paulo
    fixture-groups.ts     agrupamento dos jogos por país e competição
    facts.ts              transforma os dados da API em fatos (nunca inventa valores)
    analysis.ts           esquema JSON da IA, poda de seções e filtro de promessas
    tickets.ts            leitura, busca e conferência de bilhetes
    corners.ts            radar de escanteios (médias gerais)
supabase/
  migrations/             esquema, RLS, funções (has_role, has_active_subscription,
                          consume_ai_call, demo_checkout) e campeonatos
  tests/                  testes de RLS e regras de negócio em Postgres
e2e/                      testes de ponta a ponta (Playwright) + mock local das APIs
public/                   logo, ícones 192/512, manifesto, og-image
```

## Variáveis e segredos

| Nome | Onde | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | público | cliente do navegador (preenchidas pelo Lovable Cloud) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **segredo do servidor** | operações privilegiadas após checagem de permissão |
| `API_FOOTBALL_KEY` | **segredo do servidor** | API-Football |
| `OPENAI_API_KEY` | **segredo do servidor** | chave própria do responsável (não usa a IA integrada do Lovable) |
| `OPENAI_MODEL` | opcional | padrão `gpt-4.1-mini` |

Chaves privadas nunca vão para o navegador, para arquivos públicos ou para o repositório (`.env` está no `.gitignore`).
Arquivos `*.server.ts` são bloqueados no bundle do cliente pelo TanStack Start.

## Rodando

```bash
npm install
cp .env.example .env      # preencha as variáveis
npm run dev               # http://localhost:3000
npm test                  # testes unitários (grade, bilhete, redirecionamento)
npm run test:db           # migrações + RLS num Postgres 16 temporário
npm run typecheck
npm run build
```

Aplicar as migrações no Lovable Cloud / Supabase: `supabase db push` (ou cole os arquivos de `supabase/migrations` no editor SQL, em ordem).

## Regras implementadas

- **Aviso 18+** no primeiro acesso (autodeclarado, salvo no navegador). Quem responde “Não” permanece bloqueado.
- **Jogos do dia**: dia do calendário em Brasília (00h00–23h59), sem divisão Tarde/Noite. A página agrupa por país e por competição, com filtros de país e liga.
- **Páginas leem o banco**, nunca a API-Football. Sem partidas salvas, a lista fica vazia (sem jogos fictícios).
- **Análises**: só assinantes ativos ou administradores leem — RLS em `analyses` + checagem no servidor. Não assinantes recebem só o bloqueio; o conteúdo real não é enviado.
- **Limite global de IA**: 50 gerações/dia (dia de São Paulo), controlado atomicamente por `consume_ai_call`. O lote é sequencial e para no teto. Falha na coleta (antes da IA) devolve a cota.
- **Seções sem dados são removidas** após a resposta da IA; frases que prometem resultado são descartadas.
- **Assinatura válida** = `status = 'active'` e `current_period_end` no futuro.

## Ampliações em relação à especificação base

- **Cobertura de campeonatos**: além dos 12 IDs base, a tabela `leagues` traz as competições da lista de 50 com ID conhecido. A sincronização faz 2 chamadas por grade (todas as partidas da data, filtradas pelos campeonatos habilitados), então ampliar a cobertura não aumenta o custo da sincronização. IDs fora da base ficam “não verificados” até o admin usar **Verificar campeonatos**; o admin pode adicionar IDs (ex.: Copinha, outros estaduais).
- **Escanteios**: a coleta agora busca estatísticas por partida dos jogos recentes (escanteios, finalizações, cartões, impedimentos), com cache permanente para partidas encerradas. Com isso a seção **Escanteios** passa a ter dados reais (médias totais por partida). A fonte não informa o minuto de cada escanteio — nada sobre “primeiros 10 minutos” é estimado.
- **Radar de escanteios** (`/escanteios`, assinantes): todas as equipes da grade com amostra, sem limite de 3, com exportação de relatório vertical em PNG (verde e branco).
- **Dados extras da análise**: classificação, desfalques informados, odds com probabilidade implícita sem margem, destaques por mercado com risco (baixo / médio / médio-alto), motivos a favor e contra, alertas.

## Pendências (não declarar como prontas)

- **Pagamento real**: `startCheckout` é DEMONSTRAÇÃO — não cobra, cria assinatura e pagamento `demo`. Pagamento real e renovação automática exigem um provedor (Stripe, Mercado Pago…) com ativação por **webhook verificado**.
- **Agendamento**: sincronização e geração são iniciadas por botões do admin. Não há execução agendada.
- **Offline**: há manifesto e ícones, mas não há service worker nem funcionamento offline.
- **Integrações externas**: o código foi exercitado contra um mock local (`e2e/mock-apis.mjs`); ainda falta validar com jogos reais usando `API_FOOTBALL_KEY` e `OPENAI_API_KEY` reais.
- **E-mail**: confirmar configurações de autenticação e entrega de e-mail no Lovable Cloud (confirmação de cadastro e recuperação de senha).
- **Árbitro**: a fonte traz apenas o nome, não o histórico.
- **Redes sociais e e-mail de contato** do rodapé (`src/lib/site.ts`) precisam ser confirmados com o responsável.
- **Administrador**: `contato.greengoal@gmail.com` recebe o papel `admin` automaticamente ao se cadastrar (gatilho `handle_new_user`); se a conta já existir, a migração concede o papel.
