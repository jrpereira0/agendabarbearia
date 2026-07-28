-- Recepção: lê clientes, histórico de crédito e comandas (sem gerenciar crédito).

create policy "recepcao le clientes" on public.customers
  for select using ((select public.is_reception()));

create policy "recepcao le creditos" on public.customer_credit_transactions
  for select using ((select public.is_reception()));

create policy "recepcao le comandas" on public.comandas
  for select using ((select public.is_reception()));

create policy "recepcao le pagamentos das comandas" on public.comanda_payments
  for select using ((select public.is_reception()));
