// Códigos de status da API-Football agrupados.

export const FINISHED = new Set(['FT', 'AET', 'PEN'])
export const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
export const NOT_STARTED = new Set(['TBD', 'NS'])
export const VOID = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

export function isFinished(status: string | null | undefined) {
  return !!status && FINISHED.has(status)
}
export function isLive(status: string | null | undefined) {
  return !!status && LIVE.has(status)
}

const LABELS: Record<string, string> = {
  TBD: 'A definir',
  NS: 'Não iniciado',
  '1H': '1º tempo',
  HT: 'Intervalo',
  '2H': '2º tempo',
  ET: 'Prorrogação',
  BT: 'Intervalo da prorrogação',
  P: 'Pênaltis',
  SUSP: 'Suspenso',
  INT: 'Interrompido',
  LIVE: 'Ao vivo',
  FT: 'Encerrado',
  AET: 'Encerrado (prorrogação)',
  PEN: 'Encerrado (pênaltis)',
  PST: 'Adiado',
  CANC: 'Cancelado',
  ABD: 'Abandonado',
  AWD: 'W.O. técnico',
  WO: 'W.O.',
}

export function statusLabel(status: string | null | undefined) {
  if (!status) return '—'
  return LABELS[status] ?? status
}
