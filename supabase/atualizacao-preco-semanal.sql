-- GreenGoal — ATUALIZAÇÃO 4: plano semanal a R$ 10,90.
-- Para quem JÁ instalou o banco. Pode rodar mais de uma vez.
update public.plans set price_cents = 1090 where id = 'weekly';
select id, name, price_cents from public.plans order by sort_order;
