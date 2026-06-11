-- Bloqueios pontuais na agenda: impedem agendamento normal e na API publica.
-- Encaixe manual ainda pode usar o horario.

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create index schedule_blocks_date_prof_idx
  on public.schedule_blocks (date, professional_id);

alter table public.schedule_blocks enable row level security;

create policy "leitura publica de bloqueios" on public.schedule_blocks
  for select using (true);

create policy "dono gerencia bloqueios" on public.schedule_blocks
  for all using (public.is_owner());

create policy "barbeiro gerencia os proprios bloqueios" on public.schedule_blocks
  for all using (
    exists (
      select 1 from public.professionals p
      where p.id = schedule_blocks.professional_id
        and p.profile_id = auth.uid()
    )
  );
