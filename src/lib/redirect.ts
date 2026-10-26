/** Aceita apenas destinos internos (evita redirecionamento aberto). */
export function safeRedirect(target: unknown, fallback = '/'): string {
  if (typeof target !== 'string') return fallback
  const t = target.trim()
  if (!t.startsWith('/') || t.startsWith('//') || t.startsWith('/\\') || /[\r\n]/.test(t)) return fallback
  if (/^\/(auth|reset-password)(\/|\?|$)/.test(t)) return fallback
  try {
    const u = new URL(t, 'https://example.invalid')
    if (u.origin !== 'https://example.invalid') return fallback
    return u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
}
