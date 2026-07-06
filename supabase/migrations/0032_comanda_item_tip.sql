-- Gorjeta na comanda: 100% vai para o barbeiro (comissão = valor integral).

alter table public.comanda_items
  add column if not exists is_tip boolean not null default false;
