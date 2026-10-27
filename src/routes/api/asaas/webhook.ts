// Webhook do Asaas: confirma pagamentos e libera/renova o acesso.
// Configure no Asaas a URL https://SEU-SITE/api/asaas/webhook e o mesmo
// token de ASAAS_WEBHOOK_TOKEN (enviado no cabeçalho asaas-access-token).
import { createFileRoute } from '@tanstack/react-router'
import { webhookTokenValid } from '@/server/asaas.server'
import { handleAsaasEvent } from '@/server/billing.server'

export const Route = createFileRoute('/api/asaas/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!webhookTokenValid(request.headers.get('asaas-access-token'))) {
          return new Response('token inválido', { status: 401 })
        }
        let body: { event?: string; payment?: Parameters<typeof handleAsaasEvent>[1] }
        try {
          body = await request.json()
        } catch {
          return new Response('corpo inválido', { status: 400 })
        }
        try {
          const result = await handleAsaasEvent(body.event ?? '', body.payment)
          return Response.json({ received: true, result })
        } catch (e) {
          // Erro temporário (ex.: banco): 500 faz o Asaas reenviar depois.
          console.error('asaas webhook', e)
          return new Response('erro ao processar', { status: 500 })
        }
      },
    },
  },
})
