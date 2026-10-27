-- Bilhetes prontos do dia (gerados pela IA a partir das análises) e
-- configurações da automação diária.

create table if not exists public.daily_tickets (
  grade_date date primary key,
  status text not null default 'pending' check (status in ('pending', 'generating', 'done', 'error')),
  content jsonb,
  model text,
  error text,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists daily_tickets_touch on public.daily_tickets;
create trigger daily_tickets_touch before update on public.daily_tickets
  for each row execute function public.touch_updated_at();

alter table public.daily_tickets enable row level security;

-- Mesmo acesso das análises: assinantes ativos ou administradores.
drop policy if exists "daily_tickets_subscribers_read" on public.daily_tickets;
create policy "daily_tickets_subscribers_read" on public.daily_tickets
  for select to authenticated
  using (public.has_active_subscription(auth.uid()) or public.has_role(auth.uid(), 'admin'));

revoke all on public.daily_tickets from anon;
revoke insert, update, delete on public.daily_tickets from authenticated;

-- Novos tipos de operação no registro do painel.
alter table public.sync_runs drop constraint if exists sync_runs_kind_check;
alter table public.sync_runs add constraint sync_runs_kind_check
  check (kind in ('sync', 'generate', 'collect', 'leagues', 'tickets', 'auto'));

-- Automação: liga/desliga e quantas análises gerar por execução diária.
insert into public.app_settings (key, value) values
  ('auto_enabled', 'true'::jsonb),
  ('auto_max_analyses', '4'::jsonb)
on conflict (key) do nothing;
