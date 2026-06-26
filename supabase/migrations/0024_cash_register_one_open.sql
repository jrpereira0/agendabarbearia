-- Só um caixa aberto por vez na barbearia.

create unique index if not exists cash_register_one_open_idx
  on public.cash_register_sessions ((true))
  where status = 'open';
