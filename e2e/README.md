# Testes de ponta a ponta

Rodam contra um Supabase local e um mock das APIs externas (dados fictícios, só para teste).

```bash
npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta
npm run mock:apis   # porta 4010
# .env.local com as chaves do `npx supabase status -o env` e:
#   API_FOOTBALL_BASE_URL=http://localhost:4010/football
#   OPENAI_BASE_URL=http://localhost:4010/openai/v1
#   API_FOOTBALL_KEY=teste-local  OPENAI_API_KEY=teste-local
npm run dev
# em outro terminal, com as mesmas variáveis exportadas:
npm run test:e2e
```

Cobrem: aviso 18+, 404, papel admin automático, busca dos jogos do dia (dia do calendário e filtro de ligas),
geração de análise (poda de seções e de promessas), bloqueio para visitante e não assinante
(inclusive leitura direta via RLS), assinatura demo, bilhete, cancelamento, vencimento,
teto diário de IA no lote, radar de escanteios e layout no celular.
