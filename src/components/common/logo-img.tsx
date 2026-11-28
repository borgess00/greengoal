import * as React from 'react'
import { cachedLogoUrl, useImageFallback } from '@/lib/logos'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

/** Imagem de logo: tenta a cópia guardada no site e cai para a original. */
export function LogoImg({ src, ...props }: Omit<React.ComponentProps<'img'>, 'src'> & { src: string | null | undefined }) {
  const cached = cachedLogoUrl(src, SUPABASE_URL)
  const [step, setStep] = React.useState(0)
  const chain = [cached, src].filter(Boolean) as string[]
  const ref = useImageFallback(step, () => setStep((s) => s + 1))
  if (!chain[step]) return null
  return <img {...props} ref={ref} src={chain[step]} onError={() => setStep((s) => s + 1)} />
}
