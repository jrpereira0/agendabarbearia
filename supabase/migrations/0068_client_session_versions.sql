-- Permite "sair de todos os aparelhos": subir a versão da sessão de um
-- WhatsApp invalida todo cookie/accessToken já emitido (mesmo os de antes
-- desta migration, que valem como versão 0). Só service role (API).

create table public.client_session_versions (
  whatsapp text primary key,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.client_session_versions is
  'Versão da sessão do cliente por WhatsApp (login OTP). Sem registro = versão 0. Subir a versão invalida tokens/cookies antigos daquele WhatsApp.';

alter table public.client_session_versions enable row level security;

revoke all on table public.client_session_versions from anon, authenticated;

drop policy if exists "sem acesso via api" on public.client_session_versions;
create policy "sem acesso via api" on public.client_session_versions
  for all
  to anon, authenticated
  using (false)
  with check (false);
