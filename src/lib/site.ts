// Configuração institucional do site.
// Redes sociais: só aparecem no rodapé quando houver perfis oficiais na lista.
export const SITE = {
  name: 'GreenGoal',
  tagline: 'Cada jogo, em números.',
  description:
    'Estatísticas, forma recente, confrontos diretos e análises de futebol em português. Informação para decidir melhor — sem promessa de resultado. Somente 18+.',
  url: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://greengoal.com.br',
  contactEmail: 'contato.greengoal@gmail.com',
  developer: 'PredyX IAs',
  /** Servidor de suporte no Discord. */
  supportDiscord: 'https://discord.gg/gczEPrJVC4',
  social: [] as ReadonlyArray<{ name: string; href: string }>,
  helpLines: [
    { name: 'CVV — Centro de Valorização da Vida', detail: 'Ligue 188 (24h, gratuito)', href: 'https://cvv.org.br' },
    { name: 'Jogadores Anônimos', detail: 'Grupos de apoio no Brasil', href: 'https://jogadoresanonimos.com.br' },
  ],
} as const
