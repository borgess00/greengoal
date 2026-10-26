import { SITE } from './site'

/** Metadados de título, descrição e compartilhamento para cada página. */
export function seo({ title, description, path = '/', noindex = false }: { title: string; description: string; path?: string; noindex?: boolean }) {
  const fullTitle = title.includes(SITE.name) ? title : `${title} · ${SITE.name}`
  const url = SITE.url.replace(/\/$/, '') + path
  const image = SITE.url.replace(/\/$/, '') + '/og-image.png'
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE.name },
      { property: 'og:locale', content: 'pt_BR' },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
