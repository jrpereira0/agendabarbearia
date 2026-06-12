-- Clientes: somente o dono pode ler e gerenciar (barbeiros não veem)

drop policy if exists "admin le clientes" on public.customers;
