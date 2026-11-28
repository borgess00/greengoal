import { ArrowLeftRight, CalendarDays, Crown, Flag, Info, Layers, LayoutDashboard, Star, TicketCheck } from 'lucide-react'

/** Navegação principal do app (barra lateral, menu do celular e topo). */
export const APP_NAV = [
  { to: '/painel', label: 'Painel', icon: LayoutDashboard },
  { to: '/jogos', label: 'Partidas', icon: CalendarDays },
  { to: '/bilhetes-prontos', label: 'Bilhetes prontos', icon: Layers },
  { to: '/meus-bilhetes', label: 'Meus bilhetes', icon: TicketCheck },
  { to: '/favoritos', label: 'Favoritos', icon: Star },
  { to: '/comparar', label: 'Comparar', icon: ArrowLeftRight },
  { to: '/escanteios', label: 'Radar de escanteios', icon: Flag },
] as const

export const SITE_NAV = [
  { to: '/planos', label: 'Planos', icon: Crown },
  { to: '/sobre', label: 'Sobre', icon: Info },
] as const
