-- Lembretes automáticos para clientes (ex.: 1 hora antes do atendimento).
-- O n8n consulta os pendentes via API e marca envio/confirmação — sem Wait.
-- Acessada apenas pelo service role (server-side).
create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  reminder_type text not null default 'one_hour_before',
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  fail_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_reminders_type_check
    check (reminder_type in ('one_hour_before')),
  constraint appointment_reminders_status_check
    check (
      status in (
        'pending',
        'sent',
        'confirmed',
        'cancelled',
        'failed',
        'expired'
      )
    ),
  constraint appointment_reminders_appointment_type_key
    unique (appointment_id, reminder_type)
);

create index appointment_reminders_due_idx
  on public.appointment_reminders (scheduled_for)
  where status = 'pending';

alter table public.appointment_reminders enable row level security;

-- Sem policies: só o service role (usado no servidor) acessa esta tabela.
