-- Papel de recepção: opera a agenda de todos, sem financeiro/cadastros.

-- 1) Amplia o check de role em profiles
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'barber', 'reception'));

-- 2) Helper espelhando is_owner
create or replace function public.is_reception()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'reception'
  );
$$;

revoke all on function public.is_reception() from public;
grant execute on function public.is_reception() to authenticated;

comment on function public.is_reception() is
  'True quando o usuário logado é recepção (vê agenda de todos, sem financeiro).';

-- 3) Recepção lê todos os agendamentos (como o dono na prática da grade)
drop policy if exists "barbeiro le os proprios agendamentos" on public.appointments;
drop policy if exists "dono le todos agendamentos" on public.appointments;
drop policy if exists "agenda le agendamentos" on public.appointments;

create policy "agenda le agendamentos" on public.appointments
  for select using (
    (select public.is_owner())
    or (select public.is_reception())
    or exists (
      select 1 from public.professionals p
      where p.id = appointments.professional_id
        and p.profile_id = (select auth.uid())
    )
  );

-- 4) Serviços do agendamento: mesma regra
drop policy if exists "leitura servicos dos agendamentos" on public.appointment_services;

create policy "leitura servicos dos agendamentos" on public.appointment_services
  for select using (
    (select public.is_owner())
    or (select public.is_reception())
    or exists (
      select 1
      from public.appointments a
      join public.professionals p on p.id = a.professional_id
      where a.id = appointment_services.appointment_id
        and p.profile_id = (select auth.uid())
    )
  );

-- 5) Bloqueios de horário: recepção vê/gerencia como o dono na agenda
-- (policies existentes de schedule_blocks usam is_owner / próprio barbeiro;
--  se houver select restrito, amplia aqui se necessário)
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_blocks'
      and policyname = 'barbeiro gerencia bloqueios'
  ) then
    -- deixa a policy do barbeiro; dono já tem ALL; adiciona leitura/escrita recepção
    null;
  end if;
end $$;

drop policy if exists "recepcao gerencia bloqueios" on public.schedule_blocks;
create policy "recepcao gerencia bloqueios" on public.schedule_blocks
  for all using ((select public.is_reception()))
  with check ((select public.is_reception()));
