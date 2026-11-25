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
