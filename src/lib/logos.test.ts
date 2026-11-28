import { describe, expect, it } from 'vitest'
import { cachedLogoUrl, logoPath } from './logos'

describe('logos guardados', () => {
  it('reconhece escudos e logos da fonte', () => {
    expect(logoPath('https://media.api-sports.io/football/teams/127.png')).toBe('teams/127.png')
    expect(logoPath('https://media.api-sports.io/football/leagues/71.png')).toBe('leagues/71.png')
    expect(logoPath('https://exemplo.com/foto.jpg')).toBeNull()
    expect(logoPath(null)).toBeNull()
  })
  it('monta a URL pública do bucket', () => {
    expect(cachedLogoUrl('https://media.api-sports.io/football/teams/1.png', 'https://abc.supabase.co/')).toBe('https://abc.supabase.co/storage/v1/object/public/logos/teams/1.png')
    expect(cachedLogoUrl('https://media.api-sports.io/football/teams/1.png', undefined)).toBeNull()
  })
})
