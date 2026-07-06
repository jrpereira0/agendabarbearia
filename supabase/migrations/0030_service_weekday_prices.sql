-- Preço do serviço por dia da semana (0 = domingo ... 6 = sábado).
-- Só existem linhas nos dias em que o serviço é oferecido.

create table public.service_weekday_prices (
  service_id uuid not null references public.services (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  price_cents integer not null check (price_cents >= 0),
  primary key (service_id, weekday)
);

create index service_weekday_prices_weekday_idx
  on public.service_weekday_prices (weekday);

alter table public.service_weekday_prices enable row level security;

create policy "leitura publica de precos por dia" on public.service_weekday_prices
  for select using (
    exists (
      select 1 from public.services s
      where s.id = service_weekday_prices.service_id
        and s.active = true
    )
  );

create policy "dono gerencia precos por dia" on public.service_weekday_prices
  for all using ((select public.is_owner()))
  with check ((select public.is_owner()));
