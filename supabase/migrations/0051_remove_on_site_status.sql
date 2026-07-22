-- Remove o status "no local" (on_site).
-- Agendamentos existentes passam para "confirmado".

alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments drop constraint if exists appointments_status_check;

update public.appointments
set status = 'confirmed'
where status = 'on_site';

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'cancelled', 'done'));

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tsrange((date + start_time), (date + end_time)) with &&
  )
  where (
    status in ('scheduled', 'confirmed')
    and is_squeeze_in = false
  );
