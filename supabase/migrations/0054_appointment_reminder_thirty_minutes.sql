-- Lembrete adicional: 30 minutos antes do atendimento.
alter table public.appointment_reminders
  drop constraint appointment_reminders_type_check;

alter table public.appointment_reminders
  add constraint appointment_reminders_type_check
  check (
    reminder_type in (
      'one_hour_before',
      'thirty_minutes_before'
    )
  );
