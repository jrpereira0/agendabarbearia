-- Cadastro de clientes (separado dos agendamentos)

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_whatsapp_unique unique (whatsapp)
);

create index customers_whatsapp_idx on public.customers (whatsapp);
create index customers_name_idx on public.customers (last_name, first_name);

alter table public.appointments
  add column customer_id uuid references public.customers (id) on delete set null;

-- Importa clientes do histórico de agendamentos (nome mais recente por WhatsApp)
insert into public.customers (first_name, last_name, whatsapp, created_at, updated_at)
select distinct on (customer_whatsapp)
  customer_first_name,
  customer_last_name,
  customer_whatsapp,
  created_at,
  created_at
from public.appointments
order by customer_whatsapp, created_at desc;

update public.appointments a
set customer_id = c.id
from public.customers c
where a.customer_whatsapp = c.whatsapp;

alter table public.customers enable row level security;

create policy "admin le clientes" on public.customers
  for select using (public.is_admin());

create policy "dono gerencia clientes" on public.customers
  for all using (public.is_owner());
