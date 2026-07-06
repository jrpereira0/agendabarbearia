-- Visitantes (anon) não podem executar is_owner().
-- A policy FOR ALL em service_weekday_prices quebrava a leitura pública dos preços por dia
-- (API /catalog mode=booking e agendamento no site).

drop policy if exists "dono gerencia precos por dia" on public.service_weekday_prices;

create policy "dono insere precos por dia" on public.service_weekday_prices
  for insert with check ((select public.is_owner()));

create policy "dono atualiza precos por dia" on public.service_weekday_prices
  for update using ((select public.is_owner()));

create policy "dono remove precos por dia" on public.service_weekday_prices
  for delete using ((select public.is_owner()));
