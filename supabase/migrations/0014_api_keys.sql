-- Chaves de API para integrações externas (n8n, etc.).
-- Single-tenant: shop_id referencia shop_settings (sempre id = 1).

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  shop_id smallint not null default 1 references public.shop_settings (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  key_prefix text not null,
  secret_hash text not null,
  scopes text[] not null default '{}' check (array_length(scopes, 1) >= 1),
  active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint api_keys_prefix_format check (key_prefix ~ '^dbc_live_[a-z0-9]{12}$'),
  constraint api_keys_revoked_inactive check (
    revoked_at is null or active = false
  )
);

create unique index api_keys_key_prefix_idx on public.api_keys (key_prefix);
create index api_keys_shop_active_idx on public.api_keys (shop_id, active)
  where revoked_at is null;

alter table public.api_keys enable row level security;

-- Dono da barbearia: leitura sem expor secret_hash (coluna omitida nas queries do painel).
create policy "dono le chaves da barbearia" on public.api_keys
  for select using (public.is_owner() and shop_id = 1);

create policy "dono cria chaves da barbearia" on public.api_keys
  for insert with check (public.is_owner() and shop_id = 1);

create policy "dono atualiza chaves da barbearia" on public.api_keys
  for update using (public.is_owner() and shop_id = 1);

-- Sem DELETE: revogação via revoked_at + active = false.
