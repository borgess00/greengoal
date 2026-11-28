// Avisos automáticos: notificações no aparelho (web push), e-mails (Gmail SMTP)
// e resumo no Discord. Roda no fim da automação diária (GitHub Actions).
// Cada aviso é enviado uma vez só (notification_log / sync_runs).
// Exclusivo do servidor.
import { addDays, spParts } from '@/lib/grade'
import { TIER_LABEL, ticketTier, type ReadyTicket } from '@/lib/ready-tickets'
import { settleReadyTicket, summarizeHistory } from '@/lib/ticket-history'
import { FINISHED } from '@/lib/fixture-status'
import { supabaseAdmin } from '@/integrations/supabase/supabase.server'
import { logRun } from './pipeline.server'

export const siteUrl = () => (process.env.SITE_URL || process.env.URL || 'https://greengoalanalises.netlify.app').replace(/\/$/, '')

type Log = (m: string) => void

async function setting(key: string, fallback: boolean) {
  const { data } = await supabaseAdmin().from('app_settings').select('value').eq('key', key).maybeSingle()
  return data?.value == null ? fallback : data.value === true || data.value === 'true'
}

/** Marca o aviso como enviado. false = já tinha sido enviado (ou a tabela não existe). */
async function claim(userId: string, channel: 'email' | 'push', kind: string, ref: string) {
  const { error } = await supabaseAdmin().from('notification_log').insert({ user_id: userId, channel, kind, ref })
  return !error
}
async function unclaim(userId: string, channel: 'email' | 'push', kind: string, ref: string) {
  await supabaseAdmin().from('notification_log').delete().match({ user_id: userId, channel, kind, ref })
}

const hhmm = (iso: string) => {
  const p = spParts(iso)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

// ---------------------------------------------------------------------
// Web push
// ---------------------------------------------------------------------

interface PushMsg {
  title: string
  body: string
  url: string
  tag?: string
}

let webpushReady: typeof import('web-push') | null | undefined
async function webpush() {
  if (webpushReady !== undefined) return webpushReady
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (webpushReady = null)
  const mod = await import('web-push')
  mod.setVapidDetails(process.env.VAPID_SUBJECT || siteUrl(), pub, priv)
  return (webpushReady = mod)
}

async function pushTo(userIds: string[], kind: string, ref: (uid: string) => string, msg: (uid: string) => PushMsg) {
  const wp = await webpush()
  if (!wp || !userIds.length) return 0
  const db = supabaseAdmin()
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', userIds)
  const byUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>()
  for (const s of subs ?? []) byUser.set(s.user_id as string, [...(byUser.get(s.user_id as string) ?? []), s as { endpoint: string; p256dh: string; auth: string }])
  let sent = 0
  for (const [uid, list] of byUser) {
    const r = ref(uid)
    if (!(await claim(uid, 'push', kind, r))) continue
    const payload = JSON.stringify(msg(uid))
    let ok = false
    for (const s of list) {
      try {
        await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 })
        ok = true
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // Inscrição expirada ou removida pelo navegador: apaga.
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
    if (ok) sent++
    else await unclaim(uid, 'push', kind, r)
  }
  return sent
}

type Prefs = {
  bilhetes_prontos?: boolean
  favoritos?: boolean
  conferidos?: boolean
}
async function prefsOf(userIds: string[]) {
  if (!userIds.length) return new Map<string, Prefs>()
  const { data } = await supabaseAdmin().from('profiles').select('id, notify_prefs').in('id', userIds)
  return new Map((data ?? []).map((p) => [p.id as string, (p.notify_prefs as Prefs | null) ?? {}]))
}

async function activeSubscribers() {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin().from('subscriptions').select('user_id').eq('status', 'active').gt('current_period_end', now)
  return [...new Set((data ?? []).map((s) => s.user_id as string))]
}

export async function runPush(date: string, log: Log) {
  if (!(await setting('push_enabled', true))) return log('Notificações: desligadas no Admin.')
  if (!(await webpush())) return log('Notificações: chaves VAPID ausentes (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).')
  const db = supabaseAdmin()
  const { data: withSubs } = await db.from('push_subscriptions').select('user_id')
  const users = [...new Set((withSubs ?? []).map((s) => s.user_id as string))]
  if (!users.length) return log('Notificações: nenhum aparelho inscrito.')
  const prefs = await prefsOf(users)
  const wants = (uid: string, k: keyof Prefs) => prefs.get(uid)?.[k] !== false
  let total = 0

  // 1) Bilhetes prontos do dia publicados (só assinantes).
  const { data: dt } = await db.from('daily_tickets').select('status, content').eq('grade_date', date).maybeSingle()
  const count = ((dt?.content as { bilhetes?: unknown[] } | null)?.bilhetes ?? []).length
  if (dt?.status === 'done' && count) {
    const subs = new Set(await activeSubscribers())
    const target = users.filter((u) => subs.has(u) && wants(u, 'bilhetes_prontos'))
    total += await pushTo(
      target,
      'bilhetes',
      () => date,
      () => ({
        title: 'Bilhetes prontos de hoje',
        body: `${count} bilhete(s) do dia já estão no site, separados por faixa de odd.`,
        url: '/bilhetes-prontos',
        tag: `bilhetes-${date}`,
      }),
    )
  }

  // 2) Times favoritos que jogam hoje (só antes do primeiro jogo deles).
  const { data: favs } = await db.from('favorite_teams').select('user_id, team_id, team_name').in('user_id', users)
  if (favs?.length) {
    const { data: fx } = await db
      .from('fixtures')
      .select('id, kickoff_at, home_team_id, away_team_id, home_team_name, away_team_name, status_short')
      .eq('grade_date', date)
      .eq('status_short', 'NS')
      .gt('kickoff_at', new Date().toISOString())
    const games = new Map<string, Array<{ id: number; text: string }>>()
    for (const f of favs) {
      if (!wants(f.user_id as string, 'favoritos')) continue
      const g = (fx ?? []).find((x) => x.home_team_id === f.team_id || x.away_team_id === f.team_id)
      if (g)
        games.set(f.user_id as string, [
          ...(games.get(f.user_id as string) ?? []),
          {
            id: g.id as number,
            text: `${g.home_team_name} x ${g.away_team_name} às ${hhmm(g.kickoff_at as string)}`,
          },
        ])
    }
    total += await pushTo(
      [...games.keys()],
      'favoritos',
      () => date,
      (uid) => {
        const list = games.get(uid)!
        return {
          title: list.length === 1 ? 'Seu time joga hoje' : `${list.length} times favoritos jogam hoje`,
          body: list.map((g) => g.text).join(' · '),
          url: list.length === 1 ? `/jogo/${list[0].id}` : '/favoritos',
          tag: `fav-${date}`,
        }
      },
    )
  }

  // 3) Meus bilhetes conferidos nas últimas 48 horas.
  const since = new Date(Date.now() - 48 * 3600_000).toISOString()
  const { data: settled } = await db.from('user_slips').select('id, user_id, title, status, odd_total').in('user_id', users).neq('status', 'open').gte('settled_at', since).limit(1000)
  for (const s of settled ?? []) {
    if (!wants(s.user_id as string, 'conferidos')) continue
    const label = s.status === 'won' ? 'deu green ✓' : s.status === 'lost' ? 'não bateu' : 'foi anulado'
    total += await pushTo(
      [s.user_id as string],
      'conferido',
      () => s.id as string,
      () => ({
        title: `Bilhete conferido: ${label}`,
        body: `${(s.title as string) || 'Seu bilhete'}${s.odd_total ? ` · odd ${Number(s.odd_total).toFixed(2).replace('.', ',')}` : ''}`,
        url: '/meus-bilhetes',
        tag: `slip-${s.id}`,
      }),
    )
  }
  log(`Notificações enviadas: ${total}`)
  await logRun('push', 'ok', { message: `${total} notificação(ões) enviada(s)`, sent: total }, null, undefined, date)
}

// ---------------------------------------------------------------------
// E-mails (Gmail SMTP)
// ---------------------------------------------------------------------

type Mailer = {
  send: (to: string, subject: string, html: string, text: string) => Promise<void>
}
async function mailer(): Promise<Mailer | null> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  const nodemailer = (await import('nodemailer')).default
  const t = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass: pass.replace(/\s+/g, '') },
  })
  return {
    send: async (to, subject, html, text) => {
      await t.sendMail({
        from: `GreenGoal <${user}>`,
        to,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<${siteUrl()}/perfil?aba=notificacoes>`,
        },
      })
    },
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function emailLayout(title: string, paragraphs: string[], cta?: { label: string; path: string }) {
  const url = siteUrl()
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`).join('')
  const button = cta
    ? `<p style="margin:22px 0"><a href="${url}${cta.path}" style="background:#16A34A;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p>`
    : ''
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#0b1f17">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#052e22;color:#fff;border-radius:16px 16px 0 0;padding:20px 24px;font-weight:800;font-size:20px">Green<span style="color:#4ade80">Goal</span></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 14px">${esc(title)}</h1>${body}${button}
<p style="margin:24px 0 0;font-size:12px;color:#5b6b63;line-height:1.5">Conteúdo informativo, sem promessa de resultado. Apostas envolvem risco. Somente maiores de 18 anos.<br>
Não quer mais estes e-mails? <a href="${url}/perfil?aba=notificacoes" style="color:#16a34a">Desligue em Minha conta → Notificações</a>.</p>
</div></div></body></html>`
  const text = [
    title,
    '',
    ...paragraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    cta ? `\n${cta.label}: ${url}${cta.path}` : '',
    '',
    'Conteúdo informativo, sem promessa de resultado. 18+.',
    `Desligar e-mails: ${url}/perfil?aba=notificacoes`,
  ].join('\n')
  return { html, text }
}

async function allUsers() {
  const db = supabaseAdmin()
  const out: Array<{
    id: string
    email: string
    created_at: string
    name: string | null
  }> = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) break
    for (const u of data.users)
      if (u.email && u.email_confirmed_at)
        out.push({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          name: (u.user_metadata?.full_name as string | undefined) ?? null,
        })
    if (data.users.length < 1000) break
  }
  return out
}

export async function runEmails(date: string, log: Log) {
  if (!(await setting('emails_enabled', true))) return log('E-mails: desligados no Admin.')
  const m = await mailer()
  if (!m) return log('E-mails: GMAIL_USER / GMAIL_APP_PASSWORD ausentes.')
  const db = supabaseAdmin()
  const users = await allUsers()
  const { data: profiles, error: pe } = await db.from('profiles').select('id, email_opt_out')
  if (pe) return log('E-mails: rode a atualização do banco (coluna email_opt_out).')
  const optOut = new Set((profiles ?? []).filter((p) => p.email_opt_out).map((p) => p.id as string))
  const eligible = users.filter((u) => !optOut.has(u.id))
  const first = (u: { name: string | null }) => (u.name ? esc(u.name.split(' ')[0]) : 'tudo bem')
  let sent = 0
  const send = async (u: (typeof users)[number], kind: string, ref: string, subject: string, mail: { html: string; text: string }) => {
    if (sent >= 400) return // margem abaixo do limite diário do Gmail
    if (!(await claim(u.id, 'email', kind, ref))) return
    try {
      await m.send(u.email, subject, mail.html, mail.text)
      sent++
    } catch (e) {
      await unclaim(u.id, 'email', kind, ref)
      log(`E-mail para um usuário falhou: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 1) Boas-vindas (cadastros dos últimos 3 dias).
  const since3 = new Date(Date.now() - 3 * 86400_000).toISOString()
  for (const u of eligible.filter((x) => x.created_at >= since3)) {
    await send(
      u,
      'boas_vindas',
      '1',
      'Bem-vindo ao GreenGoal',
      emailLayout(
        `Olá, ${first(u)}! Sua conta está pronta.`,
        [
          'No GreenGoal você encontra a grade do dia com forma recente, confrontos diretos, médias de gols, escanteios e cartões, e as análises das partidas.',
          'Dicas para começar: marque seus <strong>times favoritos</strong> (a estrela ao lado do nome), monte e acompanhe seus bilhetes em <strong>Meus bilhetes</strong> — eles são conferidos sozinhos pelo placar — e instale o app na tela do celular.',
        ],
        { label: 'Abrir o painel', path: '/painel' },
      ),
    )
  }

  // 2) Plano perto de vencer (demonstração ou cancelamento agendado).
  const now = new Date()
  const in2 = new Date(now.getTime() + 2 * 86400_000).toISOString()
  const { data: ending } = await db
    .from('subscriptions')
    .select('user_id, provider, cancel_at_period_end, current_period_end')
    .eq('status', 'active')
    .gt('current_period_end', now.toISOString())
    .lte('current_period_end', in2)
  const byId = new Map(eligible.map((u) => [u.id, u]))
  for (const s of ending ?? []) {
    if (s.provider !== 'demo' && !s.cancel_at_period_end) continue
    const u = byId.get(s.user_id as string)
    if (!u) continue
    const end = new Date(s.current_period_end as string).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    await send(
      u,
      'vencendo',
      String(s.current_period_end).slice(0, 10),
      'Seu acesso ao GreenGoal Pro termina em breve',
      emailLayout(
        `${first(u)}, seu acesso Pro vai até ${end}`,
        ['Depois dessa data, as estatísticas completas, os bilhetes prontos do dia e as linhas destacadas do painel ficam bloqueados.', 'Se quiser continuar, é só escolher um plano. Sem fidelidade.'],
        { label: 'Ver planos', path: '/planos' },
      ),
    )
  }

  // 3) Resumo semanal dos bilhetes (segundas-feiras).
  const weekday = new Date(`${date}T12:00:00-03:00`).getUTCDay()
  if (weekday === 1) {
    const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
    const { data: slips } = await db.from('user_slips').select('user_id, status, odd_total, stake_units').neq('status', 'open').gte('settled_at', since7).limit(10000)
    const per = new Map<string, { won: number; lost: number; voided: number; units: number }>()
    for (const s of slips ?? []) {
      const r = per.get(s.user_id as string) ?? {
        won: 0,
        lost: 0,
        voided: 0,
        units: 0,
      }
      const stake = Number(s.stake_units ?? 1)
      if (s.status === 'won') {
        r.won++
        r.units += stake * (Number(s.odd_total ?? 1) - 1)
      } else if (s.status === 'lost') {
        r.lost++
        r.units -= stake
      } else r.voided++
      per.set(s.user_id as string, r)
    }
    for (const [uid, r] of per) {
      const u = byId.get(uid)
      if (!u) continue
      const decided = r.won + r.lost
      const rate = decided ? Math.round((r.won / decided) * 100) : null
      const units = Math.round(r.units * 100) / 100
      await send(
        u,
        'semanal',
        date,
        'Seus bilhetes na semana',
        emailLayout(
          `${first(u)}, seu resumo da semana`,
          [
            `Bilhetes conferidos nos últimos 7 dias: <strong>${decided + r.voided}</strong> — ${r.won} ganho(s), ${r.lost} perdido(s)${r.voided ? `, ${r.voided} anulado(s)` : ''}.`,
            rate != null ? `Taxa de acerto: <strong>${rate}%</strong> · resultado: <strong>${units > 0 ? '+' : ''}${units.toLocaleString('pt-BR')} unidade(s)</strong>.` : '',
            'Lembre-se: resultado passado não garante resultado futuro. Defina limites e jogue com responsabilidade.',
          ].filter(Boolean),
          { label: 'Ver Meus bilhetes', path: '/meus-bilhetes' },
        ),
      )
    }
  }
  log(`E-mails enviados: ${sent}`)
  await logRun('email', 'ok', { message: `${sent} e-mail(s) enviado(s)`, sent }, null, undefined, date)
}

// ---------------------------------------------------------------------
// Discord (webhook do canal)
// ---------------------------------------------------------------------

async function alreadyPosted(ref: string) {
  const { data } = await supabaseAdmin().from('sync_runs').select('id').eq('kind', 'discord').eq('status', 'ok').eq('details->>ref', ref).limit(1)
  return !!data?.length
}

async function postDiscord(content: string, embeds: unknown[]) {
  const url = process.env.DISCORD_WEBHOOK_URL!
  const r = await fetch(`${url}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'GreenGoal',
      content,
      embeds,
      allowed_mentions: { parse: [] },
    }),
  })
  if (!r.ok) throw new Error(`Discord respondeu ${r.status}`)
}

export async function runDiscord(date: string, log: Log) {
  if (!(await setting('discord_enabled', true))) return log('Discord: desligado no Admin.')
  if (!process.env.DISCORD_WEBHOOK_URL) return log('Discord: DISCORD_WEBHOOK_URL ausente.')
  const db = supabaseAdmin()
  const hour = spParts(new Date()).hour
  const url = siteUrl()

  try {
    // Manhã/tarde: grandes jogos do dia + bilhetes prontos.
    if (hour >= 6 && hour < 20 && !(await alreadyPosted(`manha:${date}`))) {
      const [{ data: fx }, { data: leagues }, { data: dt }] = await Promise.all([
        db.from('fixtures').select('id, kickoff_at, league_id, league_name, home_team_name, away_team_name, status_short, hot_markets').eq('grade_date', date).eq('status_short', 'NS'),
        db.from('leagues').select('id, priority'),
        db.from('daily_tickets').select('status, content').eq('grade_date', date).maybeSingle(),
      ])
      const prio = new Map((leagues ?? []).map((l) => [l.id as number, l.priority as number]))
      const big = (fx ?? [])
        .sort((a, b) => (prio.get(a.league_id as number) ?? 999) - (prio.get(b.league_id as number) ?? 999) || Date.parse(a.kickoff_at as string) - Date.parse(b.kickoff_at as string))
        .slice(0, 8)
      if (big.length) {
        const tickets = ((dt?.content as { bilhetes?: ReadyTicket[] } | null)?.bilhetes ?? []).filter(() => dt?.status === 'done')
        const tiers = [...new Set(tickets.map((t) => TIER_LABEL[ticketTier(t)]))]
        const lines = big.map(
          (f) =>
            `\`${hhmm(f.kickoff_at as string)}\` **${f.home_team_name} x ${f.away_team_name}** · ${f.league_name}${(f.hot_markets as number | null) && (f.hot_markets as number) >= 3 ? ' 🔥' : ''}`,
        )
        await postDiscord('', [
          {
            title: `⚽ Grandes jogos de hoje (${date.split('-').reverse().join('/')})`,
            url: `${url}/painel`,
            color: 0x16a34a,
            description: `${lines.join('\n')}\n\n🔥 = jogo com 3 ou mais mercados que bateram em 80%+ dos últimos 5 jogos dos dois times.`,
            fields: tickets.length
              ? [
                  {
                    name: '🎟️ Bilhetes prontos',
                    value: `${tickets.length} bilhete(s) do dia (${tiers.join(', ')}) — para assinantes: ${url}/bilhetes-prontos`,
                  },
                ]
              : [],
            footer: {
              text: 'Estatística não garante resultado. 18+. Jogue com responsabilidade.',
            },
          },
        ])
        await logRun('discord', 'ok', { ref: `manha:${date}`, message: `Grandes jogos de ${date}` }, null, undefined, date)
        log('Discord: grandes jogos publicados.')
      }
    }

    // Resultado dos bilhetes prontos: os de ontem (em qualquer execução) e os
    // de hoje à noite, quando todos os jogos já terminaram.
    const days = [addDays(date, -1), ...(hour >= 20 ? [date] : [])]
    for (const day of days) {
      const ref = `noite:${day}`
      if (!(await alreadyPosted(ref))) {
        const { data: dt } = await db.from('daily_tickets').select('status, content').eq('grade_date', day).maybeSingle()
        const tickets = dt?.status === 'done' ? ((dt.content as { bilhetes?: ReadyTicket[] } | null)?.bilhetes ?? []) : []
        if (tickets.length) {
          const ids = [...new Set(tickets.flatMap((t) => t.selecoes.map((s) => s.fixture_id)))]
          const { data: fx } = await db.from('fixtures').select('id, status_short, goals_home, goals_away, ft_home, ft_away').in('id', ids)
          const map = new Map((fx ?? []).map((f) => [f.id as number, f]))
          const res = tickets.map((t) => settleReadyTicket(t, day, map as never))
          const allDone = res.every((r) => r.status !== 'open')
          const anyFinished = (fx ?? []).some((f) => FINISHED.has(f.status_short as string))
          if (allDone && anyFinished) {
            const s = summarizeHistory(res)
            const icon = {
              won: '✅',
              lost: '❌',
              void: '➖',
              open: '⏳',
              unverifiable: '❔',
            } as const
            await postDiscord('', [
              {
                title: `📊 Como foram os bilhetes prontos (${day.split('-').reverse().join('/')})`,
                url: `${url}/historico`,
                color: 0x064e3b,
                description: `${res.map((r) => `${icon[r.status]} **${r.title}** · ${TIER_LABEL[r.tier]}${r.odd ? ` · odd ${r.odd.toFixed(2).replace('.', ',')}` : ''}`).join('\n')}\n\nNo dia: ${s.won} ganho(s), ${s.lost} perdido(s). Histórico completo, com acertos e erros: ${url}/historico`,
                footer: {
                  text: 'Resultado passado não garante resultado futuro. 18+.',
                },
              },
            ])
            await logRun('discord', 'ok', { ref, message: `Resultado dos bilhetes de ${day}` }, null, undefined, day)
            log('Discord: resultado dos bilhetes publicado.')
          }
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log(`Discord: falhou (${message}).`)
    await logRun('discord', 'error', { message }, null, undefined, date)
  }
}

/** Tudo de uma vez, tolerando falhas (nada aqui pode derrubar a automação). */
export async function runNotifications(date: string, log: Log) {
  for (const [name, fn] of [
    ['Discord', runDiscord],
    ['Notificações', runPush],
    ['E-mails', runEmails],
  ] as const) {
    try {
      await fn(date, log)
    } catch (e) {
      log(`${name}: erro inesperado (${e instanceof Error ? e.message : String(e)}).`)
    }
  }
}
