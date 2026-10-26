import { describe, expect, it } from 'vitest'
import { addDays, currentGradeDate, gradeDateFor, isValidDate, periodFor, spParts } from './grade'

describe('grade diária (America/Sao_Paulo)', () => {
  it('converte para o horário de São Paulo', () => {
    expect(spParts('2026-10-26T22:30:00Z')).toMatchObject({ date: '2026-10-26', time: '19:30' })
  })
  it('08h00 até 17h59 é Tarde', () => {
    expect(periodFor('2026-10-26T11:00:00Z')).toBe('tarde') // 08:00
    expect(periodFor('2026-10-26T20:59:00Z')).toBe('tarde') // 17:59
  })
  it('18h00 até 07h59 é Noite', () => {
    expect(periodFor('2026-10-26T21:00:00Z')).toBe('noite') // 18:00
    expect(periodFor('2026-10-27T07:00:00Z')).toBe('noite') // 04:00
    expect(periodFor('2026-10-27T10:59:00Z')).toBe('noite') // 07:59
  })
  it('jogos antes das 08h pertencem à grade do dia anterior', () => {
    expect(gradeDateFor('2026-10-27T10:59:00Z')).toBe('2026-10-26') // 07:59 do dia 27
    expect(gradeDateFor('2026-10-27T11:00:00Z')).toBe('2026-10-27') // 08:00 do dia 27
  })
  it('grade vigente de madrugada é a de ontem', () => {
    expect(currentGradeDate(new Date('2026-10-27T05:00:00Z'))).toBe('2026-10-26')
  })
  it('utilitários de data', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-02-28')).toBe(true)
  })
})
