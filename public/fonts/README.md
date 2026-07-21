# Fontes da tela de login

A login espera estes arquivos em `public/fonts/`.
Enquanto não estiverem aí, o site usa Outfit como reserva (já carregada no app).

## Aeonik (textos do formulário / corpo)

Coloque em:

```
public/fonts/aeonik/
  Aeonik-Regular.woff2   (ou .woff)
```

Só a Regular é necessária. Se no futuro tiver Medium, dá para acrescentar.

## Neue Montreal (títulos)

Coloque em:

```
public/fonts/neue-montreal/
  NeueMontreal-Regular.woff2
  NeueMontreal-Medium.woff2
  NeueMontreal-Bold.woff2
```

Os nomes dos arquivos precisam bater com os listados acima
(ou ajuste o CSS em `src/components/admin/admin-login-theme.css`).

Depois de colar os arquivos, recarregue a página (`Ctrl+Shift+R`).
