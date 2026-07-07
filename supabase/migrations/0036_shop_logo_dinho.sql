-- Logo padrão da Dinho Barber Coffee (arquivo em /public/logodinho.png)
UPDATE shop_settings
SET logo_url = '/logodinho.png'
WHERE logo_url IS NULL
   OR trim(logo_url) = '';
