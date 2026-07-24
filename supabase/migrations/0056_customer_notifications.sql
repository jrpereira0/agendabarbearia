-- Caixa de notificações do cliente no app (lidas / não lidas).
create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  title text not null,
  body text not null,
  type text not null default 'general',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_notifications_whatsapp_created_idx
  on public.customer_notifications (whatsapp, created_at desc);

create index customer_notifications_whatsapp_unread_idx
  on public.customer_notifications (whatsapp)
  where read_at is null;

alter table public.customer_notifications enable row level security;
-- Sem policies: só service role (API).
