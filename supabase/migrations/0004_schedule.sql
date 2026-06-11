-- Horario de funcionamento da barbearia, excecoes por data e ajuste
-- de permissao: somente o dono gerencia horarios.

-- ------------------------------------------------------------
-- Horario semanal da barbearia (teto de todos os barbeiros)
-- weekday: 0 = domingo ... 6 = sabado
-- ------------------------------------------------------------
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,
  active boolean not null default true,
  check (open_time < close_time)
);

-- Semente: seg a sab 09:00-19:00, domingo fechado (o dono ajusta no painel)
insert into public.business_hours (weekday, open_time, close_time, active)
values
  (0, '09:00', '19:00', false),
  (1, '09:00', '19:00', true),
  (2, '09:00', '19:00', true),
  (3, '09:00', '19:00', true),
  (4, '09:00', '19:00', true),
  (5, '09:00', '19:00', true),
  (6, '09:00', '19:00', true);

-- ------------------------------------------------------------
-- Excecoes por data: feriado, dia estendido, folga pontual etc.
-- professional_id null = vale para a barbearia inteira.
-- ------------------------------------------------------------
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  professional_id uuid references public.professionals (id) on delete cascade,
  kind text not null check (kind in ('closed', 'custom')),
  start_time time,
  end_time time,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (
    kind = 'closed'
    or (start_time is not null and end_time is not null and start_time < end_time)
  )
);

create index schedule_exceptions_date_idx
  on public.schedule_exceptions (date);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.business_hours enable row level security;
alter table public.schedule_exceptions enable row level security;

create policy "leitura publica do horario da barbearia" on public.business_hours
  for select using (true);
create policy "dono gerencia horario da barbearia" on public.business_hours
  for all using (public.is_owner());

create policy "leitura publica de excecoes" on public.schedule_exceptions
  for select using (true);
create policy "dono gerencia excecoes" on public.schedule_exceptions
  for all using (public.is_owner());

-- Somente o dono gerencia a grade semanal dos barbeiros
drop policy "barbeiro gerencia a propria grade" on public.working_hours;
