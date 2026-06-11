-- Encaixe manual do painel: pode sobrepor outros agendamentos.
-- A regra de conflito continua valendo para agendamentos normais (site/API).

alter table public.appointments
  add column if not exists is_squeeze_in boolean not null default false;

alter table public.appointments drop constraint if exists appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tsrange((date + start_time), (date + end_time)) with &&
  )
  where (status = 'confirmed' and is_squeeze_in = false);
