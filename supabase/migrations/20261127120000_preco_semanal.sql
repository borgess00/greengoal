-- Plano semanal passa a custar R$ 10,90 (mensal e anual sem mudança).
update public.plans set price_cents = 1090 where id = 'weekly';
