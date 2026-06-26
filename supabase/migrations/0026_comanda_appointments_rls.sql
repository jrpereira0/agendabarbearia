-- Security Advisor: comanda_appointments tinha políticas mas RLS desligado.
-- Alinha leitura do barbeiro com comandas unificadas (vários profissionais no dia).

alter table public.comanda_appointments enable row level security;

revoke all on table public.comanda_appointments from anon;

-- ---------------------------------------------------------------------------
-- Barbeiro: leitura quando participa da comanda (principal, item ou atendimento)
-- ---------------------------------------------------------------------------

drop policy if exists "barbeiro le proprias comandas" on public.comandas;
create policy "barbeiro le proprias comandas" on public.comandas
  for select using (
    exists (
      select 1
      from public.professionals p
      where p.profile_id = (select auth.uid())
        and (
          p.id = comandas.professional_id
          or exists (
            select 1
            from public.comanda_items ci
            where ci.comanda_id = comandas.id
              and ci.professional_id = p.id
          )
          or exists (
            select 1
            from public.comanda_appointments ca
            join public.appointments a on a.id = ca.appointment_id
            where ca.comanda_id = comandas.id
              and a.professional_id = p.id
          )
        )
    )
  );

drop policy if exists "barbeiro le itens das proprias comandas" on public.comanda_items;
create policy "barbeiro le itens das proprias comandas" on public.comanda_items
  for select using (
    exists (
      select 1
      from public.professionals p
      where p.profile_id = (select auth.uid())
        and (
          comanda_items.professional_id = p.id
          or exists (
            select 1
            from public.comandas c
            where c.id = comanda_items.comanda_id
              and c.professional_id = p.id
          )
          or exists (
            select 1
            from public.comanda_appointments ca
            join public.appointments a on a.id = ca.appointment_id
            where ca.comanda_id = comanda_items.comanda_id
              and a.professional_id = p.id
          )
        )
    )
  );

drop policy if exists "barbeiro le pagamentos das proprias comandas" on public.comanda_payments;
create policy "barbeiro le pagamentos das proprias comandas" on public.comanda_payments
  for select using (
    exists (
      select 1
      from public.professionals p
      where p.profile_id = (select auth.uid())
        and exists (
          select 1
          from public.comandas c
          where c.id = comanda_payments.comanda_id
            and (
              c.professional_id = p.id
              or exists (
                select 1
                from public.comanda_items ci
                where ci.comanda_id = c.id
                  and ci.professional_id = p.id
              )
              or exists (
                select 1
                from public.comanda_appointments ca
                join public.appointments a on a.id = ca.appointment_id
                where ca.comanda_id = c.id
                  and a.professional_id = p.id
              )
            )
        )
    )
  );

drop policy if exists "barbeiro le comanda_appointments das proprias" on public.comanda_appointments;
create policy "barbeiro le comanda_appointments das proprias" on public.comanda_appointments
  for select using (
    exists (
      select 1
      from public.professionals p
      where p.profile_id = (select auth.uid())
        and (
          exists (
            select 1
            from public.appointments a
            where a.id = comanda_appointments.appointment_id
              and a.professional_id = p.id
          )
          or exists (
            select 1
            from public.comandas c
            where c.id = comanda_appointments.comanda_id
              and c.professional_id = p.id
          )
          or exists (
            select 1
            from public.comanda_items ci
            where ci.comanda_id = comanda_appointments.comanda_id
              and ci.professional_id = p.id
          )
        )
    )
  );
