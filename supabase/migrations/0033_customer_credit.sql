-- Saldo de crédito por cliente e histórico de movimentações.

alter table public.customers
  add column if not exists credit_balance_cents integer not null default 0
    check (credit_balance_cents >= 0);

create table if not exists public.customer_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount_cents integer not null check (amount_cents <> 0),
  type text not null check (type in ('add', 'use')),
  payment_method text check (payment_method in ('pix', 'cash', 'debit', 'credit')),
  description text,
  comanda_id uuid references public.comandas (id) on delete set null,
  cash_register_session_id uuid references public.cash_register_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint customer_credit_transactions_add_fields check (
    type <> 'add'
    or (
      amount_cents > 0
      and (
        cash_register_session_id is null
        or payment_method is not null
      )
    )
  ),
  constraint customer_credit_transactions_use_fields check (
    type <> 'use'
    or (
      amount_cents < 0
      and payment_method is null
      and cash_register_session_id is null
    )
  )
);

create index customer_credit_transactions_customer_idx
  on public.customer_credit_transactions (customer_id, created_at desc);

create index customer_credit_transactions_cash_session_idx
  on public.customer_credit_transactions (cash_register_session_id)
  where type = 'add' and cash_register_session_id is not null;

alter table public.comanda_payments
  drop constraint if exists comanda_payments_payment_method_check;

alter table public.comanda_payments
  add constraint comanda_payments_payment_method_check
    check (payment_method in ('pix', 'cash', 'debit', 'credit', 'store_credit'));

alter table public.customer_credit_transactions enable row level security;

create policy "dono gerencia creditos" on public.customer_credit_transactions
  for all using ((select public.is_owner()));
