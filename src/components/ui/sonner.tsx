import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/lib/theme'

function Toaster(props: ToasterProps) {
  const [theme] = useTheme()
  return (
    <Sonner
      theme={theme}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: 'font-sans rounded-xl' } }}
      {...props}
    />
  )
}

export { Toaster }
