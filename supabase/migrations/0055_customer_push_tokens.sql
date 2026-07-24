-- Tokens Expo Push do app do cliente (lembretes e avisos de alteração).
create table public.customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  expo_push_token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_push_tokens_token_key unique (expo_push_token)
);

create index customer_push_tokens_whatsapp_idx
  on public.customer_push_tokens (whatsapp);

alter table public.customer_push_tokens enable row level security;
-- Sem policies: só service role (API) acessa.
