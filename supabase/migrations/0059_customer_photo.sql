-- Foto de perfil do cliente (aba Conta no /agenda).

alter table public.customers
  add column if not exists photo_url text;

alter table public.customers
  add column if not exists photo_position text not null default '50% 50%';
