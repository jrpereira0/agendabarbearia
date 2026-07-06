-- Corrige RLS: barbeiro conseguia ler agendamentos e serviços de TODOS os
-- profissionais (policy usava is_admin(), verdadeiro para dono e barbeiro).
-- Agora o barbeiro só lê os próprios agendamentos; o dono continua com
-- acesso total via "dono gerencia agendamentos" (appointments) e via a
-- condição is_owner() abaixo (appointment_services, que não tem policy
-- própria de ALL para o dono).

drop policy if exists "admin le agendamentos" on public.appointments;

create policy "barbeiro le os proprios agendamentos" on public.appointments
  for select using (
    exists (
      select 1 from public.professionals p
      where p.id = appointments.professional_id
        and p.profile_id = (select auth.uid())
    )
  );

drop policy if exists "leitura servicos dos agendamentos" on public.appointment_services;

create policy "leitura servicos dos agendamentos" on public.appointment_services
  for select using (
    (select public.is_owner())
    or exists (
      select 1
      from public.appointments a
      join public.professionals p on p.id = a.professional_id
      where a.id = appointment_services.appointment_id
        and p.profile_id = (select auth.uid())
    )
  );
