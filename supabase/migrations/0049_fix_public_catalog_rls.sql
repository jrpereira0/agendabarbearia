-- Bug: a policy "admin le todos os X" (0046) não restringe o role e acaba
-- valendo pra anon também. Como toda policy permissiva aplicável precisa ser
-- avaliada (pra fazer o OR com as demais), o anon (site público) tenta
-- executar is_admin() e recebe "permission denied for function is_admin"
-- (revocado do anon em 0016/0044) — quebrando a leitura pública de
-- profissionais e serviços na agenda do cliente.
--
-- A policy "leitura de profissionais/serviços" (0016) já libera ver tudo
-- (ativo ou não) pra qualquer usuário logado com perfil — ou seja, ela já
-- cobre o motivo de existir da policy do 0046. Então em vez de restringir
-- por role, removemos a policy redundante e quebrada.

drop policy if exists "admin le todos os profissionais" on public.professionals;
drop policy if exists "admin le todos os servicos" on public.services;
