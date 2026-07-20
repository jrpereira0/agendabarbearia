-- Origem do agendamento na agenda (ícone no card: admin / site / IA).
alter table public.appointments
  add column if not exists booking_source text;

comment on column public.appointments.booking_source is
  'Origem: admin | site | ai. Null em registros antigos sem origem conhecida.';

-- Backfill a partir do webhook de criação (quando existir).
update public.appointments a
set booking_source = case n.source
  when 'admin_agenda' then 'admin'
  when 'admin_squeeze_in' then 'admin'
  when 'comanda_extra' then 'admin'
  when 'public_api' then 'site'
  else a.booking_source
end
from public.appointment_notifications n
where n.appointment_id = a.id
  and n.event = 'appointment.created'
  and a.booking_source is null
  and n.source is not null;

-- Encaixe / serviço extra sem notificação ainda → painel.
update public.appointments
set booking_source = 'admin'
where booking_source is null
  and (is_squeeze_in = true or is_comanda_extra = true);
