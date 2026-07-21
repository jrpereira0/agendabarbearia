-- Restaura a leitura de profissionais/serviços inativos no painel (0046),
-- agora restrita a `authenticated`. Em 0049 removemos a policy quebrada
-- que também valia pra anon (e disparava is_admin sem EXECUTE).
-- Com `to authenticated`, o site público continua só vendo active = true
-- (policy "leitura de …" da 0028), e o dono/barbeiro logado volta a ver
-- tudo — inclusive inativos — na listagem do painel.

create policy "admin le todos os profissionais" on public.professionals
  for select to authenticated using ((select public.is_admin()));

create policy "admin le todos os servicos" on public.services
  for select to authenticated using ((select public.is_admin()));
