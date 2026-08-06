-- Aperta leitura pública (role anon) que vazava colunas/tabelas sensíveis.
-- RLS filtra LINHAS, não colunas — então "active = true" sozinho não
-- impedia o anon de pedir email/comissão via /rest/v1 diretamente.

-- ------------------------------------------------------------
-- 1. professionals: anon só pode ler as colunas que o site público usa
--    (id, nickname, photo_url, photo_position, active). Antes lia a
--    linha inteira: email, whatsapp, commission_percent, profile_id,
--    instagram, flags can_*.
--    `authenticated` (dono/barbeiro/recepção logados) não muda.
-- ------------------------------------------------------------
revoke select on public.professionals from anon;
grant select (id, nickname, photo_url, photo_position, active)
  on public.professionals to anon;

-- ------------------------------------------------------------
-- 2. products / product_categories: não existe nenhuma tela pública que
--    leia essas tabelas (site/API só usam services + professionals).
--    Restringe a leitura a `authenticated` — some o acesso do anon a
--    comission_percent, stock_quantity e produtos/categorias inativos.
-- ------------------------------------------------------------
drop policy if exists "leitura de categorias de produto" on public.product_categories;
create policy "leitura de categorias de produto" on public.product_categories
  for select to authenticated using (true);

drop policy if exists "leitura de produtos" on public.products;
create policy "leitura de produtos" on public.products
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- 3. schedule_blocks: cálculo de disponibilidade e agenda do painel usam
--    o client de service role (bypassa RLS) — não existe leitura pública
--    real. Remove a policy `using (true)` que expunha o campo `note`
--    (motivo do bloqueio) pro anon.
--    Dono e barbeiro continuam enxergando os próprios bloqueios pelas
--    policies "dono gerencia bloqueios" / "barbeiro gerencia os proprios
--    bloqueios" (FOR ALL), que já cobrem SELECT.
-- ------------------------------------------------------------
drop policy if exists "leitura publica de bloqueios" on public.schedule_blocks;
