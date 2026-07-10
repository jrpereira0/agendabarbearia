-- Produtos, categorias e itens de produto na comanda.

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint product_categories_name_trim check (char_length(trim(name)) >= 1),
  constraint product_categories_name_unique unique (name)
);

create index product_categories_sort_idx
  on public.product_categories (sort_order, name);

insert into public.product_categories (name, sort_order)
values
  ('Produtos', 0),
  ('Geladeira', 1);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories (id) on delete restrict,
  name text not null,
  description text not null default '',
  photo_url text,
  price_cents integer not null check (price_cents >= 0),
  commission_percent smallint not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_trim check (char_length(trim(name)) >= 1),
  constraint products_commission_percent_check
    check (commission_percent >= 0 and commission_percent <= 100)
);

create index products_category_active_idx
  on public.products (category_id, active, name);

alter table public.comanda_items
  add column if not exists product_id uuid references public.products (id) on delete set null,
  add column if not exists quantity integer not null default 1,
  add column if not exists commission_percent_snapshot smallint;

alter table public.comanda_items
  drop constraint if exists comanda_items_quantity_check;

alter table public.comanda_items
  add constraint comanda_items_quantity_check check (quantity >= 1);

alter table public.comanda_items
  drop constraint if exists comanda_items_commission_percent_snapshot_check;

alter table public.comanda_items
  add constraint comanda_items_commission_percent_snapshot_check
  check (
    commission_percent_snapshot is null
    or (commission_percent_snapshot >= 0 and commission_percent_snapshot <= 100)
  );

alter table public.comanda_items
  drop constraint if exists comanda_items_kind_check;

alter table public.comanda_items
  add constraint comanda_items_kind_check check (
    (
      is_tip = true
      and product_id is null
      and service_id is null
    )
    or (
      is_tip = false
      and product_id is not null
      and service_id is null
    )
    or (
      is_tip = false
      and product_id is null
      and service_id is not null
    )
  );

create index comanda_items_product_idx
  on public.comanda_items (product_id)
  where product_id is not null;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;

create policy "leitura de categorias de produto" on public.product_categories
  for select using (true);

create policy "dono insere categorias de produto" on public.product_categories
  for insert with check (public.is_owner());

create policy "dono atualiza categorias de produto" on public.product_categories
  for update using (public.is_owner());

create policy "dono remove categorias de produto" on public.product_categories
  for delete using (public.is_owner());

create policy "leitura de produtos" on public.products
  for select using (true);

create policy "dono insere produtos" on public.products
  for insert with check (public.is_owner());

create policy "dono atualiza produtos" on public.products
  for update using (public.is_owner());

create policy "dono remove produtos" on public.products
  for delete using (public.is_owner());
