-- ============================================================
-- GreenGoal — ATUALIZAÇÃO DAS NOVIDADES (rode uma vez no SQL Editor)
-- Inclui: estatísticas e favoritos, preços novos (7,90 / 16,90 / 99,90),
-- resultados das partidas encerradas e "Meus bilhetes".
-- Para quem JÁ instalou o banco. Pode rodar mais de uma vez sem problema.
-- Não depende da atualização de pagamentos (Asaas).
-- ============================================================

-- >>> 20261126120000_estatisticas_e_favoritos.sql
-- Estatísticas dinâmicas e favoritos.

-- Forma recente (V/E/D, mais recente primeiro) gravada na coleta, para os
-- cartões de jogos mostrarem sem carregar o pacote de dados.
alter table public.fixtures add column if not exists form_home text;
alter table public.fixtures add column if not exists form_away text;
alter table public.fixtures drop constraint if exists fixtures_form_check;
alter table public.fixtures add constraint fixtures_form_check
  check ((form_home is null or form_home ~ '^[VED]{0,10}$') and (form_away is null or form_away ~ '^[VED]{0,10}$'));

-- Times favoritos: cada pessoa vê e altera só os seus.
create table if not exists public.favorite_teams (
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id bigint not null,
  team_name text not null,
  team_logo text,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
alter table public.favorite_teams enable row level security;

drop policy if exists "favorite_teams_select_own" on public.favorite_teams;
create policy "favorite_teams_select_own" on public.favorite_teams
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "favorite_teams_insert_own" on public.favorite_teams;
create policy "favorite_teams_insert_own" on public.favorite_teams
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "favorite_teams_delete_own" on public.favorite_teams;
create policy "favorite_teams_delete_own" on public.favorite_teams
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.favorite_teams from anon;
revoke update on public.favorite_teams from authenticated;
grant select, insert, delete on public.favorite_teams to authenticated;

-- Limite de favoritos por pessoa (evita abuso).
create or replace function public.favorite_teams_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.favorite_teams where user_id = new.user_id) >= 50 then
    raise exception 'Limite de 50 times favoritos atingido.';
  end if;
  return new;
end;
$$;
drop trigger if exists favorite_teams_limit on public.favorite_teams;
create trigger favorite_teams_limit before insert on public.favorite_teams
  for each row execute function public.favorite_teams_limit();

-- Automação: quantas partidas terão estatísticas coletadas por execução
-- (sem IA; só consultas à API-Football, a maioria em cache).
insert into public.app_settings (key, value) values ('auto_max_stats', '6'::jsonb)
on conflict (key) do nothing;

-- >>> 20261128120000_precos_novos.sql
-- Novos preços: Semanal R$ 7,90 · Mensal R$ 16,90 · Anual R$ 99,90 (≈ R$ 8,33/mês).
update public.plans set price_cents = 790 where id = 'weekly';
update public.plans set price_cents = 1690 where id = 'monthly';
update public.plans set price_cents = 9990, monthly_equivalent_cents = 833 where id = 'annual';

-- >>> 20261128120100_resultados_e_meus_bilhetes.sql
-- Resultados das partidas encerradas e "Meus bilhetes".

-- Estatísticas finais e eventos (gols, cartões) das partidas encerradas.
-- São fatos públicos do jogo: leitura liberada; escrita só pelo servidor.
create table if not exists public.fixture_results (
  fixture_id bigint primary key references public.fixtures (id) on delete cascade,
  stats jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  collected_at timestamptz not null default now()
);
alter table public.fixture_results enable row level security;
drop policy if exists "fixture_results_public_read" on public.fixture_results;
create policy "fixture_results_public_read" on public.fixture_results
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.fixture_results from anon, authenticated;
grant select on public.fixture_results to anon, authenticated;

-- Bilhetes montados pela própria pessoa. Cada um vê e apaga só os seus;
-- criação e liquidação passam pelo servidor (que valida jogos e mercados).
create table if not exists public.user_slips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 80),
  selections jsonb not null check (jsonb_typeof(selections) = 'array' and jsonb_array_length(selections) between 1 and 20),
  stake_units numeric(6, 2) not null default 1 check (stake_units > 0 and stake_units <= 100),
  odd_total numeric(12, 2),
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'void')),
  source text not null default 'manual' check (source in ('manual', 'ready')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_slips_user_idx on public.user_slips (user_id, created_at desc);
create index if not exists user_slips_open_idx on public.user_slips (status) where status = 'open';
alter table public.user_slips enable row level security;

drop policy if exists "user_slips_select_own" on public.user_slips;
create policy "user_slips_select_own" on public.user_slips
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "user_slips_delete_own" on public.user_slips;
create policy "user_slips_delete_own" on public.user_slips
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.user_slips from anon;
revoke insert, update on public.user_slips from authenticated;
grant select, delete on public.user_slips to authenticated;

-- Limite por pessoa (evita abuso).
create or replace function public.user_slips_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.user_slips where user_id = new.user_id) >= 500 then
    raise exception 'Limite de 500 bilhetes atingido. Apague bilhetes antigos para salvar novos.';
  end if;
  return new;
end;
$$;
drop trigger if exists user_slips_limit on public.user_slips;
create trigger user_slips_limit before insert on public.user_slips
  for each row execute function public.user_slips_limit();

-- Automação: quantas partidas encerradas terão estatísticas finais coletadas por execução.
insert into public.app_settings (key, value) values ('auto_max_results', '8'::jsonb)
on conflict (key) do nothing;

-- >>> 20261128120200_extras.sql
-- Extras: jogo quente, classificação dos campeonatos, notificações,
-- e-mails automáticos, logos guardados e novos tipos no registro.

-- Selo "jogo quente": quantos mercados se repetiram em todos os ângulos.
alter table public.fixtures add column if not exists hot_markets smallint;

-- Classificação por campeonato (coletada pela automação; leitura pública).
create table if not exists public.league_standings (
  league_id integer not null,
  season integer not null,
  standings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (league_id, season)
);
alter table public.league_standings enable row level security;
drop policy if exists "league_standings_public_read" on public.league_standings;
create policy "league_standings_public_read" on public.league_standings
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.league_standings from anon, authenticated;
grant select on public.league_standings to anon, authenticated;

-- Preferências da pessoa (e-mails e notificações).
alter table public.profiles add column if not exists email_opt_out boolean not null default false;
alter table public.profiles add column if not exists notify_prefs jsonb not null
  default '{"bilhetes_prontos": true, "favoritos": true, "conferidos": true}'::jsonb;

-- Inscrições de notificação no navegador/celular (Web Push).
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Registro de envios (evita mandar o mesmo e-mail/aviso duas vezes). Só o servidor.
create table if not exists public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  kind text not null check (char_length(kind) <= 40),
  ref text not null check (char_length(ref) <= 80),
  sent_at timestamptz not null default now(),
  primary key (user_id, channel, kind, ref)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

-- Novos tipos de operação no registro do painel.
alter table public.sync_runs drop constraint if exists sync_runs_kind_check;
alter table public.sync_runs add constraint sync_runs_kind_check
  check (kind in ('sync', 'generate', 'collect', 'leagues', 'tickets', 'auto', 'billing', 'discord', 'email', 'push', 'live', 'logos', 'standings'));

-- Configurações novas.
insert into public.app_settings (key, value) values
  ('live_enabled', 'false'::jsonb),
  ('auto_max_standings', '4'::jsonb),
  ('discord_enabled', 'true'::jsonb),
  ('emails_enabled', 'true'::jsonb),
  ('push_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- Logos guardados no próprio Supabase (Storage). Só existe no Supabase real.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
    on conflict (id) do update set public = true;
  end if;
end $$;

-- Confira: os preços devem aparecer como 790, 1690 e 9990 (centavos).
select id, name, price_cents from public.plans order by sort_order;
