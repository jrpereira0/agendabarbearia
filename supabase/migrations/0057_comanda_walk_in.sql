-- Comanda de venda rápida (geladeira / avulso): sem cliente e sem horário.
-- is_walk_in é opcional (marca explícita); a app também trata
-- customer_whatsapp nulo como venda rápida.

alter table public.comandas
  add column if not exists is_walk_in boolean not null default false;

alter table public.comandas
  alter column customer_whatsapp drop not null;

alter table public.comandas
  alter column appointment_id drop not null;

alter table public.comandas
  alter column professional_id drop not null;

-- Várias vendas rápidas abertas no mesmo dia; clientes cadastrados
-- continuam com no máximo uma comanda aberta por WhatsApp/dia.
drop index if exists public.comandas_open_customer_day_idx;

create unique index comandas_open_customer_day_idx
  on public.comandas (customer_whatsapp, service_date)
  where status = 'open' and customer_whatsapp is not null;

-- Marca vendas rápidas já criadas (whatsapp nulo).
update public.comandas
set is_walk_in = true
where customer_whatsapp is null;
