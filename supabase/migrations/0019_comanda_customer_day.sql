-- Comanda unificada por cliente no dia (vários barbeiros / agendamentos).

alter table public.comandas
  add column if not exists customer_whatsapp text,
  add column if not exists service_date date;

update public.comandas c
set
  customer_whatsapp = a.customer_whatsapp,
  service_date = a.date
from public.appointments a
where a.id = c.appointment_id
  and (c.customer_whatsapp is null or c.service_date is null);

alter table public.comandas
  alter column customer_whatsapp set not null,
  alter column service_date set not null;

create table if not exists public.comanda_appointments (
  comanda_id uuid not null references public.comandas (id) on delete cascade,
  appointment_id uuid not null unique references public.appointments (id) on delete restrict,
  primary key (comanda_id, appointment_id)
);

insert into public.comanda_appointments (comanda_id, appointment_id)
select id, appointment_id
from public.comandas
where appointment_id is not null
on conflict (appointment_id) do nothing;

alter table public.comanda_items
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists professional_id uuid references public.professionals (id) on delete set null;

alter table public.comandas
  drop constraint if exists comandas_appointment_id_key;

-- Une comandas abertas duplicadas do mesmo cliente no mesmo dia (dados antigos).
do $$
declare
  rec record;
  primary_id uuid;
  dup_id uuid;
begin
  for rec in
    select customer_whatsapp, service_date
    from public.comandas
    where status = 'open'
    group by customer_whatsapp, service_date
    having count(*) > 1
  loop
    select id into primary_id
    from public.comandas
    where status = 'open'
      and customer_whatsapp = rec.customer_whatsapp
      and service_date = rec.service_date
    order by created_at asc
    limit 1;

    for dup_id in
      select id
      from public.comandas
      where status = 'open'
        and customer_whatsapp = rec.customer_whatsapp
        and service_date = rec.service_date
        and id <> primary_id
    loop
      insert into public.comanda_appointments (comanda_id, appointment_id)
      select primary_id, appointment_id
      from public.comanda_appointments
      where comanda_id = dup_id
      on conflict (appointment_id) do nothing;

      insert into public.comanda_appointments (comanda_id, appointment_id)
      select primary_id, appointment_id
      from public.comandas
      where id = dup_id
        and appointment_id is not null
      on conflict (appointment_id) do nothing;

      update public.comanda_items
      set comanda_id = primary_id
      where comanda_id = dup_id;

      update public.comanda_payments
      set comanda_id = primary_id
      where comanda_id = dup_id;

      delete from public.comanda_appointments where comanda_id = dup_id;
      delete from public.comandas where id = dup_id;
    end loop;
  end loop;
end $$;

create unique index if not exists comandas_open_customer_day_idx
  on public.comandas (customer_whatsapp, service_date)
  where status = 'open';

alter table public.comandas enable row level security;

create policy "dono gerencia comanda_appointments" on public.comanda_appointments
  for all using ((select public.is_owner()));

create policy "barbeiro le comanda_appointments das proprias" on public.comanda_appointments
  for select using (
    exists (
      select 1
      from public.appointments a
      join public.professionals p on p.id = a.professional_id
      where a.id = comanda_appointments.appointment_id
        and p.profile_id = (select auth.uid())
    )
  );
