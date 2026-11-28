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
