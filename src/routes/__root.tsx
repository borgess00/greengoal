/// <reference types="vite/client" />
import type * as React from 'react'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '@/styles.css?url'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AgeGate } from '@/components/layout/age-gate'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/hooks/use-auth'
import { DefaultError, NotFound } from '@/components/common/route-states'
import { seo } from '@/lib/seo'
import { SITE } from '@/lib/site'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const base = seo({ title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description })
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#064E3B' },
        { name: 'application-name', content: SITE.name },
        { name: 'apple-mobile-web-app-title', content: SITE.name },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'rating', content: 'adult' },
        { name: 'author', content: SITE.developer },
        ...base.meta,
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    }
  },
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: DefaultError,
})

function RootLayout() {
  return (
    <AuthProvider>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="min-h-[70vh]">
        <Outlet />
      </main>
      <Footer />
      <AgeGate />
      <Toaster />
    </AuthProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
