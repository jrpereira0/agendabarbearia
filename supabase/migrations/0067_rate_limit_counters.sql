-- Rate limit da API pública em memória (Map por instância) se dilui em
-- serverless: cada instância da Vercel tem seu próprio contador, então o
-- limite de envio de OTP por WhatsApp (3/15min) na prática vira maior.
-- Move o contador pro banco (compartilhado entre instâncias).

create table if not exists public.rate_limit_counters (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create index if not exists rate_limit_counters_reset_at_idx
  on public.rate_limit_counters (reset_at);

alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from anon, authenticated;

-- Upsert atômico: incrementa (ou reinicia, se a janela expirou) e devolve
-- se ainda está dentro do limite. SECURITY DEFINER + search_path fixo,
-- só o servidor (service role) chama.
create or replace function public.check_rate_limit(
  p_key text,
  p_window_ms bigint,
  p_limit integer
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
  v_reset_at timestamptz;
begin
  -- Limpeza oportunista das linhas velhas (evita crescer pra sempre).
  if random() < 0.01 then
    delete from public.rate_limit_counters
    where reset_at < v_now - interval '1 day';
  end if;

  insert into public.rate_limit_counters (key, count, reset_at)
  values (p_key, 1, v_now + (p_window_ms::text || ' milliseconds')::interval)
  on conflict (key) do update
    set
      count = case
        when public.rate_limit_counters.reset_at <= v_now then 1
        else public.rate_limit_counters.count + 1
      end,
      reset_at = case
        when public.rate_limit_counters.reset_at <= v_now
          then v_now + (p_window_ms::text || ' milliseconds')::interval
        else public.rate_limit_counters.reset_at
      end
  returning count, reset_at into v_count, v_reset_at;

  if v_count > p_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_rate_limit(text, bigint, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, bigint, integer) to service_role;
