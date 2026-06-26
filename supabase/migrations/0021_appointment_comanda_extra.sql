-- Serviço extra criado pela comanda (encaixe com horário/barbeiro escolhidos no caixa).
-- Diferente do encaixe manual (+ Encaixe na agenda).

alter table public.appointments
  add column if not exists is_comanda_extra boolean not null default false;

comment on column public.appointments.is_comanda_extra is
  'true quando o encaixe foi criado ao adicionar serviço na comanda; false para encaixe manual da agenda.';
