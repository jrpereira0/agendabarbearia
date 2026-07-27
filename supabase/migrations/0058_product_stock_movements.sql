-- Movimentações de estoque de produtos (venda, ajuste, compra, perda, inventário).

create table public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  delta integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  reason text not null check (
    reason in (
      'sale',
      'sale_reopen',
      'adjustment',
      'purchase',
      'loss',
      'inventory'
    )
  ),
  comanda_id uuid references public.comandas (id) on delete set null,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint product_stock_movements_delta_nonzero check (delta <> 0)
);

create index product_stock_movements_product_created_idx
  on public.product_stock_movements (product_id, created_at desc);

create index product_stock_movements_comanda_idx
  on public.product_stock_movements (comanda_id)
  where comanda_id is not null;

create index product_stock_movements_created_idx
  on public.product_stock_movements (created_at desc);

alter table public.product_stock_movements enable row level security;
-- Sem policies: só service role (admin API) acessa.
