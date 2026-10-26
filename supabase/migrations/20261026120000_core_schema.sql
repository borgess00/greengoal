-- =====================================================================
-- GreenGoal — esquema principal
-- Tabelas, funções de acesso, gatilhos e políticas RLS.
-- Todas as tabelas públicas têm RLS ativado. Tabelas operacionais
-- (fixture_data, api_cache, sync_runs) não têm políticas para anon /
-- authenticated: só o servidor (service_role) acessa.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.sp_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Papéis (separados do perfil para evitar escalonamento de privilégio)
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- ---------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents > 0),
  duration_days integer not null check (duration_days > 0),
  sort_order integer not null default 0,
  badge text,
  monthly_equivalent_cents integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, price_cents, duration_days, sort_order, badge, monthly_equivalent_cents)
values
  ('weekly',  'Semanal', 1990,  7,   1, null, null),
  ('monthly', 'Mensal',  4990,  30,  2, null, null),
  ('annual',  'Anual',   39990, 365, 3, 'Melhor custo', 3333)
on conflict (id) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  duration_days = excluded.duration_days,
  sort_order = excluded.sort_order,
  badge = excluded.badge,
  monthly_equivalent_cents = excluded.monthly_equivalent_cents;

-- ---------------------------------------------------------------------
-- Assinaturas e pagamentos
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('active', 'canceled', 'expired', 'pending')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  provider text not null default 'demo',
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, status, current_period_end desc);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  plan_id text references public.plans (id),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  method text not null check (method in ('card', 'pix')),
  status text not null check (status in ('demo', 'pending', 'paid', 'failed', 'refunded')),
  provider text not null default 'demo',
  provider_ref text,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

-- Assinatura válida = status active E vencimento no futuro.
create or replace function public.has_active_subscription(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = _user_id
      and status = 'active'
      and current_period_end > now()
  );
$$;

-- Checkout DEMONSTRATIVO: não cobra nada. Cancela assinaturas ativas
-- anteriores, cria uma nova pelo prazo do plano e registra pagamento "demo".
-- Executável apenas pelo servidor (service_role).
create or replace function public.demo_checkout(_user_id uuid, _plan_id text, _method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _plan public.plans%rowtype;
  _sub_id uuid;
begin
  if _method not in ('card', 'pix') then
    raise exception 'Método de pagamento inválido';
  end if;

  select * into _plan from public.plans where id = _plan_id and active;
  if not found then
    raise exception 'Plano inválido';
  end if;

  update public.subscriptions
     set status = 'canceled', canceled_at = now(), cancel_at_period_end = false
   where user_id = _user_id and status = 'active';

  insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, provider)
  values (_user_id, _plan.id, 'active', now(), now() + make_interval(days => _plan.duration_days), 'demo')
  returning id into _sub_id;

  insert into public.payments (user_id, subscription_id, plan_id, amount_cents, method, status, provider)
  values (_user_id, _sub_id, _plan.id, _plan.price_cents, _method, 'demo', 'demo');

  return _sub_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Campeonatos monitorados
-- ---------------------------------------------------------------------
create table if not exists public.leagues (
  id integer primary key,                 -- ID da API-Football
  name text not null,
  country text,
  category text not null default 'club' check (category in ('club', 'cup', 'continental', 'national', 'women', 'youth', 'state')),
  priority integer not null default 100,  -- ordem de exibição (menor = primeiro)
  enabled boolean not null default true,
  core boolean not null default false,    -- faz parte da lista base da especificação
  verified boolean not null default false,-- nome/ID conferidos na API
  logo text,
  api_name text,                          -- nome oficial na API (preenchido na verificação)
  api_country text,
  updated_at timestamptz not null default now()
);

create trigger leagues_touch before update on public.leagues
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Partidas
-- ---------------------------------------------------------------------
create table if not exists public.fixtures (
  id bigint primary key,                  -- ID da partida na API-Football
  grade_date date not null,               -- dia da grade (madrugada < 08h pertence ao dia anterior)
  kickoff_at timestamptz not null,
  local_time text not null,               -- HH:MM em America/Sao_Paulo
  period text not null check (period in ('tarde', 'noite')),
  league_id integer not null,
  league_name text not null,
  league_country text,
  league_logo text,
  league_round text,
  season integer not null,
  home_team_id integer not null,
  home_team_name text not null,
  home_team_logo text,
  away_team_id integer not null,
  away_team_name text not null,
  away_team_logo text,
  venue text,
  status_short text not null default 'NS',
  status_long text,
  elapsed integer,
  goals_home integer,
  goals_away integer,
  ft_home integer,                        -- placar do tempo regulamentar
  ft_away integer,
  ht_home integer,
  ht_away integer,
  referee text,
  has_analysis boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixtures_grade_idx on public.fixtures (grade_date, kickoff_at);
create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff_at);
create index if not exists fixtures_league_idx on public.fixtures (league_id, grade_date);

-- Dados brutos de apoio das análises (somente servidor).
create table if not exists public.fixture_data (
  fixture_id bigint primary key references public.fixtures (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  sources jsonb not null default '{}'::jsonb,
  api_calls integer not null default 0,
  collected_at timestamptz not null default now()
);

-- Cache de respostas da API-Football (somente servidor).
create table if not exists public.api_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ---------------------------------------------------------------------
-- Análises
-- ---------------------------------------------------------------------
create table if not exists public.analyses (
  fixture_id bigint primary key references public.fixtures (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'generating', 'done', 'error')),
  content jsonb,
  model text,
  error text,
  generated_by uuid references auth.users (id) on delete set null,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analyses_status_idx on public.analyses (status);

create trigger analyses_touch before update on public.analyses
  for each row execute function public.touch_updated_at();

-- Mantém fixtures.has_analysis em sincronia (sinal público, sem conteúdo).
create or replace function public.sync_has_analysis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.fixtures set has_analysis = false where id = old.fixture_id;
    return old;
  end if;
  update public.fixtures set has_analysis = (new.status = 'done') where id = new.fixture_id;
  return new;
end;
$$;

create trigger analyses_has_analysis
  after insert or update of status or delete on public.analyses
  for each row execute function public.sync_has_analysis();

-- ---------------------------------------------------------------------
-- Configurações e uso diário GLOBAL de IA
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('ai_daily_limit', '50'::jsonb),
  ('collect_last_matches', '10'::jsonb),
  ('collect_match_stats', '5'::jsonb),
  ('collect_player_pages', '2'::jsonb)
on conflict (key) do nothing;

create table if not exists public.ai_usage (
  day date primary key,
  calls integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now()
);

-- Consome UMA chamada de IA do teto diário global (dia de São Paulo).
-- Atômico: o UPDATE condicional impede ultrapassar o limite mesmo com
-- chamadas simultâneas.
create or replace function public.consume_ai_call()
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  _day date := public.sp_today();
  _limit integer;
  _used integer;
begin
  select coalesce((value #>> '{}')::integer, 50) into _limit
    from public.app_settings where key = 'ai_daily_limit';
  _limit := coalesce(_limit, 50);

  insert into public.ai_usage (day, calls) values (_day, 0)
  on conflict (day) do nothing;

  update public.ai_usage
     set calls = calls + 1, updated_at = now()
   where day = _day and calls < _limit
  returning calls into _used;

  if _used is null then
    select calls into _used from public.ai_usage where day = _day;
    return query select false, _used, _limit;
  else
    return query select true, _used, _limit;
  end if;
end;
$$;

-- Devolve uma chamada quando a geração falha antes de chegar à IA.
create or replace function public.refund_ai_call()
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage set calls = greatest(calls - 1, 0), updated_at = now()
   where day = public.sp_today();
$$;

-- ---------------------------------------------------------------------
-- Bilhetes
-- ---------------------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  input text not null check (char_length(input) between 3 and 3000),
  results jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tickets_user_idx on public.tickets (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Registro das operações administrativas
-- ---------------------------------------------------------------------
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sync', 'generate', 'collect', 'leagues')),
  grade_date date,
  fixture_id bigint,
  status text not null check (status in ('ok', 'error')),
  details jsonb not null default '{}'::jsonb,
  started_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sync_runs_created_idx on public.sync_runs (created_at desc);

-- ---------------------------------------------------------------------
-- Novo usuário: perfil + papel. O e-mail do responsável recebe admin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;

  if lower(new.email) = 'contato.greengoal@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Se a conta do responsável já existir, garante o papel de admin.
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users where lower(email) = 'contato.greengoal@gmail.com'
on conflict do nothing;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.payments       enable row level security;
alter table public.leagues        enable row level security;
alter table public.fixtures       enable row level security;
alter table public.fixture_data   enable row level security;
alter table public.api_cache      enable row level security;
alter table public.analyses       enable row level security;
alter table public.app_settings   enable row level security;
alter table public.ai_usage       enable row level security;
alter table public.tickets        enable row level security;
alter table public.sync_runs      enable row level security;

-- Perfis: somente o próprio usuário.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Papéis: leitura do próprio papel; escrita apenas pelo servidor/SQL.
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- Planos: leitura pública dos ativos.
create policy "plans_public_read" on public.plans
  for select to anon, authenticated using (active);

-- Assinaturas e pagamentos: leitura própria; escrita apenas pelo servidor.
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "payments_select_own" on public.payments
  for select to authenticated using (user_id = auth.uid());

-- Campeonatos e partidas: leitura pública.
create policy "leagues_public_read" on public.leagues
  for select to anon, authenticated using (true);
create policy "fixtures_public_read" on public.fixtures
  for select to anon, authenticated using (true);

-- Análises: somente assinantes ativos ou administradores.
create policy "analyses_subscribers_read" on public.analyses
  for select to authenticated
  using (public.has_active_subscription(auth.uid()) or public.has_role(auth.uid(), 'admin'));

-- Consumo diário e configurações: visíveis ao administrador.
create policy "ai_usage_admin_read" on public.ai_usage
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "app_settings_admin_read" on public.app_settings
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "sync_runs_admin_read" on public.sync_runs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Bilhetes: o usuário lê e exclui apenas os seus. Inserção pelo servidor
-- (que confere a assinatura antes).
create policy "tickets_select_own" on public.tickets
  for select to authenticated using (user_id = auth.uid());
create policy "tickets_delete_own" on public.tickets
  for delete to authenticated using (user_id = auth.uid());

-- fixture_data e api_cache: sem políticas => nenhum acesso via anon/authenticated.

-- =====================================================================
-- Permissões (defesa em profundidade além do RLS)
-- =====================================================================
revoke all on public.fixture_data, public.api_cache from anon, authenticated;
revoke insert, update, delete on public.fixtures, public.leagues, public.plans,
  public.analyses, public.ai_usage, public.app_settings, public.sync_runs,
  public.subscriptions, public.payments, public.user_roles from anon, authenticated;
revoke insert, update on public.tickets from anon, authenticated;
revoke all on public.profiles, public.subscriptions, public.payments,
  public.tickets, public.user_roles, public.analyses, public.ai_usage,
  public.app_settings, public.sync_runs from anon;

revoke execute on function public.consume_ai_call() from public, anon, authenticated;
revoke execute on function public.refund_ai_call() from public, anon, authenticated;
revoke execute on function public.demo_checkout(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_ai_call() to service_role;
grant execute on function public.refund_ai_call() to service_role;
grant execute on function public.demo_checkout(uuid, text, text) to service_role;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated, service_role;
grant execute on function public.has_active_subscription(uuid) to anon, authenticated, service_role;
