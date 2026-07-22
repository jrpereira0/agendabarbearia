-- Permite o mesmo serviço mais de uma vez no agendamento (ex.: 2 cortes).
alter table public.appointment_services
  add column if not exists quantity integer not null default 1
    check (quantity >= 1);

comment on column public.appointment_services.quantity is
  'Quantidade do mesmo serviço neste agendamento (mínimo 1).';
