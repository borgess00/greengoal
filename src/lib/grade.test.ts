import { describe, expect, it } from 'vitest'
import { addDays, currentGradeDate, gradeDateFor, isValidDate, spParts } from './grade'

describe('jogos do dia (America/Sao_Paulo)', () => {
  it('converte para o horário de Brasília', () => {
    expect(spParts('2026-10-26T22:30:00Z')).toMatchObject({ date: '2026-10-26', time: '19:30' })
  })
  it('o dia é o do calendário em Brasília, sem divisão por período', () => {
    expect(gradeDateFor('2026-10-27T03:00:00Z')).toBe('2026-10-27') // 00:00 do dia 27
    expect(gradeDateFor('2026-10-27T02:59:00Z')).toBe('2026-10-26') // 23:59 do dia 26
    expect(gradeDateFor('2026-10-27T10:59:00Z')).toBe('2026-10-27') // 07:59 do dia 27
  })
  it('hoje é a data atual em Brasília', () => {
    expect(currentGradeDate(new Date('2026-10-27T05:00:00Z'))).toBe('2026-10-27')
  })
  it('utilitários de data', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('2026-02-28')).toBe(true)
  })
})
