import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock, Crosshair, Goal, Square } from 'lucide-react'
import { TeamCrest } from '@/components/common/team-crest'
import { matchAverages, radarValues } from '@/lib/match-stats'
import type { FeaturedMatch } from '@/server/stats.functions'
import { FormBadges } from './form-badges'
import { ChartLegend } from './grouped-bars'
import { RadarChart } from './radar-chart'
import { StatTile } from './stat-compare'

const HOME = 'var(--series-home)'
const AWAY = 'var(--series-away)'

const show = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))

/** Destaque do dia na página inicial: forma, números por jogo e radar. */
export function FeaturedMatchCard({ data }: { data: FeaturedMatch }) {
  const { fixture: f, home: h, away: a } = data
  const avg = matchAverages(h, a)
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-lift sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Destaque do dia</p>
          <h2 className="font-display text-2xl font-bold text-brand-dark">Estatísticas da partida</h2>
        </div>
        <Link to="/jogo/$id" params={{ id: String(f.id) }} hash="estatisticas" className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-brand-dark">
          Ver estatísticas completas <ArrowRight className="size-4" />
        </Link>
      </div>

      <Link
        to="/jogo/$id"
        params={{ id: String(f.id) }}
        className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border-l-4 border-primary bg-secondary/60 p-4 transition hover:bg-secondary"
      >
        <span className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:text-left">
          <TeamCrest name={f.home_team_name} logo={f.home_team_logo} size={44} />
          <span className="truncate font-display font-bold text-brand-dark sm:text-lg">{f.home_team_name}</span>
        </span>
        <span className="text-center">
          <span className="block font-display text-xl font-bold text-brand-dark">x</span>
          <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> {f.local_time}
          </span>
        </span>
        <span className="flex min-w-0 flex-col-reverse items-center gap-1.5 text-center sm:flex-row sm:justify-end sm:text-right">
          <span className="truncate font-display font-bold text-brand-dark sm:text-lg">{f.away_team_name}</span>
          <TeamCrest name={f.away_team_name} logo={f.away_team_logo} size={44} />
        </span>
        <span className="col-span-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {f.league_logo && <img src={f.league_logo} alt="" width={14} height={14} className="size-3.5 object-contain" />}
          {f.league_name}
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 font-display text-lg font-bold text-brand-dark">Forma recente</h3>
            <div className="space-y-2">
              {[
                { name: f.home_team_name, logo: f.home_team_logo, form: data.form.home },
                { name: f.away_team_name, logo: f.away_team_logo, form: data.form.away },
              ].map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-3 rounded-xl border p-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamCrest name={t.name} logo={t.logo} size={22} />
                    <span className="truncate text-sm font-semibold">{t.name}</span>
                  </span>
                  <FormBadges form={t.form} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-display text-lg font-bold text-brand-dark">Números por jogo</h3>
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile icon={<Goal className="size-5" />} label="Gols" value={show(avg.goals)} sub="por jogo" />
              <StatTile icon={<Square className="size-5 fill-yellow-400 text-yellow-500" />} label="Cartões" value={show(avg.cards)} sub="por jogo" />
              <StatTile icon={<Crosshair className="size-5" />} label="Finalizações" value={show(avg.shots)} sub="por jogo" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Média dos últimos {data.window} jogos de cada equipe, somando os dois times em campo. Fonte: API-Football.
            </p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-brand-dark">Radar comparativo</h3>
            <ChartLegend
              items={[
                { name: f.home_team_name, color: HOME },
                { name: f.away_team_name, color: AWAY },
              ]}
            />
          </div>
          <RadarChart
            series={[
              { name: f.home_team_name, color: HOME, values: radarValues(h) },
              { name: f.away_team_name, color: AWAY, values: radarValues(a) },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
