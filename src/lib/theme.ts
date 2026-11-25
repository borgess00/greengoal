// Tema claro/escuro. A escolha fica salva no navegador; sem escolha, o site
// abre no escuro. O script inline aplica a classe antes da primeira pintura.
import * as React from 'react'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'greengoal:theme'
export const DEFAULT_THEME: Theme = 'dark'

export const THEME_SCRIPT = `(function(){var d=document.documentElement,t='${DEFAULT_THEME}';try{var s=localStorage.getItem('${THEME_KEY}');if(s==='light'||s==='dark')t=s}catch(e){}if(t==='dark')d.classList.add('dark');else d.classList.remove('dark')})()`

const listeners = new Set<() => void>()

function current(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // modo privado: vale só nesta visita
  }
  listeners.forEach((l) => l())
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    () => DEFAULT_THEME,
  )
  return [theme, setTheme]
}
