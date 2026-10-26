import { describe, expect, it } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('aceita caminhos internos', () => {
    expect(safeRedirect('/jogo/123?x=1')).toBe('/jogo/123?x=1')
    expect(safeRedirect('/perfil')).toBe('/perfil')
  })
  it('bloqueia destinos externos e laços', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/auth', '/reset-password', 42, undefined]) {
      expect(safeRedirect(bad)).toBe('/')
    }
  })
})
