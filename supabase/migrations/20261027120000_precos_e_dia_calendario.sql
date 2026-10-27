-- 1) Novos preços: Semanal R$ 13,90 e Mensal R$ 41,90 (Anual mantido em R$ 399,90).
--    Assinaturas e pagamentos já registrados não mudam.
update public.plans set price_cents = 1390 where id = 'weekly';
update public.plans set price_cents = 4190 where id = 'monthly';

-- 2) Jogos do dia = dia do calendário em America/Sao_Paulo (00h00 às 23h59).
--    Fim da divisão Tarde/Noite e da regra de madrugada.
update public.fixtures
   set grade_date = (kickoff_at at time zone 'America/Sao_Paulo')::date
 where grade_date <> (kickoff_at at time zone 'America/Sao_Paulo')::date;

alter table public.fixtures drop column if exists period;

comment on column public.fixtures.grade_date is 'Dia do calendário da partida no horário de Brasília (America/Sao_Paulo).';
