# Arquitetura — Dinho Barber Coffee

Atualizado conforme o sistema evolui (última revisão: jul/2026).

## Visão geral

- **Next.js (App Router)**: login na raiz, painel admin, agendamento do cliente e API no mesmo projeto
- **Supabase**: banco PostgreSQL, login (Auth) e fotos (Storage)
- **Vercel** (fase final): hospedagem

## Estrutura de pastas

| Pasta | O que tem |
| --- | --- |
| `src/app/login-admin` | Login do painel admin |
| `src/app/page.tsx` | Redireciona `/` → `/login-admin` |
| `src/app/agenda` | Página do cliente: agendamento estilo app (menu inferior) |
| `src/app/admin/(panel)` | Painel protegido (exige login) |
| `src/lib/actions/login.ts` | Ação de login (e-mail e senha) |
| `src/app/admin/(panel)/profissionais` | Lista, cadastro e edição de profissionais (inclui permissões no painel por barbeiro) |
| `src/app/admin/(panel)/servicos` | Lista, cadastro e edição de serviços (preço por dia da semana, duração, foto) |
| `src/app/admin/(panel)/clientes` | Lista e edição de clientes, com histórico de agendamentos |
| `src/app/admin/(panel)/financeiro` | Painel financeiro (métricas por período), histórico de caixas e comissões (somente dono) |
| `src/app/admin/(panel)/comandas` | Server actions da comanda (sem página própria — a UI é o `ComandaDialog`, aberto a partir da agenda) |
| `src/app/admin/(panel)/produtos` | Cadastro de produtos, estoque, comissão por item e categorias |
| `src/app/admin/(panel)/configuracoes` | Perfil público da barbearia, horários, chaves de API (Integrações) |
| `src/app/admin/(panel)/minha-conta` | Tela do barbeiro para ver a própria grade e trocar a senha |
| `src/app/api/agenda/otp/send` | Gera e dispara o código OTP (webhook n8n → WhatsApp) |
| `src/app/api/agenda/otp/verify` | Valida o código e emite cookie + `accessToken` (app) |
| `src/app/api/agenda/session` | `GET` sessão atual / `DELETE` sair |
| `src/app/api/v1/customers/me` | Perfil do cliente autenticado (`GET` / `PATCH` — Minha conta no app) |
| `src/lib/client-whatsapp-otp.ts` | Gera, grava (hash) e valida códigos OTP |
| `src/lib/notifications/client-otp-webhook.ts` | Envia `client.otp` ao n8n |
| `src/components/ui` | Componentes visuais (shadcn/ui) |
| `src/components/admin` | Componentes do painel (sidebar, formulários, cards) |
| `src/components/booking` | Página pública de agendamento do cliente |
| `src/hooks` | Hooks compartilhados (ex.: `use-mobile`, usado pela sidebar) |
| `src/lib/supabase` | Conexões com o Supabase (server e admin) |
| `src/lib/api` | Guards de autenticação/rate limit das rotas REST (`with-api-guard.ts`, `safe-route.ts`) |
| `src/proxy.ts` | Protege `/admin` e renova sessão em `/login-admin`. No Next.js 16, "Middleware" foi renomeado para "Proxy" — é o mesmo conceito |
| `src/lib/login-path.ts` | Caminho do login (`/login-admin`) e URLs de erro |
| `supabase/migrations` | Histórico de mudanças do banco (SQL) |
| `scripts` | Ferramentas: `db:migrate`, `db:migrate-weekday-prices`, `db:reset-shop` e `create-admin` |
| `src/lib/catalog-booking.ts` | Labels de dias e helper legado de faixa de preço por nome |
| `src/lib/public-service-prices.ts` | Exibição de preços no site do cliente (faixa antes da data, valor exato depois) |
| `src/lib/service-booking-stats.ts` | Contagem de agendamentos por serviço (catálogo público) |
| `src/lib/booking-service-groups.ts` | Ordenação e seções “Mais agendados” no site |
| `src/lib/service-prices-for-date.ts` | Resolve preço de serviço por data (painel admin e comanda) |
| `src/lib/service-weekday-prices.ts` | Preço por dia da semana (cadastro, API e validação de agendamento) |
| `src/lib/notifications/appointment-created-webhook.ts` | Avisa o n8n (webhook) sempre que um agendamento é criado, para notificar o barbeiro no WhatsApp |
| `src/lib/notifications/appointment-cancelled-webhook.ts` | Mesma ideia, para quando um agendamento é cancelado |
| `src/lib/notifications/appointment-updated-webhook.ts` | Mesma ideia, para quando um agendamento é alterado/remarcado |
| `src/lib/appointment-reminders.ts` | Lembretes automáticos para clientes (1h e 30min antes): criar, cancelar, listar vencidos, marcar enviado e confirmar |
| `src/lib/notifications/shared.ts` | Busca de dados (agendamento, profissional, serviços, loja) compartilhada pelos webhooks acima |

## Banco de dados

| Tabela | Função |
| --- | --- |
| `profiles` | Usuários do painel (papel: `owner` ou `barber`) |
| `professionals` | Barbeiros: nome, sobrenome, apelido, WhatsApp, e-mail, Instagram, foto, ponto focal (`photo_position`), **% comissão** |
| `services` | Serviços: nome, foto, ponto focal (`photo_position`), preço mínimo de referência (centavos), duração (minutos) |
| `service_weekday_prices` | Preço do serviço por dia da semana (0=dom … 6=sáb); só existem linhas nos dias oferecidos. Leitura pública (catálogo e site); policies de escrita só para o dono (migration `0031`) |
| `professional_services` | Quais serviços cada profissional faz |
| `working_hours` | Grade semanal de horários por profissional |
| `business_hours` | Horário da barbearia por dia da semana (abre/fecha ou fechado) — teto que vale para todos os profissionais |
| `schedule_exceptions` | Dias especiais que vencem `business_hours`/`working_hours` numa data específica (fechado ou horário diferente); pode ser da barbearia toda ou de um profissional só |
| `shop_settings` | Configuração única da loja (linha `id = 1`): intervalo da agenda (`slot_step_minutes`) e perfil público (nome, bio, endereço, WhatsApp, Instagram, logo) |
| `customers` | Cadastro de clientes (nome, sobrenome, WhatsApp único, `credit_balance_cents` com o saldo de crédito) |
| `customer_credit_transactions` | Histórico de crédito do cliente: depósitos (`add`) e usos (`use`), com forma de pagamento e comanda/caixa vinculados |
| `appointments` | Agendamentos dos clientes (vinculados a `customers`, com cópia do nome/WhatsApp); `booking_source` indica origem (`admin` / `site` / `ai`) para o ícone no card da agenda |
| `appointment_services` | Serviços escolhidos em cada agendamento |
| `schedule_blocks` | Bloqueios pontuais na agenda (impedem agendamento normal; encaixe ainda funciona) |
| `comandas` | Comanda financeira por cliente/dia (`open` ou `closed`); uma comanda aberta por WhatsApp + data |
| `comanda_appointments` | Vínculo entre comanda e agendamentos normais do mesmo cliente no dia (RLS ativo) |
| `comanda_items` | Serviços e produtos na comanda com preço de tabela e preço cobrado (snapshot); serviços podem referenciar encaixe (`squeeze_appointment_id`); produtos usam `product_id`, `quantity` e `commission_percent_snapshot`; `professional_id` é **opcional** em produtos (venda sem barbeiro) |
| `product_categories` | Categorias de produto (ex.: Produtos, Geladeira) |
| `products` | Produtos: nome, foto, ponto focal (`photo_position`), preço, estoque, comissão % por item |
| `comanda_payments` | Formas de pagamento ao fechar (permite misto: Pix + dinheiro etc.) |
| `cash_register_sessions` | Sessões de caixa por dia (`service_date`): abertura/fechamento, responsável, saldo inicial e totais |
| `commission_payouts` | Repasse de comissão pago a um profissional num período (`period_from`/`period_to`, valor, quem pagou) |
| `commission_payout_items` | Itens da comanda incluídos em cada repasse (evita pagar a mesma comissão duas vezes) |
| `appointment_notifications` | Controle de idempotência dos webhooks `appointment.created` e `appointment.cancelled` (evita avisar o barbeiro duas vezes pelo mesmo evento); guarda `source`. O evento `appointment.updated` não usa bloqueio — cada edição relevante gera um novo aviso |
| `appointment_reminders` | Lembretes para clientes (1h e 30min antes); o n8n consulta os vencidos via API e marca envio/confirmação |
| `api_keys` | Chaves de API para integrações (n8n): nome, prefixo, hash do segredo, scopes, validade — geradas em Configurações > Integrações |
| `dinho_ai_status` | Por conversa de WhatsApp (`session_id` = telefone): se o atendimento por IA está ativo ou pausado (`ia_ativa`). Só service role / n8n |

Regras importantes no banco:

- O **primeiro usuário** criado vira `owner`; os demais, `barber`
- O banco **impede dois agendamentos confirmados no mesmo horário** do mesmo profissional
- Visitantes (sem login) só leem o catálogo; agendamentos exigem login ou passam pela API do sistema

## Papéis e permissões

- **Dono (`owner`)**: vê e gerencia tudo (profissionais, serviços, horários, agendamentos)
- **Barbeiro (`barber`)**: entra com e-mail/senha criados pelo dono; vê a própria agenda e **Minhas comissões** (`/admin/financeiro/comissoes`) — só os dados dele, sem ver outros barbeiros nem o financeiro geral. Em **Minha conta** (`/admin/minha-conta`) consulta a grade e altera a senha. Páginas só do dono redirecionam para a agenda ou para Minha conta (`/admin/configuracoes` → Minha conta)
- O painel admin (`/admin`) usa `noindex` para não aparecer em buscadores

## Profissionais

- Cadastro cria automaticamente o **login do barbeiro** (e-mail + senha)
- Seção **Permissões no painel**: o dono liga/desliga por barbeiro — marcar cliente, encaixe, abrir/editar/fechar comanda, editar/cancelar agendamento e bloquear horários
- Excluir um profissional apaga também o login; se houver agendamentos no histórico, o sistema bloqueia a exclusão e sugere **desativar**
- Foto vai pro bucket `photos` do Supabase Storage (pasta `professionals/`)

## Serviços

- Campos: nome, descrição, foto, **preço por dia da semana** (tabela `service_weekday_prices`), duração (em **minutos** — define os horários livres na agenda)
- No cadastro: grade dos 7 dias; dias em que a barbearia está fechada (`business_hours`) aparecem bloqueados; atalho **“Mesmo preço em todos os dias abertos”**
- O campo `price_cents` na tabela `services` guarda o **menor** preço da semana (referência para listagens)
- A API e o agendamento validam se o serviço está disponível no **dia da reserva** e usam o preço daquele dia
- Excluir um serviço usado em agendamentos é bloqueado; o caminho é **desativar**
- Foto vai pro bucket `photos` (pasta `services/`)

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
- **Dono** pode agendar em **qualquer horário** do dia (inclusive fora do expediente, data passada ou horário que já passou), exceto se já houver outro agendamento normal naquele horário — aí deve usar **encaixe** ou serviço extra na comanda
- **Barbeiro** só agenda nos horários livres do expediente e **não** pode marcar em datas ou horários passados
- Cabeçalho da grade mostra **foto e nome** de cada barbeiro
- **Agendamento normal** (`+ Agendar` ou clique em horário livre): só mostra horários disponíveis (mesma regra da API pública); grava com `is_squeeze_in = false`
- A grade do dia cobre **24 horas** (00:00 às 24:00); fora do expediente aparece em cinza
- **Bloqueio de horário** (`schedule_blocks`): na sidebar, bloqueia uma faixa do dia para um barbeiro; agendamento normal e API pública não oferecem esse horário; **encaixe manual** ainda pode usar
- **Encaixe manual** (`+ Encaixe`): passos barbeiro → serviços → horário → cliente; pode escolher qualquer horário do dia, **sobrepor** outros e ficar **fora do expediente**; o sistema avisa antes de confirmar (`is_squeeze_in = true`). Encaixes do **mesmo cliente no mesmo dia** entram automaticamente na comanda aberta dele
- **Cancelar** horário: motivo obrigatório; o card **some da agenda** (não fica visível como cancelado)
- Ações no horário: ao **clicar no card**, abre um modal com resumo e opções (abrir comanda, editar, trocar cliente, cancelar, WhatsApp); a comanda abre só quando escolher essa opção
- **Comanda unificada**: uma comanda aberta por cliente (WhatsApp) e dia; reúne todos os agendamentos normais **ainda ativos** do dia (vários barbeiros/horários) e os encaixes manuais desse cliente; ao **finalizar**, essa comanda fecha de vez — se o cliente marcar de novo no mesmo dia, abre uma **nova** comanda só com os novos atendimentos. Ao **editar serviços** de um agendamento, a comanda aberta **realinha** os itens (remove os que saíram e inclui os novos). Ao cancelar horário, itens do agendamento cancelado saem da comanda e o total é recalculado; se não sobrar atendimento ativo, a comanda aberta (incluindo gorjeta/produto órfãos) é apagada — assim não “contam” no próximo agendamento nem atrapalham a finalização. Itens que já entraram em **repasse de comissão** não podem ser apagados (histórico); a edição/fechamento ignora esses resíduos no total
- **UX da comanda**: ao abrir, a interface já mostra serviços/preços da agenda (sem esperar o skeleton); o servidor sincroniza em segundo plano. Ao finalizar, o modal fecha na hora com feedback de sucesso; o fechamento no banco segue em segundo plano (se falhar, aparece aviso). Enquanto finaliza, há loading claro no botão/overlay
- **Produtos na comanda**: na mesma comanda dos serviços, dá para adicionar produtos (busca e quantidade). O **barbeiro vendedor é opcional** — o padrão é **Sem profissional** (venda sem vínculo, **sem comissão**, valor 100% da barbearia). Se escolher um barbeiro, vale a % cadastrada no produto. O estoque baixa só no **fechamento** da comanda e volta se reabrir
- Ao **adicionar serviço na comanda**, o dono escolhe barbeiro e horário — vira **serviço extra** na agenda (borda tracejada cinza; encaixe manual continua vermelho)
- Na comanda, o barbeiro de cada serviço é **somente leitura** — para mudar, edite o agendamento na agenda
- Fechar comanda marca os atendimentos vinculados como **atendido** (`done`) e lança no caixa; o **dono** sempre pode fechar/reabrir; barbeiro fecha/edita conforme as **permissões** do cadastro
- **Reabrir comanda**: pagamento com crédito do cliente **sempre volta** ao saldo; se a comanda tinha gerado crédito e esse valor já foi gasto em outro atendimento, o dono confirma e o valor gasto não volta (só estorna o que ainda sobrar)
- Comissão: % configurável por barbeiro nos **serviços** (valor cobrado); nos **produtos**, % do cadastro do produto **somente se houver barbeiro** vinculado (taxa de cartão não entra no cálculo)
- **Caixa lateral na agenda** (aba **CAIXA** à direita): painel com **saldo do dia em destaque**, métricas (entradas, comissões, barbearia), barras por forma de pagamento, lista de comandas fechadas (busca) e ações no rodapé (abrir/encerrar caixa, ver métricas do dia)
- **Financeiro** (`/admin/financeiro`): painel de **análise** por período (`from` / `to`) — faturamento, comissões, evolução diária, formas de pagamento e ranking por barbeiro; não é onde se abre/fecha caixa
- **Caixas** (`/admin/financeiro/caixas`): histórico de sessões de caixa no período — abrir, fechar, reabrir, KPIs e atalhos para agenda/comissões do dia
- **Comissões** (`/admin/financeiro/comissoes`): relatório por barbeiro filtrado por `service_date` (dia do atendimento/caixa), com detalhamento individual. Produtos **sem profissional** não entram no repasse do barbeiro. O dono vê todos; o barbeiro vê só as próprias (**Minhas comissões** no menu)
- Lógica da grade em `src/lib/get-agenda-day.ts` e `src/components/admin/agenda-grid.tsx`

## Motor de horários livres

- **Lógica pura** em `src/lib/availability.ts` (cálculo, sem banco) e **busca de dados** em `src/lib/get-availability.ts`
- Cruza: horário da barbearia ∩ grade do barbeiro, aplica exceções do dia, soma a duração dos serviços escolhidos e remove conflitos com agendamentos confirmados e **bloqueios do dia**
- O **intervalo da agenda** (de quantos em quantos minutos os horários aparecem) é configurável em **Configurações**: 15, 30, 45 ou 60 min (`shop_settings.slot_step_minutes`, padrão 15)
- Pra hoje, só oferece horários com 10 min de antecedência; agenda aberta até **60 dias** à frente
- Fuso fixo da barbearia: `America/Sao_Paulo`
- Exposto em `GET /api/v1/appointments/availability?professionalId=...&date=AAAA-MM-DD&serviceIds=id1,id2` (público, mesmo endpoint que o site e as automações de WhatsApp usam)

## Página do cliente (`/agenda`)

- Layout estilo app: tela cheia, conteúdo limpo (sem barra de marca no topo) e menu inferior **Agendar · Horários · Local**
- Aba **Local**: perfil da loja, funcionamento, endereço, contatos e botão **Como chegar**
- A **prévia do link no WhatsApp** (Open Graph) usa nome, bio curta e logo de `shop_settings`, com imagem gerada em `/agenda/opengraph-image` (1200×630). Se a prévia ficar desatualizada após um deploy, force a atualização no [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Passos: barbeiro (**ou sem preferência**) → serviços → data/horário → **WhatsApp + código** (fica logado ~14 dias) → se for novo, nome/sobrenome → confirmação
- **Sem preferência:** o site mostra a união dos horários livres de quem faz os serviços; na hora de confirmar, o servidor escolhe o barbeiro **com menos agendamentos ativos naquele dia** (empate: ordem do apelido)
- **Preços na escolha de serviços:** como o dia ainda não foi escolhido, cada serviço mostra a **faixa de preço** (ex.: `Seg–Qua R$ 60,00 · Qui–Sáb R$ 70,00` ou `R$ 60,00 – R$ 70,00`). O total aparece como **“a partir de …”** quando há variação por dia
- **Serviços mais agendados:** no topo da lista aparece a seção **“Mais agendados”** (até 5 serviços com histórico de marcações); o restante fica em **“Outros serviços”**, ordenado pela mesma contagem
- **Preços após escolher a data:** na etapa de data/horário e na confirmação, o total passa a usar o **valor exato** do dia selecionado (mesma regra da API ao gravar)
- Aba **Horários** (Meus horários): mesmo login por código; vê agendamentos futuros, pode **remarcar**, **cancelar** ou **Sair**
- Se o número já existir e não for a pessoa, o cliente troca o WhatsApp (não edita o nome de outro cadastro)
- Usa a mesma regra de horários livres da API (`GET /api/v1/appointments/availability`)
- Confirmação via `POST /api/v1/appointments` com cookie de sessão (ou chave de API no bot)
- Login OTP: [api/cliente-otp-whatsapp.md](./api/cliente-otp-whatsapp.md)
- O dono edita o perfil público em **Configurações** (`/admin/configuracoes`)
- Campos do perfil em `shop_settings`: `shop_name`, `bio`, `cep`, `street`, `address_number`, `address_complement`, `neighborhood`, `city`, `state`, `address` (texto montado automaticamente), `whatsapp`, `instagram`, `logo_url`
- Endereço: digite o CEP e o sistema preenche rua, bairro e cidade (ViaCEP); você informa número e complemento

## API REST (`/api/v1`)

Rotas de agendamento + lembretes. Comandas, caixa e comissões ficam **só no painel** (sem `/api/v1`).

**Documentação:**
- Referência OpenAPI (tela dedicada `/docs/api`): [openapi/v1.yaml](./openapi/v1.yaml) — **Configurações → Integrações → Documentação da API**
- Guia n8n / WhatsApp: [api/guia-n8n.md](./api/guia-n8n.md)
- Regras de comandas/caixa/comissões: [api/financeiro.md](./api/financeiro.md)
- Índice: [api/README.md](./api/README.md)

| Método | Rota | Auth | Função |
| --- | --- | --- | --- |
| GET | `/api/v1/shop` | Pública | Dados da loja (nome, contato, logo, fuso, slots, horários) |
| GET | `/api/v1/services` | Pública | Lista **serviços** (preços agrupados + quem realiza); opcional `?professionalId=` e `?date=` |
| GET | `/api/v1/professionals` | Pública | Lista **profissionais** ativos (dados do barbeiro + `serviceIds`); opcional `?serviceId=` |
| GET | `/api/v1/appointments/availability` | Pública | Horários livres (`professionalId` ou `anyProfessional=1`) |
| GET | `/api/v1/customers?whatsapp=` | **Privada** | Buscar cliente (`id`, nome, sobrenome, WhatsApp) — chave ou OTP do mesmo número |
| GET | `/api/v1/customers/me` | **Privada** | Perfil do cliente autenticado (OTP / app) |
| PATCH | `/api/v1/customers/me` | **Privada** | Editar nome/sobrenome do próprio cadastro (OTP / app; WhatsApp imutável) |
| GET | `/api/v1/appointments?whatsapp=` | **Privada** | Listar agendamentos (`mode=upcoming` padrão, `history` ou `all`) |
| GET | `/api/v1/appointments/last-completed?whatsapp=` | **Privada** | Último atendimento concluído do cliente |
| POST | `/api/v1/appointments` | **Privada*** | Criar agendamento online (*site: cookie OTP; app: Bearer `accessToken`; n8n: chave de API*) |
| PUT | `/api/v1/appointments/:id/status` | **Privada** | Atualizar status (`scheduled` / `confirmed` / `cancelled` / `done`) |
| PATCH | `/api/v1/appointments/:id` | **Privada** | Remarcar agendamento |
| DELETE | `/api/v1/appointments/:id?whatsapp=` | **Privada** | Cancelar agendamento |
| GET | `/api/v1/appointment-reminders/due` | **Privada** | Listar lembretes vencidos (n8n consulta pra disparar no WhatsApp) |
| GET | `/api/v1/appointment-reminders/pending-response` | **Privada** | Listar lembretes enviados sem confirmação do cliente |
| POST | `/api/v1/appointment-reminders/:id/mark-sent` | **Privada** | Marcar lembrete como enviado |
| POST | `/api/v1/appointment-reminders/:id/confirm` | **Privada** | Marcar lembrete como confirmado pelo cliente |

WhatsApp em todas as rotas que usam número: aceita DDD + número (10 ou 11 dígitos), com ou sem `55`, máscara ou `+55`; grava normalizado com `55`.

**Autenticação:** rotas **privadas** exigem chave de API (`Authorization: Bearer dbc_live_...`), sessão admin, cookie de cliente após OTP **ou** Bearer com `accessToken` do OTP (`POST /api/agenda/otp/verify`). Rotas **públicas** (loja, catálogo, disponibilidade) funcionam sem header; se enviar `Bearer` de chave de API, a chave deve ser válida. Chaves geradas em Configurações > Integrações > Chaves de API. Detalhes: [api/cliente-otp-whatsapp.md](./api/cliente-otp-whatsapp.md), [api/app-mobile.md](./api/app-mobile.md).

Guia completo para montar bot no n8n (exemplos, IDs, fluxo de conversa): [api/guia-n8n.md](./api/guia-n8n.md).

Limite de uso por IP (resposta **429** se exceder; lógica em `src/lib/rate-limit.ts`):

| Rotas | Limite |
| --- | --- |
| `shop` / `services` / `professionals` / `availability` | 60 a cada 15 min |
| `customers` / `customers/me` e `appointments?whatsapp=` | 60 a cada 15 min |
| `POST /appointments` | 5 por IP / hora e 3 por WhatsApp / hora |
| `PATCH` / `DELETE /appointments/:id` | 10 a cada 15 min |

## Aviso automático ao barbeiro (webhook n8n)

Sempre que um agendamento novo é **criado**, **cancelado** ou **alterado/remarcado** — pelo site `/agenda`, pela IA (n8n) ou pelo painel admin — o sistema dispara um webhook para um workflow do n8n avisar o(s) barbeiro(s) no WhatsApp. Não dispara em exclusão definitiva (só o dono, via `deleteAppointment`) nem em reatribuição interna de serviço já existente na comanda.

- Configuração e comportamento completo: criação em [api/guia-n8n.md, seção 6b](./api/guia-n8n.md#6b-webhook-aviso-automático-ao-barbeiro-appointmentcreated), cancelamento em [seção 6c](./api/guia-n8n.md#6c-webhook-aviso-automático-ao-barbeiro-appointmentcancelled), alteração em [seção 6d](./api/guia-n8n.md#6d-webhook-aviso-automático-ao-barbeiro-appointmentupdated)
- Funções centrais: `notifyAppointmentCreated`, `notifyAppointmentCancelled` e `notifyAppointmentUpdated` em `src/lib/notifications/`
- Nunca bloqueia nem desfaz a operação principal se falhar (logs com prefixo `[appointment-webhook]`, `[appointment-cancelled-webhook]` e `[appointment-updated-webhook]`)
- `appointment.created` e `appointment.cancelled` são protegidos contra duplicidade pela tabela `appointment_notifications`; `appointment.updated` **não** bloqueia edições futuras (cada alteração relevante gera um novo aviso)

## Clientes

- Cadastro automático na primeira reserva (página ou painel); um WhatsApp = um cliente
- No painel, ao agendar: busca e cadastro ficam **na mesma tela** — o WhatsApp busca o cadastro existente e **não altera o nome**; para corrigir dados, use **Clientes**
- Somente o **dono** vê **Clientes** (`/admin/clientes`): busca, cadastro manual em **Novo cliente**, ficha com histórico
- Na ficha do cliente: editar dados e ver histórico de visitas (data, barbeiro, serviços, status)
- Alterar nome/WhatsApp no painel atualiza também os agendamentos vinculados
- Exclusão só é permitida se o cliente não tiver visitas concluídas (`done`) nem horários ativos (`scheduled`/`confirmed`); agendamentos cancelados não impedem
- **App / site (cliente logado por OTP):** `GET` e `PATCH /api/v1/customers/me` — ver e editar **nome/sobrenome** do próprio cadastro; WhatsApp não muda. A resposta inclui `creditBalanceCents` (crédito na loja). Detalhes: [api/app-mobile.md](./api/app-mobile.md)

## Fotos (profissionais, serviços e produtos)

- No upload: a pessoa **recorta** a foto (quadrado) e depois pode **arrastar** na prévia para ajustar o enquadramento
- Toda foto é **comprimida no navegador** (`src/lib/compress-image.ts`): até 1024px, WebP
- O ponto focal fica em `photo_position` (CSS `object-position`, padrão `50% 50%`) nas tabelas `professionals`, `services` e `products`
- Se a compressão falhar, o arquivo original é enviado (limite de 10 MB no `next.config.ts`)

## Riscos de segurança conhecidos (aceitos por ora)

Identificados em auditoria (jul/2026); decisão consciente de não corrigir agora — revisar quando fizer sentido:

- **`GET /api/v1/customers`**: privada (chave de API, dono ou OTP do mesmo WhatsApp). Site/app usam `GET` / `PATCH /customers/me` após o login.
- Login do cliente no site: código no WhatsApp (OTP) via n8n — ver [api/cliente-otp-whatsapp.md](./api/cliente-otp-whatsapp.md)

## Como atualizar o banco

Nunca rode SQL manualmente. Crie um arquivo numerado em `supabase/migrations` e rode:

```bash
npm run db:migrate
```

Scripts auxiliares (com `.env.local` apontando para o banco certo):

| Comando | Quando usar |
| --- | --- |
| `npm run db:migrate-weekday-prices` | Após migration `0030`: converte serviços legados (nomes AppBarber) para preço por dia |
| `npm run db:reset-shop` | Zera agendamentos, clientes, serviços, comandas e caixa; **mantém** logins e profissionais |
