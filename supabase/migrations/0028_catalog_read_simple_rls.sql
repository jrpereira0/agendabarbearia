-- Leitura pública: só active = true, sem subquery em profiles (quebra anon).

drop policy if exists "leitura de profissionais" on public.professionals;
create policy "leitura de profissionais" on public.professionals
  for select using (active = true);

drop policy if exists "leitura de servicos" on public.services;
create policy "leitura de servicos" on public.services
  for select using (active = true);
