// Configuração institucional do site.
// PENDENTE: confirmar com o responsável o e-mail de contato exibido e os
// endereços oficiais das redes sociais (os links abaixo são genéricos).
export const SITE = {
  name: 'GreenGoal',
  tagline: 'Cada jogo, em números.',
  description:
    'Estatísticas, forma recente, confrontos diretos e análises de futebol em português. Informação para decidir melhor — sem promessa de resultado. Somente 18+.',
  url: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://greengoal.com.br',
  contactEmail: 'contato.greengoal@gmail.com',
  developer: 'PredyX IAs',
  social: [
    { name: 'Instagram', href: 'https://instagram.com/' },
    { name: 'X', href: 'https://x.com/' },
    { name: 'YouTube', href: 'https://youtube.com/' },
  ],
  helpLines: [
    { name: 'CVV — Centro de Valorização da Vida', detail: 'Ligue 188 (24h, gratuito)', href: 'https://cvv.org.br' },
    { name: 'Jogadores Anônimos', detail: 'Grupos de apoio no Brasil', href: 'https://jogadoresanonimos.com.br' },
  ],
} as const
