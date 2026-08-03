-- Despesas da barbearia (saídas de caixa) e despesas fixas recorrentes.

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  payment_method text not null check (
    payment_method in ('pix', 'cash', 'debit', 'credit')
  ),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  -- Meses (formato 'AAAA-MM') em que o dono excluiu a ocorrência manualmente,
  -- pra não gerar de novo nas próximas cargas.
  skip_months text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_description_trim check (char_length(trim(description)) >= 1),
  constraint recurring_expenses_date_range_check check (end_date is null or end_date >= start_date)
);

create index recurring_expenses_active_idx
  on public.recurring_expenses (active);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  payment_method text not null check (
    payment_method in ('pix', 'cash', 'debit', 'credit')
  ),
  expense_date date not null,
  recurring_expense_id uuid references public.recurring_expenses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_description_trim check (char_length(trim(description)) >= 1)
);

create index expenses_date_idx
  on public.expenses (expense_date desc);

create unique index expenses_recurring_date_unique
  on public.expenses (recurring_expense_id, expense_date)
  where recurring_expense_id is not null;

alter table public.recurring_expenses enable row level security;
alter table public.expenses enable row level security;

create policy "dono gerencia despesas fixas" on public.recurring_expenses
  for all using ((select public.is_owner()));

create policy "dono gerencia despesas" on public.expenses
  for all using ((select public.is_owner()));
