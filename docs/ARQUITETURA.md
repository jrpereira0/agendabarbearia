# Arquitetura — Agenda Barbearia

Atualizado por fase, conforme o sistema evolui.

## Visão geral

- **Next.js (App Router)**: login na raiz, painel admin, agendamento do cliente e API no mesmo projeto
- **Supabase**: banco PostgreSQL, login (Auth) e fotos (Storage)
- **Vercel** (fase final): hospedagem

## Estrutura de pastas

| Pasta | O que tem |
| --- | --- |
| `src/app/page.tsx` | Login do painel (página inicial) |
| `src/app/agenda` | Página do cliente: perfil da barbearia e agendamento |
| `src/app/admin/(panel)` | Painel protegido (exige login) |
| `src/lib/actions/login.ts` | Ação de login (e-mail e senha) |
| `src/app/admin/(panel)/profissionais` | Lista, cadastro e edição de profissionais |
| `src/app/admin/(panel)/clientes` | Lista e edição de clientes, com histórico de agendamentos |
| `src/app/admin/(panel)/financeiro` | Caixa do dia e comissões (somente dono) |
| `src/app/admin/(panel)/comandas` | Server actions da comanda na agenda |
| `src/components/ui` | Componentes visuais (shadcn/ui) |
| `src/components/admin` | Componentes do painel (sidebar, formulários, cards) |
| `src/components/booking` | Página pública de agendamento do cliente |
| `src/lib/supabase` | Conexões com o Supabase (browser, server, admin) |
| `src/proxy.ts` | Protege `/admin` e renova sessão em `/` (login) |
| `src/lib/login-path.ts` | Caminho do login (`/`) e URLs de erro |
| `supabase/migrations` | Histórico de mudanças do banco (SQL) |
| `scripts` | Ferramentas: `db:migrate` e `create-admin` |

## Banco de dados

| Tabela | Função |
| --- | --- |
| `profiles` | Usuários do painel (papel: `owner` ou `barber`) |
| `professionals` | Barbeiros: nome, sobrenome, apelido, WhatsApp, e-mail, Instagram, foto, **% comissão** |
| `services` | Serviços: nome, foto, preço (centavos), duração (minutos) |
| `professional_services` | Quais serviços cada profissional faz |
| `working_hours` | Grade semanal de horários por profissional |
| `customers` | Cadastro de clientes (nome, sobrenome, WhatsApp único) |
| `appointments` | Agendamentos dos clientes (vinculados a `customers`, com cópia do nome/WhatsApp) |
| `appointment_services` | Serviços escolhidos em cada agendamento |
| `schedule_blocks` | Bloqueios pontuais na agenda (impedem agendamento normal; encaixe ainda funciona) |
| `comandas` | Comanda financeira por agendamento (`open` ou `closed`) |
| `comanda_items` | Serviços na comanda com preço de tabela e preço cobrado (snapshot) |
| `comanda_payments` | Formas de pagamento ao fechar (permite misto: Pix + dinheiro etc.) |

Regras importantes no banco:

- O **primeiro usuário** criado vira `owner`; os demais, `barber`
- O banco **impede dois agendamentos confirmados no mesmo horário** do mesmo profissional
- Visitantes (sem login) só leem o catálogo; agendamentos exigem login ou passam pela API do sistema

## Papéis e permissões

- **Dono (`owner`)**: vê e gerencia tudo (profissionais, serviços, horários, agendamentos)
- **Barbeiro (`barber`)**: entra com e-mail/senha criados pelo dono; vê a própria agenda. Em **Minha conta** (`/admin/minha-conta`) consulta a grade e altera a senha. Páginas só do dono redirecionam para a agenda ou para Minha conta (`/admin/configuracoes` → Minha conta)
- O painel admin (`/admin`) usa `noindex` para não aparecer em buscadores

## Profissionais

- Cadastro cria automaticamente o **login do barbeiro** (e-mail + senha)
- Excluir um profissional apaga também o login; se houver agendamentos no histórico, o sistema bloqueia a exclusão e sugere **desativar**
- Foto vai pro bucket `photos` do Supabase Storage (pasta `professionals/`)

## Serviços

- Campos: nome, descrição, foto, preço (guardado em **centavos**) e duração (em **minutos** — é o que define os horários livres na agenda)
- Excluir um serviço usado em agendamentos é bloqueado; o caminho é **desativar**
- Foto vai pro bucket `photos` (pasta `services/`)
- No formulário, o preço tem máscara de moeda (digite números e vira R$ automaticamente)

## Horários

Três camadas, da mais geral pra mais específica:

1. **Horário da barbearia** (`business_hours`): por dia da semana, abre/fecha ou fechado. É o teto — ninguém atende fora dele. Editado em **Configurações**
2. **Grade do profissional** (`working_hours`): faixas de horário por dia da semana (várias faixas = pausa de almoço; nenhuma faixa = folga). Editada **no cadastro do profissional** (Profissionais > editar)
3. **Dias especiais** (`schedule_exceptions`): valem pra uma data específica e vencem as camadas acima. Pode ser da barbearia toda ou de um barbeiro só; fechado ou com horário diferente. Editados em **Configurações**

Somente o **dono** edita horários; o barbeiro vê a própria grade em modo leitura em Configurações.

## Agenda do painel

- Tela inicial (`/admin`): **grade do dia** com horários na vertical e um barbeiro por coluna (como agenda de salão)
- Contraste na grade (tons de cinza): branco = livre; cinza médio = fora do expediente; listrado = bloqueado; cinza claro = célula ocupada; preto = agendado; branco tracejado = encaixe; cinza escuro = atendido; sobreposições aparecem lado a lado na coluna
- O intervalo das linhas segue `shop_settings.slot_step_minutes` (o mesmo de Configurações e da API)
- Barra superior: navegar dias, botão **Hoje**, **+ Encaixe** e data no centro
- Sidebar: mini-calendário, **bloqueios do dia** (pausa, almoço etc.), legenda recolhível
- **Dono** vê todos os barbeiros; **barbeiro** vê só a própria coluna
- Cabeçalho da grade mostra **foto e nome** de cada barbeiro
- **Agendamento normal** (`+ Agendar` ou clique em horário livre): só mostra horários disponíveis (mesma regra da API pública); grava com `is_squeeze_in = false`
- A grade do dia cobre **24 horas** (00:00 às 24:00); fora do expediente aparece em cinza
- **Bloqueio de horário** (`schedule_blocks`): na sidebar, bloqueia uma faixa do dia para um barbeiro; agendamento normal e API pública não oferecem esse horário; **encaixe manual** ainda pode usar
- **Encaixe manual** (`+ Encaixe`): passos barbeiro → serviços → horário → cliente; pode escolher qualquer horário do dia, **sobrepor** outros e ficar **fora do expediente**; o sistema avisa antes de confirmar (`is_squeeze_in = true`)
- Ações no horário: **comanda** (serviços, preços, pagamento misto, fechar/reabrir), **editar** horário e cliente, ou **cancelar** (bloqueado se comanda fechada)
- Fechar comanda marca o atendimento como **atendido** (`done`) e lança no caixa; só o **dono** fecha, reabre ou edita valores
- Comissão: % configurável por barbeiro, calculada sobre o valor **cobrado** de cada serviço (taxa de cartão não entra no cálculo)
- Tela **Financeiro** (`/admin/financeiro`): caixa do dia, formas de pagamento e comissões do mês
- Lógica da grade em `src/lib/get-agenda-day.ts` e `src/components/admin/agenda-grid.tsx`

## Motor de horários livres

- **Lógica pura** em `src/lib/availability.ts` (cálculo, sem banco) e **busca de dados** em `src/lib/get-availability.ts`
- Cruza: horário da barbearia ∩ grade do barbeiro, aplica exceções do dia, soma a duração dos serviços escolhidos e remove conflitos com agendamentos confirmados e **bloqueios do dia**
- O **intervalo da agenda** (de quantos em quantos minutos os horários aparecem) é configurável em **Configurações**: 15, 30, 45 ou 60 min (`shop_settings.slot_step_minutes`, padrão 15)
- Pra hoje, só oferece horários com 10 min de antecedência; agenda aberta até **60 dias** à frente
- Fuso fixo da barbearia: `America/Sao_Paulo`
- Exposto em `GET /api/v1/availability?professionalId=...&date=AAAA-MM-DD&serviceIds=id1,id2` (público, mesmo endpoint que o site e as automações de WhatsApp usam)

## Página do cliente (`/agenda`)

- Mostra o **perfil da barbearia** (nome, bio, endereço, horários, WhatsApp, Instagram, logo) e o fluxo de agendamento
- Passos: barbeiro → serviços → data/horário → WhatsApp (busca automática) → confirmação ou cadastro de nome
- Aba **Meus horários**: cliente digita WhatsApp, vê agendamentos futuros, pode **remarcar** (data, horário, serviços) ou **cancelar**
- Se o número já existir e não for a pessoa, o cliente troca o WhatsApp (não edita o nome de outro cadastro)
- Usa a mesma regra de horários livres da API (`GET /api/v1/availability`)
- Confirmação via `POST /api/v1/appointments` (servidor valida de novo antes de gravar)
- O dono edita o perfil público em **Configurações** (`/admin/configuracoes`)
- Campos do perfil em `shop_settings`: `shop_name`, `bio`, `cep`, `street`, `address_number`, `address_complement`, `neighborhood`, `city`, `state`, `address` (texto montado automaticamente), `whatsapp`, `instagram`, `logo_url`
- Endereço: digite o CEP e o sistema preenche rua, bairro e cidade (ViaCEP); você informa número e complemento

## API REST (`/api/v1`)

Rotas de agendamento (8 operações) + financeiro (6 operações). Detalhes das comandas: [API-FINANCE.md](./API-FINANCE.md).

| Método | Rota | Auth | Função |
| --- | --- | --- | --- |
| GET | `/api/v1/catalog` | Pública | Barbearia, barbeiros ativos, serviços e horário de funcionamento |
| GET | `/api/v1/availability` | Pública | Horários livres de um barbeiro num dia |
| GET | `/api/v1/customers/by-whatsapp` | **Privada** | Buscar cliente pelo WhatsApp (retorna `id`) — **n8n** |
| GET | `/api/v1/customers/lookup` | Pública | Buscar cliente (site `/agenda`, resposta simples) |
| GET | `/api/v1/appointments?whatsapp=` | **Privada** | Listar agendamentos futuros do cliente |
| POST | `/api/v1/appointments` | Pública | Criar agendamento online |
| PATCH | `/api/v1/appointments/:id` | **Privada** | Remarcar agendamento |
| DELETE | `/api/v1/appointments/:id?whatsapp=` | **Privada** | Cancelar agendamento |
| GET | `/api/v1/comandas` | **Privada** | Listar comandas ou abrir por agendamento |
| GET/PATCH | `/api/v1/comandas/:id` | **Privada** | Ver ou editar itens da comanda |
| POST | `/api/v1/comandas/:id/close` | **Privada** | Fechar comanda |
| POST | `/api/v1/comandas/:id/reopen` | **Privada** | Reabrir comanda |
| GET | `/api/v1/finance/cash-register` | **Privada** | Caixa do dia |
| GET | `/api/v1/finance/commissions` | **Privada** | Comissões no período |

WhatsApp em todas as rotas que usam número: aceita DDD + número (10 ou 11 dígitos), com ou sem `55`, máscara ou `+55`; grava normalizado com `55`.

**Autenticação:** rotas **privadas** exigem chave de API (`Authorization: Bearer dbc_live_...`), sessão admin ou cookie de cliente (`POST /api/agenda/session` no site). Rotas **públicas** funcionam sem header; se enviar `Bearer`, a chave deve ser válida. Chaves geradas em Configurações > Integrações > Chaves de API.

Guia completo para montar bot no n8n (exemplos, IDs, fluxo de conversa): [API-N8N.md](./API-N8N.md).

Limite de uso por IP (resposta **429** se exceder; lógica em `src/lib/rate-limit.ts`):

| Rotas | Limite |
| --- | --- |
| `catalog` e `availability` | 60 a cada 15 min |
| `customers/by-whatsapp`, `customers/lookup` e `appointments?whatsapp=` | 10 a cada 15 min |
| `POST /appointments` | 5 por IP / hora e 3 por WhatsApp / hora |
| `PATCH` / `DELETE /appointments/:id` | 10 a cada 15 min |

## Clientes

- Cadastro automático na primeira reserva (página ou painel); um WhatsApp = um cliente
- No painel, ao agendar: o WhatsApp busca o cadastro existente e **não altera o nome**; para corrigir dados, use **Clientes**
- Somente o **dono** vê **Clientes** (`/admin/clientes`): busca, cadastro manual em **Novo cliente**, ficha com histórico
- Na ficha do cliente: editar dados e ver histórico de visitas (data, barbeiro, serviços, status)
- Alterar nome/WhatsApp no painel atualiza também os agendamentos vinculados
- Exclusão só é permitida se o cliente não tiver agendamentos no histórico

## Fotos (profissionais e serviços)

- Toda foto é **comprimida no navegador antes do envio** (`src/lib/compress-image.ts`): redimensionada pra até 1024px e convertida pra WebP
- Se a compressão falhar, o arquivo original é enviado (limite de 10 MB configurado no `next.config.ts`)

## Como atualizar o banco

Nunca rode SQL manualmente. Crie um arquivo numerado em `supabase/migrations` e rode:

```bash
npm run db:migrate
```
