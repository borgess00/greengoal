import { describe, expect, it } from 'vitest'
import { formatCpfCnpj, isValidCpfCnpj, maskCpfCnpj } from './cpf'

describe('CPF/CNPJ', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true)
    expect(isValidCpfCnpj('52998224724')).toBe(false)
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false)
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCpfCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCpfCnpj('123')).toBe(false)
  })
  it('formata e mascara', () => {
    expect(formatCpfCnpj('52998224725')).toBe('529.982.247-25')
    expect(formatCpfCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(maskCpfCnpj('52998224725')).toBe('***.***.247-25')
  })
})
