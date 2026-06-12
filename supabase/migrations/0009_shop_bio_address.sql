-- Bio da barbearia (antes tagline) e endereco estruturado com CEP.
alter table public.shop_settings rename column tagline to bio;

alter table public.shop_settings
  add column cep text not null default '',
  add column street text not null default '',
  add column address_number text not null default '',
  add column address_complement text not null default '',
  add column neighborhood text not null default '',
  add column city text not null default '',
  add column state text not null default '';
