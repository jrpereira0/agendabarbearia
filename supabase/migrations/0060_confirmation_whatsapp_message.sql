-- Mensagem de confirmação manual via WhatsApp (quando a IA não está ativa).
-- Tags: {{primeiro_nome}}, {{nome}}, {{barbeiro}}, {{data}}, {{hora}}, {{servicos}}, {{loja}}

alter table public.shop_settings
  add column if not exists confirmation_whatsapp_message text not null
  default 'Olá {{primeiro_nome}}! Confirmando seu horário na {{loja}}.

Data: {{data}} às {{hora}}
Serviço: {{servicos}}
Barbeiro: {{barbeiro}}

Te esperamos!';

comment on column public.shop_settings.confirmation_whatsapp_message is
  'Modelo da mensagem de confirmação enviada manualmente pelo WhatsApp no painel. Aceita tags {{primeiro_nome}}, {{nome}}, {{barbeiro}}, {{data}}, {{hora}}, {{servicos}}, {{loja}}.';
