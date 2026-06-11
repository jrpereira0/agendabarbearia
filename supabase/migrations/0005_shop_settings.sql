-- Configuracoes gerais da barbearia (linha unica).
-- slot_step_minutes: de quantos em quantos minutos a agenda oferece horarios.
create table public.shop_settings (
  id smallint primary key default 1 check (id = 1),
  slot_step_minutes smallint not null default 15
    check (slot_step_minutes in (5, 10, 15, 20, 30, 45, 60))
);

insert into public.shop_settings (id) values (1);

alter table public.shop_settings enable row level security;

create policy "leitura publica das configuracoes" on public.shop_settings
  for select using (true);
create policy "dono gerencia configuracoes" on public.shop_settings
  for all using (public.is_owner());
