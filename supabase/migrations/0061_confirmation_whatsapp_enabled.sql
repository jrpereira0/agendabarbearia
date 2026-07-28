-- Liga/desliga a confirmação manual no WhatsApp (mensagem + botão no card).

alter table public.shop_settings
  add column if not exists confirmation_whatsapp_enabled boolean not null
  default true;

comment on column public.shop_settings.confirmation_whatsapp_enabled is
  'Quando true, mostra o botão Confirmar no WhatsApp no card do atendimento e abre o zap com a mensagem de confirmação.';
