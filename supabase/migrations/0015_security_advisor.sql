-- Correções apontadas pelo Security Advisor do Supabase (jun/2026).

-- ------------------------------------------------------------
-- 1. Tabela interna de migrations (sem RLS = exposta na API)
-- ------------------------------------------------------------
alter table public._migrations enable row level security;

revoke all on table public._migrations from anon, authenticated;

-- ------------------------------------------------------------
-- 2. Tabela de memória de chat IA (se existir — criada fora do app)
--    Sem políticas = só service role / conexão direta acessam.
-- ------------------------------------------------------------
do $block$
begin
  if to_regclass('public.dinho_ai_chat_memory') is not null then
    execute 'alter table public.dinho_ai_chat_memory enable row level security';
    execute 'revoke all on table public.dinho_ai_chat_memory from anon, authenticated';
  end if;
end
$block$;

-- ------------------------------------------------------------
-- 3. Extensão btree_gist fora do schema public
-- ------------------------------------------------------------
create schema if not exists extensions;

do $block$
begin
  if exists (select 1 from pg_extension where extname = 'btree_gist') then
    alter extension btree_gist set schema extensions;
  end if;
end
$block$;

-- ------------------------------------------------------------
-- 4. Auth RLS Initialization Plan — (select auth.uid()) nas policies
-- ------------------------------------------------------------

-- profiles
drop policy if exists "ler o proprio perfil" on public.profiles;
drop policy if exists "dono le todos os perfis" on public.profiles;
drop policy if exists "dono gerencia perfis" on public.profiles;

create policy "ler o proprio perfil" on public.profiles
  for select using (id = (select auth.uid()));

create policy "dono le todos os perfis" on public.profiles
  for select using ((select public.is_owner()));

create policy "dono gerencia perfis" on public.profiles
  for update using ((select public.is_owner()));

-- appointments
drop policy if exists "admin le agendamentos" on public.appointments;
drop policy if exists "dono gerencia agendamentos" on public.appointments;
drop policy if exists "barbeiro atualiza os proprios agendamentos" on public.appointments;

create policy "admin le agendamentos" on public.appointments
  for select using ((select public.is_admin()));

create policy "dono gerencia agendamentos" on public.appointments
  for all using ((select public.is_owner()));

create policy "barbeiro atualiza os proprios agendamentos" on public.appointments
  for update using (
    exists (
      select 1 from public.professionals p
      where p.id = appointments.professional_id
        and p.profile_id = (select auth.uid())
    )
  );

-- schedule_blocks
drop policy if exists "barbeiro gerencia os proprios bloqueios" on public.schedule_blocks;

create policy "barbeiro gerencia os proprios bloqueios" on public.schedule_blocks
  for all using (
    exists (
      select 1 from public.professionals p
      where p.id = schedule_blocks.professional_id
        and p.profile_id = (select auth.uid())
    )
  );

-- appointment_services — uma policy por ação (evita "multiple permissive policies")
drop policy if exists "admin le servicos dos agendamentos" on public.appointment_services;
drop policy if exists "dono gerencia servicos dos agendamentos" on public.appointment_services;

create policy "leitura servicos dos agendamentos" on public.appointment_services
  for select using ((select public.is_admin()));

create policy "dono insere servicos dos agendamentos" on public.appointment_services
  for insert with check ((select public.is_owner()));

create policy "dono atualiza servicos dos agendamentos" on public.appointment_services
  for update using ((select public.is_owner()));

create policy "dono remove servicos dos agendamentos" on public.appointment_services
  for delete using ((select public.is_owner()));

-- ------------------------------------------------------------
-- 5. Função de WhatsApp sessions (se existir — criada fora do app)
-- ------------------------------------------------------------
do $block$
declare
  fn regprocedure;
begin
  select to_regprocedure('public.set_whatsapp_sessions_updated_at()') into fn;
  if fn is not null then
    execute 'alter function public.set_whatsapp_sessions_updated_at() set search_path = public';
  end if;
end
$block$;
