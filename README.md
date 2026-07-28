# Dinho Barber Coffee

Sistema de agendamento online da **Dinho Barber Coffee**. Os clientes escolhem o profissional (**ou sem preferência**), os serviços e o horário disponível, confirmam o WhatsApp com um **código enviado no zap** e finalizam o agendamento. Os **preços dos serviços podem variar por dia da semana** (configurados no painel): no site, a lista de serviços mostra a **faixa de preço** antes de escolher o dia e o **valor exato** depois. Também podem consultar, remarcar ou cancelar horários futuros pela aba **Horários**, ver o endereço em **Local** e editar nome/sobrenome e **foto de perfil** na aba **Conta** (página `/agenda`, mesmo login por código), e recebem um **lembrete automático** perto do horário (via automação de WhatsApp). A barbearia gerencia profissionais, serviços, clientes, **produtos** (estoque com entrada/saída registrada, **histórico de vendas** e relatório financeiro só de produtos), **comandas unificadas por cliente/dia** (fechamento com pagamento misto, **crédito do cliente**, comissão por barbeiro e venda de produto **com ou sem** profissional), **venda rápida** de produto sem cliente/horário (geladeira/avulso) e **caixa do dia** (abrir/fechar por data; só finaliza comanda com caixa aberto; só encerra o caixa com comandas abertas resolvidas) por um painel administrativo. No painel, o **caixa do dia** opera na aba lateral da agenda (saldo em destaque, formas de pagamento e lista de comandas); o **histórico de caixas**, as **comissões** (filtro de período e **registro de pagamento** ao barbeiro) e o **painel financeiro** ficam em rotas próprias. Barbeiros com login próprio acessam **Minha conta** para ver a grade e trocar a senha. A comanda **abre e finaliza de forma imediata** na interface (dados da agenda na hora; salvamento em segundo plano). Cada agendamento guarda também sua **origem** (painel, site ou IA), mostrada como ícone discreto no card da agenda. Na grade do painel, o card pode ser **arrastado** (mouse ou caneta) para outro horário, outra coluna de barbeiro ou os dois: enquanto arrasta aparece o destino com o novo horário, a mudança entra na grade na hora e o servidor confirma em seguida (se o horário estiver ocupado, fora do expediente ou o barbeiro não fizer o serviço, o card volta ao lugar com um aviso). Em **Configurações → Mensagens**, o dono cadastra o texto de **confirmação no WhatsApp** com tags (`{{primeiro_nome}}`, `{{data}}`, `{{hora}}`, `{{servicos}}`, `{{barbeiro}}`, `{{loja}}` etc.); ao abrir o card do atendimento e clicar em **Confirmar no WhatsApp**, o app abre o zap já com a mensagem preenchida para o cliente. Toda a funcionalidade também é exposta por uma API REST em `/api/v1` (rotas públicas para catálogo/horários e rotas privadas com chave de API ou sessão OTP do cliente) para automações como agendamento via WhatsApp com IA. Guias: [docs/api/guia-n8n.md](docs/api/guia-n8n.md) (agenda), [docs/api/cliente-otp-whatsapp.md](docs/api/cliente-otp-whatsapp.md) (login por código), [docs/api/financeiro.md](docs/api/financeiro.md) (comandas e caixa) e [docs/openapi/v1.yaml](docs/openapi/v1.yaml) (OpenAPI — também no painel em Integrações → Documentação da API).

## Tecnologias

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL, Auth e Storage)
- Zod (validação)

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Crie um projeto no [supabase.com](https://supabase.com), copie `.env.example` para `.env.local` e preencha as chaves:

```bash
cp .env.example .env.local
```

3. Rode o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para entrar no painel. O link de agendamento para clientes fica em `/agenda`.

A prévia do link no WhatsApp (título, descrição e imagem) usa o nome, a bio e a logo cadastrados em **Configurações**. Depois de publicar uma mudança nessa prévia, o WhatsApp pode continuar mostrando a versão antiga por um tempo. Para forçar a atualização, abra o [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), cole a URL de `/agenda` e clique em **Scrape Again**.

## Publicar na Vercel

No painel da Vercel, abra **Settings → Environment Variables** e cadastre as chaves abaixo (copie os mesmos valores do `.env.local`):

| Variável | Para quê |
|---|---|
| `SUPABASE_URL` | Servidor (mesmo valor da URL do projeto) |
| `SUPABASE_ANON_KEY` | Servidor (chave publishable/anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | API e ações do painel |
| `NEXT_PUBLIC_SUPABASE_URL` | Login no navegador (mesmo valor de `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login no navegador (mesmo valor de `SUPABASE_ANON_KEY`) |
| `CLIENT_SESSION_SECRET` | **Obrigatória** — assina a sessão do cliente (cookie no site + `accessToken` no app) após o código WhatsApp (gere uma string aleatória de 32+ caracteres) |

Opcionais (só quem usa a funcionalidade correspondente):

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública do site (prévia do WhatsApp/Open Graph). Se omitir na Vercel, usa `VERCEL_URL` |
| `DATABASE_URL` | Rodar `npm run db:migrate` (não precisa na Vercel, só localmente) |
| `N8N_APPOINTMENT_WEBHOOK_URL` | Avisa o barbeiro (webhook n8n) quando um agendamento é **criado**, **cancelado** ou **alterado** — ver [docs/api/guia-n8n.md](docs/api/guia-n8n.md#6b-webhook-aviso-automático-ao-barbeiro-appointmentcreated) |
| `N8N_APPOINTMENT_WEBHOOK_SECRET` | Segredo do webhook acima (header `x-appointment-webhook-secret`) |
| `N8N_CLIENT_OTP_WEBHOOK_URL` | Envia o **código de login** do cliente no WhatsApp — ver [docs/api/cliente-otp-whatsapp.md](docs/api/cliente-otp-whatsapp.md) |
| `N8N_CLIENT_OTP_WEBHOOK_SECRET` | Segredo do webhook OTP (header `x-client-otp-webhook-secret`) |
| `N8N_CLIENT_APPOINTMENT_WEBHOOK_URL` | Opcional. Avisos ao cliente quando o admin altera/cancela. Se vazio, usa a URL do OTP |
| `N8N_CLIENT_APPOINTMENT_WEBHOOK_SECRET` | Opcional. Segredo dos avisos de agendamento ao cliente |

Automações externas (n8n) usam **chaves de API** geradas no painel em **Configurações > Integrações**, não uma variável de ambiente.

Marque **Production**, **Preview** e **Development**.

### Região das Functions (importante para velocidade)

O projeto usa `vercel.json` com região **`gru1` (São Paulo)**, alinhada ao Supabase em `sa-east-1`. Assim, salvar/editar na produção não precisa ir até os EUA e voltar a cada ação.

Confira também em **Settings → Functions → Function Region** se está em São Paulo. Se o seu Supabase estiver em outra região, ajuste `regions` no `vercel.json` para a região Vercel mais próxima do banco.

Depois de salvar, faça **Deployments → Redeploy** e desmarque **Use existing Build Cache** para forçar um build novo com as chaves.

Sem isso o site abre sem dados da barbearia e o painel mostra erro de Supabase não configurado.

## Comandos úteis

```bash
npm run dev           # roda o site em localhost:3000
npm run db:migrate    # aplica mudanças pendentes no banco
npm run db:migrate-weekday-prices  # migra serviços legados para preço por dia (após db:migrate)
npm run db:reset-shop   # zera dados operacionais; mantém login e profissionais
npm run create-admin  # cria usuário do painel: -- email senha "Nome"
npm run lint          # checa o código com o ESLint
npm run typecheck     # checa os tipos com o TypeScript
npm run test          # roda os testes automatizados (vitest)
```

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — como o sistema é organizado, tabelas do banco e permissões
- [docs/api/README.md](docs/api/README.md) — índice da documentação da API
- [docs/api/app-mobile.md](docs/api/app-mobile.md) — contrato pra app do cliente
- [docs/openapi/v1.yaml](docs/openapi/v1.yaml) — especificação OpenAPI (também no painel: Integrações → Documentação da API)
- [docs/api/guia-n8n.md](docs/api/guia-n8n.md) — guia para automação no WhatsApp (n8n)
- [docs/api/financeiro.md](docs/api/financeiro.md) — regras de comandas, caixa e comissões (painel)
