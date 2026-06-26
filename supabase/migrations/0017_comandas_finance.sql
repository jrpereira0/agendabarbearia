-- Comandas (financeiro por atendimento), itens com preço editável e pagamentos mistos.

alter table public.professionals
  add column if not exists commission_percent smallint not null default 50;

alter table public.professionals
  drop constraint if exists professionals_commission_percent_check;

alter table public.professionals
  add constraint professionals_commission_percent_check
  check (commission_percent >= 0 and commission_percent <= 100);

create table public.comandas (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete restrict,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  commission_percent_snapshot smallint,
  total_cents integer not null default 0 check (total_cents >= 0),
  commission_cents integer not null default 0 check (commission_cents >= 0),
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comandas_closed_fields check (
    (status = 'open' and closed_at is null and commission_percent_snapshot is null)
    or (
      status = 'closed'
      and closed_at is not null
      and commission_percent_snapshot is not null
    )
  )
);

create index comandas_professional_closed_idx
  on public.comandas (professional_id, closed_at desc)
  where status = 'closed';

create index comandas_closed_at_idx
  on public.comandas (closed_at)
  where status = 'closed';

create table public.comanda_items (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references public.comandas (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null check (char_length(trim(service_name)) >= 1),
  catalog_price_cents integer not null check (catalog_price_cents >= 0),
  charged_price_cents integer not null check (charged_price_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index comanda_items_comanda_idx on public.comanda_items (comanda_id, sort_order);

create table public.comanda_payments (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references public.comandas (id) on delete cascade,
  payment_method text not null check (
    payment_method in ('pix', 'cash', 'debit', 'credit')
  ),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index comanda_payments_comanda_idx on public.comanda_payments (comanda_id);

alter table public.comandas enable row level security;
alter table public.comanda_items enable row level security;
alter table public.comanda_payments enable row level security;

-- Dono: tudo
create policy "dono gerencia comandas" on public.comandas
  for all using ((select public.is_owner()));

create policy "dono gerencia itens da comanda" on public.comanda_items
  for all using (
    exists (
      select 1 from public.comandas c
      where c.id = comanda_items.comanda_id
    )
    and (select public.is_owner())
  );

create policy "dono gerencia pagamentos da comanda" on public.comanda_payments
  for all using (
    exists (
      select 1 from public.comandas c
      where c.id = comanda_payments.comanda_id
    )
    and (select public.is_owner())
  );

-- Barbeiro: só leitura das próprias comandas
create policy "barbeiro le proprias comandas" on public.comandas
  for select using (
    exists (
      select 1 from public.professionals p
      where p.id = comandas.professional_id
        and p.profile_id = (select auth.uid())
    )
  );

create policy "barbeiro le itens das proprias comandas" on public.comanda_items
  for select using (
    exists (
      select 1 from public.comandas c
      join public.professionals p on p.id = c.professional_id
      where c.id = comanda_items.comanda_id
        and p.profile_id = (select auth.uid())
    )
  );

create policy "barbeiro le pagamentos das proprias comandas" on public.comanda_payments
  for select using (
    exists (
      select 1 from public.comandas c
      join public.professionals p on p.id = c.professional_id
      where c.id = comanda_payments.comanda_id
        and p.profile_id = (select auth.uid())
    )
  );
