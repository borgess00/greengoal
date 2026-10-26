/** Traduz mensagens comuns do Supabase Auth para português. */
export function authErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.'
  if (m.includes('password should be at least') || m.includes('weak password')) return 'A senha é fraca. Use pelo menos 8 caracteres, com letras e números.'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.'
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.'
  if (m.includes('network') || m.includes('fetch')) return 'Falha de conexão. Verifique sua internet.'
  if (m.includes('expired') || m.includes('invalid') && m.includes('link')) return 'O link expirou ou é inválido. Solicite um novo.'
  return msg || 'Não foi possível concluir. Tente novamente.'
}

export const PASSWORD_MIN = 8

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use letras e números na senha.'
  return null
}
