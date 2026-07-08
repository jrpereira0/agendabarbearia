-- A tabela appointment_notifications (migration 0037) já garante idempotencia
-- do webhook appointment.created via chave primaria (appointment_id, event).
-- Aqui so adicionamos a origem do agendamento (source) para facilitar debug
-- de duplicidade e auditoria, sem precisar de uma tabela nova.
alter table public.appointment_notifications
  add column source text;
