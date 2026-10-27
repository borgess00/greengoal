-- ============================================================
-- GreenGoal — ATUALIZAÇÃO 2 (pagamentos pelo Asaas)
-- Para quem JÁ rodou as atualizações anteriores. Pode rodar mais de uma vez.
-- ============================================================
-- Pagamentos reais pelo Asaas (Pix e cartão, com renovação automática).
-- A ativação acontece SOMENTE pelo webhook verificado do Asaas.

-- Cliente no Asaas (CPF/CNPJ fica só aqui; acesso apenas pelo servidor).
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'asaas',
  customer_ref text not null,
  cpf_cnpj text not null,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;

-- Pagamentos: novos status, boleto, link da fatura e datas.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('card', 'pix', 'boleto'));
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('demo', 'pending', 'paid', 'overdue', 'failed', 'refunded', 'canceled'));
alter table public.payments add column if not exists invoice_url text;
alter table public.payments add column if not exists due_date date;
alter table public.payments add column if not exists paid_at timestamptz;
create unique index if not exists payments_provider_ref_key on public.payments (provider_ref) where provider_ref is not null;
create index if not exists subscriptions_provider_ref_idx on public.subscriptions (provider, provider_ref);

-- Registro das operações: eventos de cobrança.
alter table public.sync_runs drop constraint if exists sync_runs_kind_check;
alter table public.sync_runs add constraint sync_runs_kind_check
  check (kind in ('sync', 'generate', 'collect', 'leagues', 'tickets', 'auto', 'billing'));

-- Confirma um pagamento do Asaas de forma idempotente: o mesmo pagamento
-- nunca estende o acesso duas vezes. Retorna 'extended', 'duplicate' ou
-- 'unknown_subscription'.
drop function if exists public.asaas_confirm_payment(text, text, integer, text, text, date);
create or replace function public.asaas_confirm_payment(
  _subscription_id uuid,
  _payment_ref text,
  _amount_cents integer,
  _method text,
  _invoice_url text,
  _due_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _sub public.subscriptions%rowtype;
  _days integer;
  _changed integer;
begin
  select * into _sub from public.subscriptions
   where id = _subscription_id and provider = 'asaas'
   for update;
  if not found then
    return 'unknown_subscription';
  end if;

  insert into public.payments (user_id, subscription_id, plan_id, amount_cents, method, status, provider, provider_ref, invoice_url, due_date, paid_at)
  values (_sub.user_id, _sub.id, _sub.plan_id, _amount_cents, _method, 'paid', 'asaas', _payment_ref, _invoice_url, _due_date, now())
  on conflict (provider_ref) where provider_ref is not null
  do update set status = 'paid', paid_at = now(), amount_cents = excluded.amount_cents
   where public.payments.status <> 'paid';
  get diagnostics _changed = row_count;
  if _changed = 0 then
    return 'duplicate';
  end if;

  select duration_days into _days from public.plans where id = _sub.plan_id;

  update public.subscriptions
     set status = 'active',
         current_period_start = case when _sub.status = 'active' then current_period_start else now() end,
         current_period_end = greatest(
           case when _sub.status = 'active' then current_period_end else now() end,
           now()
         ) + make_interval(days => coalesce(_days, 30))
   where id = _sub.id;

  return 'extended';
end;
$$;

revoke execute on function public.asaas_confirm_payment(uuid, text, integer, text, text, date) from public, anon, authenticated;
grant execute on function public.asaas_confirm_payment(uuid, text, integer, text, text, date) to service_role;

select 'Atualização de pagamentos aplicada com sucesso' as resultado;
