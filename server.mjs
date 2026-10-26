// Servidor de produção em Node: arquivos estáticos de dist/client e o
// restante (páginas SSR e funções de servidor) pelo handler do TanStack Start.
// Uso: npm run build && npm start   (porta: variável PORT, padrão 3000)
import { serve } from 'srvx/node'
import { staticMiddleware } from 'srvx/static'
import app from './dist/server/server.js'

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? '0.0.0.0',
  middleware: [staticMiddleware({ dir: new URL('./dist/client', import.meta.url).pathname })],
  fetch: (req) => app.fetch(req),
})
