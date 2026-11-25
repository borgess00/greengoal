-- ============================================================
-- GreenGoal — ATUALIZAÇÃO 3 (estatísticas dinâmicas e favoritos)
-- Para quem JÁ instalou o banco. Pode rodar mais de uma vez.
-- Não depende da atualização de pagamentos (Asaas).
-- ============================================================
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
