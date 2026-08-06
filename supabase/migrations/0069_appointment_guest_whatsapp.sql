-- Agendamento sem cadastro: nome na grade, WhatsApp opcional.
-- customer_id já era nullable; agora o WhatsApp também pode ficar nulo.

alter table public.appointments
  alter column customer_whatsapp drop not null;
