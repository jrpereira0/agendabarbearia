# Dinho Barber Coffee

Sistema de agendamento online da **Dinho Barber Coffee**. Os clientes escolhem o profissional, os serviços e o horário disponível, identificam-se pelo WhatsApp e confirmam o agendamento. Os **preços dos serviços podem variar por dia da semana** (configurados no painel): no site, a lista de serviços mostra a **faixa de preço** antes de escolher o dia e o **valor exato** depois. Também podem consultar, remarcar ou cancelar horários futuros pela aba **Meus horários** na página `/agenda`. A barbearia gerencia profissionais, serviços, clientes, **comandas unificadas por cliente/dia** (fechamento com pagamento misto e comissão por barbeiro) e **caixa do dia** (abrir/fechar por data; só finaliza comanda com caixa aberto) por um painel administrativo. No painel, o **caixa do dia** pode ser operado na aba lateral da agenda; o **histórico de caixas** (com **página de detalhes por dia**: entradas, formas de pagamento e comandas), as **comissões** (com filtro de período e **registro de pagamento** ao barbeiro — o que foi pago não entra de novo) e o **painel financeiro** (visão geral enxuta + detalhe por métrica: faturamento, caixa, ticket, serviços e comissões) ficam em rotas próprias. Toda a funcionalidade também é exposta por uma API REST em `/api/v1` (rotas públicas para agendar e rotas privadas com chave de API para consultas sensíveis e financeiro) para automações como agendamento via WhatsApp com IA. Guias: [docs/API-N8N.md](docs/API-N8N.md) (agenda) e [docs/API-FINANCE.md](docs/API-FINANCE.md) (comandas e caixa).

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

## Publicar na Vercel

No painel da Vercel, abra **Settings → Environment Variables** e cadastre as chaves abaixo (copie os mesmos valores do `.env.local`):

| Variável | Para quê |
|---|---|
| `SUPABASE_URL` | Servidor (mesmo valor da URL do projeto) |
| `SUPABASE_ANON_KEY` | Servidor (chave publishable/anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | API e ações do painel |
| `NEXT_PUBLIC_SUPABASE_URL` | Login no navegador (mesmo valor de `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login no navegador (mesmo valor de `SUPABASE_ANON_KEY`) |
| `CLIENT_SESSION_SECRET` | **Obrigatória** — assina o cookie de sessão de "Meus horários" no site (gere uma string aleatória de 32+ caracteres) |

Opcionais (só quem usa a funcionalidade correspondente):

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Rodar `npm run db:migrate` (não precisa na Vercel, só localmente) |
| `API_SECRET_KEY` / chaves geradas em Configurações > Integrações | Automações externas (n8n) |
| `N8N_APPOINTMENT_WEBHOOK_URL` | Avisa o barbeiro (webhook n8n) a cada novo agendamento — ver [docs/API-N8N.md](docs/API-N8N.md#6b-webhook-aviso-automático-ao-barbeiro-appointmentcreated) |
| `N8N_APPOINTMENT_WEBHOOK_SECRET` | Segredo do webhook acima (header `x-appointment-webhook-secret`) |

Marque **Production**, **Preview** e **Development**.

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
- [docs/API-N8N.md](docs/API-N8N.md) — API para automação no WhatsApp (n8n): endpoints, chaves de API, exemplos e fluxo de conversa
- [docs/API-FINANCE.md](docs/API-FINANCE.md) — comandas, caixa do dia, comissões e rotas financeiras da API
