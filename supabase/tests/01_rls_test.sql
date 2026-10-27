-- Testes de RLS e regras de negócio do banco. Falha com exceção se algo
-- estiver errado. Executado por scripts/test-db.sh.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'contato.greengoal@gmail.com', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'assinante@example.com', '{"full_name":"Assinante"}'),
  ('00000000-0000-0000-0000-00000000000c', 'visitante@example.com', '{"full_name":"Visitante"}');

insert into public.fixtures (id, grade_date, kickoff_at, local_time, league_id, league_name, season,
  home_team_id, home_team_name, away_team_id, away_team_name)
values (1001, '2026-10-26', '2026-10-26 22:00:00+00', '19:00', 71, 'Brasileirão Série A', 2026, 1, 'Palmeiras', 2, 'Flamengo');
insert into public.analyses (fixture_id, status, content) values (1001, 'done', '{"secoes":{"gols":"texto"}}');
insert into public.fixture_data (fixture_id, payload) values (1001, '{"raw":true}');

do $$ begin
  assert (select price_cents from public.plans where id = 'weekly') = 1390, 'semanal deveria custar R$ 13,90';
  assert (select price_cents from public.plans where id = 'monthly') = 4190, 'mensal deveria custar R$ 41,90';
  assert (select price_cents from public.plans where id = 'annual') = 39990, 'anual deveria continuar R$ 399,90';
  assert not exists (select 1 from information_schema.columns where table_name = 'fixtures' and column_name = 'period'), 'coluna period deveria ter saído';
  assert (select has_analysis from public.fixtures where id = 1001), 'has_analysis deveria ser true';
  assert public.has_role('00000000-0000-0000-0000-00000000000a', 'admin'), 'admin não recebeu papel';
  assert not public.has_role('00000000-0000-0000-0000-00000000000b', 'admin'), 'usuário comum virou admin';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Assinante', 'perfil não criado';
end $$;

-- Assinatura demonstrativa para o usuário B
select public.demo_checkout('00000000-0000-0000-0000-00000000000b', 'monthly', 'pix');
select public.demo_checkout('00000000-0000-0000-0000-00000000000b', 'annual', 'card');
do $$ begin
  assert (select count(*) from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'active') = 1, 'deveria haver só 1 assinatura ativa';
  assert (select plan_id from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'active') = 'annual', 'plano ativo incorreto';
  assert (select count(*) from public.payments where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'demo') = 2, 'pagamentos demo não registrados';
  assert public.has_active_subscription('00000000-0000-0000-0000-00000000000b'), 'assinatura deveria estar ativa';
  assert not public.has_active_subscription('00000000-0000-0000-0000-00000000000c'), 'visitante não deveria ter assinatura';
end $$;

-- Vencida: status active mas vencimento no passado não vale
insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
values ('00000000-0000-0000-0000-00000000000c', 'weekly', 'active', now() - interval '10 days', now() - interval '3 days');
do $$ begin
  assert not public.has_active_subscription('00000000-0000-0000-0000-00000000000c'), 'assinatura vencida não pode valer';
end $$;

insert into public.tickets (user_id, input) values ('00000000-0000-0000-0000-00000000000b', 'A x B - casa');
insert into public.tickets (user_id, input) values ('00000000-0000-0000-0000-00000000000c', 'C x D - fora');

-- ---------- anon ----------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  assert (select count(*) from public.fixtures) = 1, 'anon deve ler partidas';
  assert (select count(*) from public.plans) = 3, 'anon deve ler planos';
end $$;
do $$ begin
  perform count(*) from public.analyses;
  raise exception 'anon não deveria ter acesso a analyses';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform count(*) from public.fixture_data;
  raise exception 'anon não deveria ter acesso a fixture_data';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- visitante autenticado sem assinatura ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
do $$ begin
  assert (select count(*) from public.analyses) = 0, 'não assinante não pode ler análise';
  assert (select count(*) from public.tickets) = 1, 'deve ver só o próprio bilhete';
  assert (select count(*) from public.profiles) = 1, 'deve ver só o próprio perfil';
  assert (select count(*) from public.ai_usage) = 0, 'não admin não vê uso de IA';
end $$;
do $$ begin
  perform count(*) from public.fixture_data;
  raise exception 'authenticated não deveria acessar fixture_data';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.subscriptions (user_id, plan_id, status, current_period_end)
  values ('00000000-0000-0000-0000-00000000000c', 'annual', 'active', now() + interval '1 year');
  raise exception 'usuário não pode criar a própria assinatura';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000c', 'admin');
  raise exception 'usuário não pode se promover a admin';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.consume_ai_call();
  raise exception 'usuário não pode consumir cota de IA';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.demo_checkout('00000000-0000-0000-0000-00000000000c', 'annual', 'pix');
  raise exception 'usuário não pode chamar demo_checkout direto';
exception when insufficient_privilege then null; end $$;
delete from public.tickets where user_id = '00000000-0000-0000-0000-00000000000b';
reset role;
do $$ begin
  assert (select count(*) from public.tickets where user_id = '00000000-0000-0000-0000-00000000000b') = 1, 'usuário apagou bilhete alheio';
end $$;

-- ---------- assinante ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$ begin
  assert (select count(*) from public.analyses) = 1, 'assinante deve ler análise';
end $$;
delete from public.tickets;
do $$ begin
  assert (select count(*) from public.tickets) = 0, 'assinante deve poder excluir o próprio bilhete';
end $$;
reset role;

-- ---------- admin ----------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ begin
  assert (select count(*) from public.analyses) = 1, 'admin deve ler análise';
end $$;
reset role;

-- ---------- limite diário global de IA ----------
update public.app_settings set value = '3'::jsonb where key = 'ai_daily_limit';
do $$
declare r record; ok int := 0;
begin
  for i in 1..5 loop
    select * into r from public.consume_ai_call();
    if r.allowed then ok := ok + 1; end if;
  end loop;
  assert ok = 3, format('esperado 3 chamadas permitidas, obtido %s', ok);
  assert (select calls from public.ai_usage where day = public.sp_today()) = 3, 'contador incorreto';
end $$;

rollback;
\echo 'OK: todos os testes de banco passaram'
