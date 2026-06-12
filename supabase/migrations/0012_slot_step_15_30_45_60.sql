-- Intervalo da agenda: apenas 15, 30, 45 ou 60 minutos.
update public.shop_settings
set slot_step_minutes = 15
where slot_step_minutes not in (15, 30, 45, 60);

alter table public.shop_settings
  drop constraint if exists shop_settings_slot_step_minutes_check;

alter table public.shop_settings
  add constraint shop_settings_slot_step_minutes_check
  check (slot_step_minutes in (15, 30, 45, 60));
