// Bilhete em montagem: fica neste navegador até ser salvo em "Meus bilhetes".
import * as React from 'react'
import type { SlipMarketCode } from './slips'

export interface DraftSelection {
  fixtureId: number
  market: SlipMarketCode
  label: string
  odd: number | null
  home: string
  away: string
  league: string
  kickoff: string
}

const KEY = 'greengoal:slip'
const MAX = 20
let state: DraftSelection[] = []
let loaded = false
const listeners = new Set<() => void>()
const EMPTY: DraftSelection[] = []

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    // Descarta jogos que já começaram.
    state = Array.isArray(raw) ? raw.filter((s: DraftSelection) => s && Date.parse(s.kickoff) > Date.now()).slice(0, MAX) : []
  } catch {
    state = []
  }
}

function commit(next: DraftSelection[]) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // modo privado: o bilhete vale só nesta aba
  }
  listeners.forEach((l) => l())
}

export const slipDraft = {
  /** Adiciona (ou troca o mercado da mesma partida: uma seleção por jogo). */
  add(sel: DraftSelection) {
    load()
    const others = state.filter((s) => s.fixtureId !== sel.fixtureId)
    if (others.length >= MAX) return false
    commit([...others, sel])
    return true
  },
  remove(fixtureId: number) {
    load()
    commit(state.filter((s) => s.fixtureId !== fixtureId))
  },
  setOdd(fixtureId: number, odd: number | null) {
    load()
    commit(state.map((s) => (s.fixtureId === fixtureId ? { ...s, odd } : s)))
  },
  clear() {
    commit([])
  },
}

export function useSlipDraft(): DraftSelection[] {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => {
      load()
      return state
    },
    () => EMPTY,
  )
}
