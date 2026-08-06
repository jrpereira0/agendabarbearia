-- Permite ativar/pausar a IA por conversa via /api/v1/ai-status (chave de
-- API com escopo ai_status:*), em vez de credencial direta do Postgres no
-- n8n. A tabela dinho_ai_status continua sem acesso via RLS a
-- anon/authenticated; só a rota da API (service role) e a policy abaixo lêem.

-- Guarda a resposta de mutações da API quando o chamador envia um header
-- Idempotency-Key, evitando duplicar a ação (ex.: agendamento) em um retry
-- de rede do app ou do n8n.
create table public.api_idempotency_keys (
  dedupe_key text primary key,
  request_hash text not null,
  response_status smallint not null,
  response_body jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.api_idempotency_keys is
  'Respostas de mutações da API guardadas por alguns dias por Idempotency-Key, pra não repetir a ação em um retry. Só service role.';

create index api_idempotency_keys_created_at_idx
  on public.api_idempotency_keys (created_at);

alter table public.api_idempotency_keys enable row level security;

revoke all on table public.api_idempotency_keys from anon, authenticated;

drop policy if exists "sem acesso via api" on public.api_idempotency_keys;
create policy "sem acesso via api" on public.api_idempotency_keys
  for all
  to anon, authenticated
  using (false)
  with check (false);
