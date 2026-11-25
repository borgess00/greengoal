import { createFileRoute, redirect } from '@tanstack/react-router'

// A antiga "Conferir bilhete" virou "Meus bilhetes" (montar, salvar e conferir sozinho).
export const Route = createFileRoute('/bilhete')({
  beforeLoad: () => {
    throw redirect({ to: '/meus-bilhetes', replace: true })
  },
})
