import { describe, expect, it } from 'vitest'
import { AI_RESPONSE_SCHEMA, pruneSections, sanitizeAi, scrubPromises, toAnthropicSchema, type AiAnalysis } from './analysis'

describe('análise', () => {
  it('esquema do Claude não usa type em lista', () => {
    const s = JSON.stringify(toAnthropicSchema(AI_RESPONSE_SCHEMA))
    expect(s).not.toContain('"type":["')
    expect(s).toContain('"anyOf":[{"type":"string"},{"type":"null"}]')
  })
  it('remove promessas e seções sem dados', () => {
    expect(scrubPromises('Boa fase. Lucro garantido aqui.')).toBe('Boa fase.')
    const ai = {
      secoes: { importancia: 'a', confrontos: 'b', forma: null, probabilidade: null, gols: 'c', escanteios: 'd', cartoes: null, arbitro: null, finalizacoes: null },
      destaques: [],
      alertas: [],
      resumo: null,
      confianca_dados: 'media',
    } as AiAnalysis
    const support = { importancia: true, confrontos: false, forma: true, probabilidade: true, gols: true, escanteios: false, cartoes: true, arbitro: true, finalizacoes: true }
    const { secoes, removed } = pruneSections(sanitizeAi(ai), support)
    expect(secoes.confrontos).toBeNull()
    expect(secoes.escanteios).toBeNull()
    expect(removed).toEqual(['confrontos', 'escanteios'])
  })
})
