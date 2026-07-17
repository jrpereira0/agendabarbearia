-- Dono/admin precisa ver profissionais e serviços inativos no painel.
-- A policy pública "leitura de ..." só libera active = true (site/API).
-- Em 0027 o FOR ALL do dono foi partido em insert/update/delete e sumiu o SELECT.

create policy "admin le todos os profissionais" on public.professionals
  for select using ((select public.is_admin()));

create policy "admin le todos os servicos" on public.services
  for select using ((select public.is_admin()));
