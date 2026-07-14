-- Repasse de comissão aos barbeiros: marca itens como pagos para não entrar de novo.

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete restrict,
  period_from date not null,
  period_to date not null,
  amount_cents integer not null check (amount_cents > 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint commission_payouts_period_check check (period_from <= period_to)
);

create index commission_payouts_professional_paid_idx
  on public.commission_payouts (professional_id, paid_at desc);

create index commission_payouts_period_idx
  on public.commission_payouts (period_from, period_to);

create table public.commission_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.commission_payouts (id) on delete cascade,
  comanda_item_id uuid not null unique references public.comanda_items (id) on delete restrict,
  commission_cents integer not null check (commission_cents >= 0),
  created_at timestamptz not null default now()
);

create index commission_payout_items_payout_idx
  on public.commission_payout_items (payout_id);

alter table public.commission_payouts enable row level security;
alter table public.commission_payout_items enable row level security;

create policy "dono gerencia repasses de comissao"
  on public.commission_payouts
  for all using ((select public.is_owner()));

create policy "dono gerencia itens de repasse"
  on public.commission_payout_items
  for all using ((select public.is_owner()));

-- Barbeiro: só leitura dos próprios repasses
create policy "barbeiro le proprios repasses"
  on public.commission_payouts
  for select using (
    exists (
      select 1 from public.professionals p
      where p.id = commission_payouts.professional_id
        and p.profile_id = (select auth.uid())
    )
  );

create policy "barbeiro le itens dos proprios repasses"
  on public.commission_payout_items
  for select using (
    exists (
      select 1
      from public.commission_payouts pay
      join public.professionals p on p.id = pay.professional_id
      where pay.id = commission_payout_items.payout_id
        and p.profile_id = (select auth.uid())
    )
  );
