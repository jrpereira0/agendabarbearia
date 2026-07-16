-- Linter 0008 (INFO): RLS ligado sem policy.
-- Nessas tabelas o acesso via API (anon/authenticated) deve continuar
-- bloqueado; só o service role (servidor) usa. Policies com USING (false)
-- documentam isso e silenciam o advisor, sem abrir permissão.

-- ------------------------------------------------------------
-- _migrations (controle interno do app)
-- ------------------------------------------------------------
revoke all on table public._migrations from anon, authenticated;

drop policy if exists "sem acesso via api" on public._migrations;
create policy "sem acesso via api" on public._migrations
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ------------------------------------------------------------
-- appointment_notifications (webhooks / n8n — só servidor)
-- ------------------------------------------------------------
revoke all on table public.appointment_notifications from anon, authenticated;

drop policy if exists "sem acesso via api" on public.appointment_notifications;
create policy "sem acesso via api" on public.appointment_notifications
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ------------------------------------------------------------
-- appointment_reminders (lembretes — só servidor)
-- ------------------------------------------------------------
revoke all on table public.appointment_reminders from anon, authenticated;

drop policy if exists "sem acesso via api" on public.appointment_reminders;
create policy "sem acesso via api" on public.appointment_reminders
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ------------------------------------------------------------
-- Tabelas criadas fora do app (integrações) — se existirem
-- ------------------------------------------------------------
do $block$
begin
  if to_regclass('public.dinho_ai_chat_memory') is not null then
    execute 'revoke all on table public.dinho_ai_chat_memory from anon, authenticated';
    execute 'drop policy if exists "sem acesso via api" on public.dinho_ai_chat_memory';
    execute $policy$
      create policy "sem acesso via api" on public.dinho_ai_chat_memory
        for all
        to anon, authenticated
        using (false)
        with check (false)
    $policy$;
  end if;

  if to_regclass('public.whatsapp_sessions') is not null then
    execute 'alter table public.whatsapp_sessions enable row level security';
    execute 'revoke all on table public.whatsapp_sessions from anon, authenticated';
    execute 'drop policy if exists "sem acesso via api" on public.whatsapp_sessions';
    execute $policy$
      create policy "sem acesso via api" on public.whatsapp_sessions
        for all
        to anon, authenticated
        using (false)
        with check (false)
    $policy$;
  end if;
end
$block$;
