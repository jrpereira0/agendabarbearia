-- Linter 0029: is_admin / is_owner eram SECURITY DEFINER e executáveis
-- por authenticated via /rest/v1/rpc. Como só consultam o próprio perfil
-- (auth.uid()), SECURITY INVOKER é suficiente e remove o alerta.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid())
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'owner'
  );
$$;

-- Mantém o escopo: RLS do painel precisa de EXECUTE; anon não chama via RPC.
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.is_owner() from public;
revoke all on function public.is_owner() from anon;
grant execute on function public.is_owner() to authenticated, service_role;
