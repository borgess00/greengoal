// Verificação dos avisos: Discord (webhook de teste) e compatibilidade das
// chaves VAPID geradas no Admin com a biblioteca web-push.
// Uso: npx tsx e2e/notify-check.ts  (com SUPABASE_* e o mock rodando)
import assert from 'node:assert/strict'
import { webcrypto, createECDH, randomBytes } from 'node:crypto'
import * as webpush from 'web-push'
import { generateVapidKeys } from '../src/lib/pwa'
import { emailLayout, runDiscord } from '../src/server/notify.server'
import { spToday } from '../src/lib/grade'
import { supabaseAdmin } from '../src/integrations/supabase/supabase.server'

if (!globalThis.crypto) Object.assign(globalThis, { crypto: webcrypto })
const MOCK = `http://localhost:${process.env.MOCK_PORT ?? 4010}`

// 1) Chaves geradas no navegador funcionam no web-push.
const keys = await generateVapidKeys()
webpush.setVapidDetails('https://example.com', keys.publicKey, keys.privateKey)
const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const b64u = (b: Buffer) => b.toString('base64url')
const details = webpush.generateRequestDetails(
  { endpoint: 'https://push.example.com/abc', keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(randomBytes(16)) } },
  JSON.stringify({ title: 'Teste', body: 'ok', url: '/' }),
)
assert.equal(details.headers['Content-Encoding'], 'aes128gcm')
assert.match(String(details.headers.Authorization), /^vapid t=.+, k=/)
console.log('✓ chaves VAPID do Admin aceitas pelo web-push')

// 2) Layout dos e-mails tem aviso de risco e link para desligar.
const mail = emailLayout('Título <teste>', ['Parágrafo'], { label: 'Abrir', path: '/painel' })
assert.ok(mail.html.includes('Título &lt;teste&gt;'))
assert.ok(mail.html.includes('/perfil?aba=notificacoes') && mail.text.includes('18+'))
console.log('✓ e-mail com aviso 18+ e link para desligar')

// 3) Discord: publica uma vez e não repete.
process.env.DISCORD_WEBHOOK_URL = `${MOCK}/discord`
await supabaseAdmin().from('sync_runs').delete().eq('kind', 'discord')
const before = (await (await fetch(`${MOCK}/__discord`)).json()).length
await runDiscord(spToday(), () => undefined)
const mid = (await (await fetch(`${MOCK}/__discord`)).json()) as Array<{ embeds: Array<{ title: string; footer: { text: string } }> }>
assert.ok(mid.length > before, 'esperava ao menos uma publicação no Discord')
for (const p of mid.slice(before)) assert.match(p.embeds[0].footer.text, /18\+/)
await runDiscord(spToday(), () => undefined)
const after = (await (await fetch(`${MOCK}/__discord`)).json()).length
assert.equal(after, mid.length, 'não deveria repetir a mesma publicação')
console.log(`✓ Discord publicado (${mid.length - before}) sem repetir: ${mid.slice(before).map((p) => p.embeds[0].title).join(' | ')}`)
