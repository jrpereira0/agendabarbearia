-- Responsável explícito na abertura do caixa.

alter table public.cash_register_sessions
  add column if not exists responsible_name text;

update public.cash_register_sessions crs
set responsible_name = p.full_name
from public.profiles p
where crs.opened_by = p.id
  and crs.responsible_name is null
  and p.full_name is not null;
