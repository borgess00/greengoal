-- Novos preços: Semanal R$ 7,90 · Mensal R$ 16,90 · Anual R$ 99,90 (≈ R$ 8,33/mês).
update public.plans set price_cents = 790 where id = 'weekly';
update public.plans set price_cents = 1690 where id = 'monthly';
update public.plans set price_cents = 9990, monthly_equivalent_cents = 833 where id = 'annual';
