import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Download, Mail, Share, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { errorMessage } from '@/lib/format'
import { currentPushSubscription, pushSupported, subscribePush, useInstallPrompt } from '@/lib/pwa'
import { getNotifySettings, removePushSubscription, saveNotifyPrefs, savePushSubscription, type NotifyPrefs } from '@/server/notifications.functions'

const PREFS: Array<{ key: keyof NotifyPrefs; label: string; hint: string }> = [
  {
    key: 'bilhetes_prontos',
    label: 'Bilhetes prontos publicados',
    hint: 'Quando os bilhetes do dia ficam prontos (assinantes).',
  },
  {
    key: 'favoritos',
    label: 'Jogos dos times favoritos',
    hint: 'De manhã, quando um time favorito joga no dia.',
  },
  {
    key: 'conferidos',
    label: 'Meus bilhetes conferidos',
    hint: 'Quando um bilhete seu é conferido pelo placar.',
  },
]

export function InstallAppCard() {
  const { installed, canPrompt, ios, promptInstall } = useInstallPrompt()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" /> App no celular
        </CardTitle>
        <CardDescription>Coloque o GreenGoal na tela inicial e abra como um aplicativo, sem baixar nada da loja.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {installed ? (
          <p className="font-semibold text-primary">Você já está usando o app instalado.</p>
        ) : canPrompt ? (
          <Button onClick={() => promptInstall()}>
            <Download /> Instalar app
          </Button>
        ) : ios ? (
          <p className="text-muted-foreground">
            No iPhone: abra no Safari, toque em <Share className="inline size-4" aria-label="Compartilhar" /> <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
          </p>
        ) : (
          <p className="text-muted-foreground">
            No Android (Chrome): menu <strong>⋮</strong> → <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. No computador, use o ícone de instalar na barra de endereço.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function NotificationsTab() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['notify-settings'],
    queryFn: () => getNotifySettings(),
  })
  const [thisDevice, setThisDevice] = React.useState<string | null | undefined>(undefined)
  React.useEffect(() => {
    currentPushSubscription()
      .then((s) => setThisDevice(s?.endpoint ?? null))
      .catch(() => setThisDevice(null))
  }, [])

  const save = useMutation({
    mutationFn: (v: { prefs: NotifyPrefs; emailOptOut: boolean }) => saveNotifyPrefs({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notify-settings'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const toggleDevice = useMutation({
    mutationFn: async (on: boolean) => {
      if (on) {
        if (!q.data?.publicKey) throw new Error('As notificações ainda não foram configuradas no site.')
        const sub = await subscribePush(q.data.publicKey)
        await savePushSubscription({ data: sub })
        setThisDevice(sub.endpoint)
      } else {
        const sub = await currentPushSubscription()
        if (sub) {
          await removePushSubscription({ data: { endpoint: sub.endpoint } })
          await sub.unsubscribe()
        }
        setThisDevice(null)
      }
    },
    onSuccess: (_d, on) => {
      toast.success(on ? 'Notificações ligadas neste aparelho.' : 'Notificações desligadas neste aparelho.')
      qc.invalidateQueries({ queryKey: ['notify-settings'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const d = q.data
  if (!d) return <Skeleton className="h-64 w-full rounded-xl" />
  const deviceOn = !!thisDevice && d.endpoints.includes(thisDevice)
  const supported = pushSupported()

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" /> Notificações no aparelho
          </CardTitle>
          <CardDescription>Avisos no celular ou no computador, mesmo com o site fechado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!d.ready && <p className="text-muted-foreground">{d.message}</p>}
          {!supported ? (
            <p className="text-muted-foreground">Este navegador não aceita notificações. No iPhone, instale o app na tela de início (iOS 16.4 ou mais novo) e abra por ele.</p>
          ) : !d.publicKey ? (
            <p className="text-muted-foreground">As notificações ainda estão sendo configuradas no site. Volte em breve.</p>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span>
                <span className="font-semibold">Receber neste aparelho</span>
                <span className="block text-xs text-muted-foreground">{d.endpoints.length} aparelho(s) ligado(s) na sua conta.</span>
              </span>
              <Switch
                checked={deviceOn}
                disabled={toggleDevice.isPending || thisDevice === undefined || !d.ready}
                onCheckedChange={(v) => toggleDevice.mutate(v)}
                aria-label="Receber notificações neste aparelho"
              />
            </div>
          )}
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quero ser avisado sobre</p>
            {PREFS.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.hint}</span>
                </span>
                <Switch
                  checked={d.prefs[p.key]}
                  disabled={save.isPending || !d.ready}
                  onCheckedChange={(v) =>
                    save.mutate({
                      prefs: { ...d.prefs, [p.key]: v },
                      emailOptOut: d.emailOptOut,
                    })
                  }
                  aria-label={p.label}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5 text-primary" /> E-mails
            </CardTitle>
            <CardDescription>Boas-vindas, aviso de plano perto de vencer e resumo semanal dos seus bilhetes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Receber e-mails do GreenGoal</span>
              <Switch
                checked={!d.emailOptOut}
                disabled={save.isPending || !d.ready}
                onCheckedChange={(v) => save.mutate({ prefs: d.prefs, emailOptOut: !v })}
                aria-label="Receber e-mails do GreenGoal"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">E-mails de pagamento e de segurança da conta continuam chegando.</p>
          </CardContent>
        </Card>
        <InstallAppCard />
      </div>
    </div>
  )
}
