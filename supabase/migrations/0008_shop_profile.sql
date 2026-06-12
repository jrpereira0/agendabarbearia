-- Perfil publico da barbearia (pagina /agenda).
alter table public.shop_settings
  add column shop_name text not null default '',
  add column tagline text not null default '',
  add column address text not null default '',
  add column whatsapp text not null default '',
  add column instagram text,
  add column logo_url text;
