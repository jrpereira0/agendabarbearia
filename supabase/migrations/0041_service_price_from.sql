-- Serviços com preço variável no atendimento (ex.: progressiva por tamanho do cabelo).
-- O valor cadastrado é referência mínima; na vitrine aparece "a partir de".

alter table public.services
  add column price_from boolean not null default false;

comment on column public.services.price_from is
  'Quando true, o preço exibido ao cliente é referência mínima (a partir de).';
