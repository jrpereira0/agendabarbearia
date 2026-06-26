-- Motivo e data do cancelamento (admin e histórico).

alter table public.appointments
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;
