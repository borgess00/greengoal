import { describe, expect, it } from 'vitest'
import { matchEvents, statGroups } from './match-result'

describe('resultado da partida', () => {
  it('agrupa e traduz as estatísticas finais; nulo vira zero só em contagens', () => {
    const g = statGroups(
      [
        { team: { id: 1, name: 'A' }, statistics: [{ type: 'Total Shots', value: 15 }, { type: 'Corner Kicks', value: null }, { type: 'Ball Possession', value: '58%' }, { type: 'expected_goals', value: null }] },
        { team: { id: 2, name: 'B' }, statistics: [{ type: 'Total Shots', value: 12 }, { type: 'Corner Kicks', value: 4 }, { type: 'Ball Possession', value: '42%' }, { type: 'expected_goals', value: null }] },
      ],
      1,
      2,
    )
    expect(g.map((x) => x.title)).toEqual(['Finalizações', 'Jogo'])
    expect(g[0].lines).toEqual([{ label: 'Finalizações', home: 15, away: 12, suffix: undefined }])
    expect(g[1].lines.find((l) => l.label === 'Escanteios')).toMatchObject({ home: 0, away: 4 })
    expect(g[1].lines.find((l) => l.label === 'Posse de bola')).toMatchObject({ home: 58, away: 42, suffix: '%' })
    expect(statGroups([], 1, 2)).toEqual([])
  })
  it('lê gols, pênaltis, gols contra e cartões', () => {
    const ev = matchEvents(
      [
        { time: { elapsed: 23 }, team: { id: 1 }, player: { name: 'Fulano' }, assist: { name: 'Beltrano' }, type: 'Goal', detail: 'Normal Goal' },
        { time: { elapsed: 45, extra: 2 }, team: { id: 2 }, player: { name: 'Ciclano' }, type: 'Goal', detail: 'Penalty' },
        { time: { elapsed: 60 }, team: { id: 2 }, player: { name: 'Zé' }, type: 'Card', detail: 'Yellow Card' },
        { time: { elapsed: 70 }, team: { id: 1 }, player: { name: 'X' }, type: 'subst', detail: 'Substitution 1' },
        { time: { elapsed: 80 }, team: { id: 1 }, player: { name: 'Y' }, type: 'Goal', detail: 'Own Goal' },
      ],
      1,
      2,
    )
    expect(ev.map((e) => [e.minute, e.side, e.kind])).toEqual([
      ["23'", 'home', 'goal'],
      ["45+2'", 'away', 'penalty'],
      ["60'", 'away', 'yellow'],
      ["80'", 'home', 'own_goal'],
    ])
    expect(ev[0].assist).toBe('Beltrano')
  })
})
