-- Registro simples para evitar reenviar o mesmo evento de notificacao
-- (ex.: webhook do n8n avisando o barbeiro) duas vezes para o mesmo
-- agendamento. Acessada apenas pelo service role (server-side).
create table public.appointment_notifications (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  event text not null,
  sent_at timestamptz not null default now(),
  primary key (appointment_id, event)
);

alter table public.appointment_notifications enable row level security;

-- Sem policies: só o service role (usado no servidor) acessa esta tabela.
