-- Alertas restantes do Database Linter (jun/2026).

-- ------------------------------------------------------------
-- 1. Bucket público `photos` — remover policy de SELECT ampla
--    Bucket já é public=true: URLs diretas funcionam sem listar tudo.
-- ------------------------------------------------------------
drop policy if exists "leitura publica de fotos" on storage.objects;

-- ------------------------------------------------------------
-- 2. Profissionais/serviços — leitura pública sem chamar is_admin() para anon
--    (evita erro de permissão ao revogar EXECUTE de anon)
-- ------------------------------------------------------------
drop policy if exists "leitura publica de profissionais ativos" on public.professionals;
drop policy if exists "admin le todos os profissionais" on public.professionals;

create policy "leitura de profissionais" on public.professionals
  for select using (
    active = true
    or (
      (select auth.uid()) is not null
      and exists (
        select 1 from public.profiles
        where id = (select auth.uid())
      )
    )
  );

drop policy if exists "leitura publica de servicos ativos" on public.services;
drop policy if exists "admin le todos os servicos" on public.services;

create policy "leitura de servicos" on public.services
  for select using (
    active = true
    or (
      (select auth.uid()) is not null
      and exists (
        select 1 from public.profiles
        where id = (select auth.uid())
      )
    )
  );

-- ------------------------------------------------------------
-- 3. Funções SECURITY DEFINER — bloquear chamada via /rest/v1/rpc
-- ------------------------------------------------------------

-- Trigger de cadastro (só auth + service role)
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

do $block$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end
$block$;

-- Helpers de RLS (painel logado + API server; anon não chama mais via RPC)
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.is_owner() from public;
revoke all on function public.is_owner() from anon;
grant execute on function public.is_owner() to authenticated, service_role;

-- Novas funções no schema public não herdam EXECUTE para anon
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
