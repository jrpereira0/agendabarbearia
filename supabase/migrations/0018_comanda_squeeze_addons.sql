-- Serviços extras da comanda aparecem na agenda como encaixe (card ao lado do principal).

alter table public.comanda_items
  add column if not exists squeeze_appointment_id uuid
  references public.appointments (id) on delete set null;

create index if not exists comanda_items_squeeze_appointment_idx
  on public.comanda_items (squeeze_appointment_id)
  where squeeze_appointment_id is not null;
