import { Link } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { Logo } from './logo'
import { SITE } from '@/lib/site'

export function Footer() {
  return (
    <footer className="mt-20 bg-brand-dark text-emerald-50">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo light />
          <p className="max-w-sm text-sm leading-relaxed text-emerald-100/80">
            Estatísticas e análises de futebol para quem gosta de decidir com dados. Informação não é garantia de resultado.
          </p>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full border-2 border-white font-display text-sm font-bold">18+</span>
            <p className="text-xs leading-snug text-emerald-100/80">
              Conteúdo exclusivo para maiores de 18 anos.
              <br />
              Apostas envolvem risco de perda financeira.
            </p>
          </div>
        </div>
        <FooterCol
          title="Produto"
          links={[
            { to: '/jogos', label: 'Jogos do dia' },
            { to: '/bilhete', label: 'Conferir bilhete' },
            { to: '/escanteios', label: 'Radar de escanteios' },
            { to: '/planos', label: 'Planos' },
          ]}
        />
        <FooterCol
          title="Institucional"
          links={[
            { to: '/sobre', label: 'Sobre e perguntas frequentes' },
            { to: '/termos', label: 'Termos de uso' },
            { to: '/privacidade', label: 'Política de privacidade' },
            { to: '/jogo-responsavel', label: 'Jogo responsável' },
          ]}
        />
        <div>
          <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-white uppercase">Contato</h3>
          <a href={`mailto:${SITE.contactEmail}`} className="flex items-center gap-2 text-sm text-emerald-100/90 hover:text-white">
            <Mail className="size-4" /> {SITE.contactEmail}
          </a>
          <ul className="mt-4 flex flex-wrap gap-2">
            {SITE.social.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full border border-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/10">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-emerald-100/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} GreenGoal. Todos os direitos reservados. Desenvolvido pela <strong className="font-semibold text-emerald-50">{SITE.developer}</strong>.
          </p>
          <p>Não somos casa de apostas e não recebemos apostas. Jogue com responsabilidade.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: Array<{ to: string; label: string }> }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold tracking-wide text-white uppercase">{title}</h3>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-emerald-100/85 transition hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
