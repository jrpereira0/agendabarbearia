-- Visitantes (anon) não podem executar is_owner().
-- Policies FOR ALL em profissionais/serviços quebram o catálogo público e a API /catalog.

drop policy if exists "dono gerencia profissionais" on public.professionals;
create policy "dono insere profissionais" on public.professionals
  for insert with check ((select public.is_owner()));
create policy "dono atualiza profissionais" on public.professionals
  for update using ((select public.is_owner()));
create policy "dono remove profissionais" on public.professionals
  for delete using ((select public.is_owner()));

drop policy if exists "dono gerencia servicos" on public.services;
create policy "dono insere servicos" on public.services
  for insert with check ((select public.is_owner()));
create policy "dono atualiza servicos" on public.services
  for update using ((select public.is_owner()));
create policy "dono remove servicos" on public.services
  for delete using ((select public.is_owner()));

drop policy if exists "dono gerencia vinculos" on public.professional_services;
create policy "dono insere vinculos" on public.professional_services
  for insert with check ((select public.is_owner()));
create policy "dono atualiza vinculos" on public.professional_services
  for update using ((select public.is_owner()));
create policy "dono remove vinculos" on public.professional_services
  for delete using ((select public.is_owner()));
