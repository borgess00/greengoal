// Validação de CPF e CNPJ (dígitos verificadores). Código puro.

export function onlyDigits(v: string) {
  return v.replace(/\D/g, '')
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((a, w, i) => a + w * Number(d[i]), 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export function isValidCpfCnpj(value: string) {
  const d = onlyDigits(value)
  return d.length === 11 ? isValidCpf(d) : d.length === 14 ? isValidCnpj(d) : false
}

/** Formata enquanto digita: 000.000.000-00 ou 00.000.000/0000-00. */
export function formatCpfCnpj(value: string) {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

/** Mostra só o final do documento (ex.: ***.***.789-09). */
export function maskCpfCnpj(value: string) {
  const d = onlyDigits(value)
  return d.length === 11 ? `***.***.${d.slice(6, 9)}-${d.slice(9)}` : `**.***.***/${d.slice(8, 12)}-${d.slice(12)}`
}
