import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { PasswordInput } from '@/components/auth/password-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { authErrorMessage, passwordProblem } from '@/lib/auth-errors'
import { seo } from '@/lib/seo'

export const Route = createFileRoute('/reset-password')({
  ssr: false,
  head: () => seo({ title: 'Redefinir senha', description: 'Crie uma nova senha para sua conta GreenGoal.', path: '/reset-password', noindex: true }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = React.useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady('ok')
    })
    // O link de recuperação gera uma sessão temporária ao abrir a página.
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      setReady(data.session ? 'ok' : 'invalid')
    }, 1200)
    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(password)
    if (problem) return toast.error(problem)
    if (password !== confirm) return toast.error('As senhas não conferem.')
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) return toast.error(authErrorMessage(error))
    toast.success('Senha alterada com sucesso.')
    navigate({ to: '/perfil' })
  }

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-lift">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
            <KeyRound className="size-5" />
          </span>
          <h1 className="font-display text-2xl font-bold text-brand-dark">Redefinir senha</h1>
        </div>
        {ready === 'checking' ? (
          <p className="text-sm text-muted-foreground">Validando o link…</p>
        ) : ready === 'invalid' ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">O link de recuperação é inválido ou expirou. Solicite um novo e abra-o neste mesmo navegador.</p>
            <Button asChild>
              <Link to="/auth" search={{ modo: 'recuperar' }}>
                Solicitar novo link
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="np">Nova senha</Label>
              <PasswordInput id="np" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np2">Confirmar nova senha</Label>
              <PasswordInput id="np2" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
