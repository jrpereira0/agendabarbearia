-- Ponto focal da foto (CSS object-position), para ajustar o enquadramento na exibição.

alter table public.professionals
  add column if not exists photo_position text not null default '50% 50%';

alter table public.services
  add column if not exists photo_position text not null default '50% 50%';

alter table public.products
  add column if not exists photo_position text not null default '50% 50%';
