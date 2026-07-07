-- Nome público da barbearia (painel, site e SEO)
UPDATE shop_settings
SET shop_name = 'Dinho Barber Coffee'
WHERE shop_name IS NULL
   OR trim(shop_name) = ''
   OR shop_name IN ('Barbearia', 'Agenda Barbearia');
