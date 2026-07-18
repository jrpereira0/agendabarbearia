-- Status do atendimento por IA por conversa de WhatsApp.
-- session_id = telefone do cliente; ia_ativa indica se a IA responde
-- naquela conversa. Acessada apenas pelo service role (n8n / servidor).

create table public.dinho_ai_status (
  session_id text primary key,
  ia_ativa boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.dinho_ai_status is
  'Por conversa de WhatsApp (session_id = telefone): se a IA está ativa ou pausada.';

alter table public.dinho_ai_status enable row level security;

revoke all on table public.dinho_ai_status from anon, authenticated;

drop policy if exists "sem acesso via api" on public.dinho_ai_status;
create policy "sem acesso via api" on public.dinho_ai_status
  for all
  to anon, authenticated
  using (false)
  with check (false);
