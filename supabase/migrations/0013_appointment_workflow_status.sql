-- Fluxo da agenda: agendado, confirmado, no local, cancelado e atendido.

alter table public.appointments drop constraint if exists appointments_no_overlap;

alter table public.appointments drop constraint if exists appointments_status_check;

update public.appointments
set status = 'scheduled'
where status = 'confirmed';

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'on_site', 'cancelled', 'done'));

alter table public.appointments
  alter column status set default 'scheduled';

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tsrange((date + start_time), (date + end_time)) with &&
  )
  where (
    status in ('scheduled', 'confirmed', 'on_site')
    and is_squeeze_in = false
  );
