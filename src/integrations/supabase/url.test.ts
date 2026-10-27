import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from './url'

describe('normalizeSupabaseUrl', () => {
  it('limpa caminhos e barras extras', () => {
    for (const v of ['https://abc.supabase.co', 'https://abc.supabase.co/', 'https://abc.supabase.co/rest/v1/', ' https://abc.supabase.co/rest/v1 ', 'abc.supabase.co', '"https://abc.supabase.co"']) {
      expect(normalizeSupabaseUrl(v)).toBe('https://abc.supabase.co')
    }
    expect(normalizeSupabaseUrl('http://127.0.0.1:54321/')).toBe('http://127.0.0.1:54321')
    expect(normalizeSupabaseUrl('')).toBeUndefined()
  })
})
