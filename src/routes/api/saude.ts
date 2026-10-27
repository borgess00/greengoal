// Verificação de saúde: resposta leve (sem banco) para monitores como o
// UptimeRobot, que também mantêm acordado o plano gratuito do Render.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/saude')({
  server: {
    handlers: {
      GET: () => new Response('ok', { headers: { 'cache-control': 'no-store' } }),
      HEAD: () => new Response(null, { headers: { 'cache-control': 'no-store' } }),
    },
  },
})
