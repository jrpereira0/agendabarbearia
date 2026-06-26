-- Sessões de caixa por dia (abrir/fechar antes de fechar comandas).

create table public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  service_date date not null unique,
  status text not null default 'closed' check (status in ('open', 'closed')),
  opening_balance_cents integer not null default 0 check (opening_balance_cents >= 0),
  opened_at timestamptz,
  opened_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_register_open_fields check (
    (status = 'open' and opened_at is not null and closed_at is null)
    or (status = 'closed')
  )
);

create index cash_register_sessions_date_idx
  on public.cash_register_sessions (service_date desc);

alter table public.cash_register_sessions enable row level security;

create policy "dono gerencia caixa" on public.cash_register_sessions
  for all using ((select public.is_owner()));

-- Dias com comandas fechadas viram caixa fechado (histórico).
insert into public.cash_register_sessions (
  service_date,
  status,
  opening_balance_cents,
  closed_at
)
select
  c.service_date,
  'closed',
  0,
  max(c.closed_at)
from public.comandas c
where c.status = 'closed'
group by c.service_date
on conflict (service_date) do nothing;
