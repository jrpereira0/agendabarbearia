-- Vincula comanda fechada à sessão de caixa em que foi finalizada.

alter table public.comandas
  add column if not exists cash_register_session_id uuid
    references public.cash_register_sessions (id) on delete set null;

create index if not exists comandas_cash_register_session_idx
  on public.comandas (cash_register_session_id)
  where cash_register_session_id is not null;
