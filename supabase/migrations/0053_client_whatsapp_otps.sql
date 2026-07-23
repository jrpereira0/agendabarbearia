-- Códigos OTP enviados por WhatsApp para login do cliente no site (/agenda).
-- Só o service role (servidor) acessa esta tabela.
create table public.client_whatsapp_otps (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint client_whatsapp_otps_whatsapp_check
    check (whatsapp ~ '^55\d{10,11}$'),
  constraint client_whatsapp_otps_attempts_check
    check (attempts >= 0 and attempts <= max_attempts)
);

create index client_whatsapp_otps_lookup_idx
  on public.client_whatsapp_otps (whatsapp, created_at desc);

create index client_whatsapp_otps_expires_idx
  on public.client_whatsapp_otps (expires_at)
  where consumed_at is null;

alter table public.client_whatsapp_otps enable row level security;

revoke all on table public.client_whatsapp_otps from anon, authenticated;

drop policy if exists "sem acesso via api" on public.client_whatsapp_otps;
create policy "sem acesso via api" on public.client_whatsapp_otps
  for all
  to anon, authenticated
  using (false)
  with check (false);
