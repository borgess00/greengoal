import * as React from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { PasswordInput } from '@/components/auth/password-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { supabase, supabaseConfigured } from '@/integrations/supabase/client'
import { authErrorMessage, passwordProblem } from '@/lib/auth-errors'
import { safeRedirect } from '@/lib/redirect'
import { seo } from '@/lib/seo'

const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  modo: z.enum(['entrar', 'cadastro', 'recuperar']).optional().catch(undefined),
  confirmado: z.coerce.number().optional().catch(undefined),
})

export const Route = createFileRoute('/auth')({
  validateSearch: searchSchema,
  head: () => seo({ title: 'Entrar ou criar conta', description: 'Entre na sua conta GreenGoal, crie um cadastro ou recupere sua senha.', path: '/auth' }),
  component: AuthPage,
})

function AuthPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const { user, loading } = useAuth()
  const destination = safeRedirect(search.redirect, '/jogos')
  const [tab, setTab] = React.useState<string>(search.modo ?? 'entrar')

  React.useEffect(() => {
    if (!loading && user) router.history.replace(destination)
  }, [loading, user, destination, router])

  React.useEffect(() => {
    if (search.confirmado) toast.success('E-mail confirmado! Você já pode entrar.')
  }, [search.confirmado])

  return (
    <div className="hero-pitch relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="pitch-lines absolute inset-0 opacity-60" aria-hidden />
      <div className="container-page relative grid min-h-[calc(100vh-4rem)] place-items-center py-10">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lift sm:p-8">
          <div className="mb-6 text-center">
            <img src="/logo-sm.png" alt="" width={78} height={60} className="mx-auto h-12 w-auto" />
            <h1 className="mt-2 font-display text-2xl font-bold text-brand-dark">Sua conta GreenGoal</h1>
          </div>
          {!supabaseConfigured && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Autenticação indisponível: o Lovable Cloud ainda não está conectado a este ambiente.</p>
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="cadastro">Cadastrar</TabsTrigger>
              <TabsTrigger value="recuperar">Recuperar</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar">
              <SignInForm onDone={() => router.history.replace(destination)} onForgot={() => setTab('recuperar')} />
            </TabsContent>
            <TabsContent value="cadastro">
              <SignUpForm />
            </TabsContent>
            <TabsContent value="recuperar">
              <RecoverForm />
            </TabsContent>
          </Tabs>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao continuar você declara ter 18 anos ou mais e concorda com os{' '}
            <Link to="/termos" className="underline">
              Termos de uso
            </Link>{' '}
            e a{' '}
            <Link to="/privacidade" className="underline">
              Política de privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

function SignInForm({ onDone, onForgot }: { onDone: () => void; onForgot: () => void }) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pending, setPending] = React.useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (error) return toast.error(authErrorMessage(error))
    toast.success('Bem-vindo de volta!')
    onDone()
  }
  return (
    <form onSubmit={submit} className="mt-2 grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="login-email">E-mail</Label>
        <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Senha</Label>
          <button type="button" onClick={onForgot} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
            Esqueci minha senha
          </button>
        </div>
        <PasswordInput id="login-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function SignUpForm() {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [adult, setAdult] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(password)
    if (problem) return toast.error(problem)
    if (name.trim().length < 2) return toast.error('Informe seu nome.')
    if (!adult) return toast.error('Confirme que você tem 18 anos ou mais.')
    setPending(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth?confirmado=1` },
    })
    setPending(false)
    if (error) return toast.error(authErrorMessage(error))
    if (data.session) {
      toast.success('Conta criada!')
    } else {
      setSentTo(email.trim())
    }
  }

  if (sentTo) {
    return (
      <div className="mt-4 rounded-xl bg-secondary p-5 text-center">
        <MailCheck className="mx-auto mb-2 size-8 text-primary" />
        <p className="font-semibold text-brand-dark">Confirme seu e-mail</p>
        <p className="mt-1 text-sm text-secondary-foreground">
          Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail para ativar sua conta. Não chegou? Confira o spam.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="su-name">Nome</Label>
        <Input id="su-name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="su-email">E-mail</Label>
        <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="su-password">Senha</Label>
        <PasswordInput id="su-password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 size-4 accent-[#16A34A]" />
        Declaro que tenho 18 anos ou mais.
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  )
}

function RecoverForm() {
  const [email, setEmail] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    setPending(false)
    if (error) return toast.error(authErrorMessage(error))
    setSent(true)
  }
  if (sent) {
    return (
      <div className="mt-4 rounded-xl bg-secondary p-5 text-center text-sm text-secondary-foreground">
        <MailCheck className="mx-auto mb-2 size-8 text-primary" />
        Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Abra o link neste mesmo navegador.
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="mt-2 grid gap-4">
      <p className="text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <div className="grid gap-1.5">
        <Label htmlFor="rc-email">E-mail</Label>
        <Input id="rc-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar link'}
      </Button>
    </form>
  )
}
