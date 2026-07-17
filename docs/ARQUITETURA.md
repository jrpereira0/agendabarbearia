# Arquitetura — Dinho Barber Coffee

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
| `src/app/admin/(panel)/profissionais` | Lista, cadastro e edição de profissionais (inclui permissões no painel por barbeiro) |
| `src/app/admin/(panel)/clientes` | Lista e edição de clientes, com histórico de agendamentos |
| `src/app/admin/(panel)/financeiro` | Painel financeiro (métricas por período), histórico de caixas e comissões (somente dono) |
| `src/app/admin/(panel)/comandas` | Server actions da comanda (sem página própria — a UI é o `ComandaDialog`, aberto a partir da agenda) |
| `src/app/admin/(panel)/produtos` | Cadastro de produtos, estoque, comissão por item e categorias |
| `src/app/api/agenda/session` | Emite o cookie de sessão do cliente (aba "Meus horários") |
| `src/components/ui` | Componentes visuais (shadcn/ui) |
| `src/components/admin` | Componentes do painel (sidebar, formulários, cards) |
| `src/components/booking` | Página pública de agendamento do cliente |
| `src/hooks` | Hooks compartilhados (ex.: `use-mobile`, usado pela sidebar) |
| `src/lib/supabase` | Conexões com o Supabase (server e admin) |
| `src/lib/api` | Guards de autenticação/rate limit das rotas REST (`with-api-guard.ts`, `safe-route.ts`) |
| `src/proxy.ts` | Protege `/admin` e renova sessão em `/` (login). No Next.js 16, "Middleware" foi renomeado para "Proxy" — é o mesmo conceito |
| `src/lib/login-path.ts` | Caminho do login (`/`) e URLs de erro |
| `supabase/migrations` | Histórico de mudanças do banco (SQL) |
| `scripts` | Ferramentas: `db:migrate`, `db:migrate-weekday-prices`, `db:reset-shop` e `create-admin` |
| `src/lib/catalog-booking.ts` | Catálogo enxuto `mode=booking` (preços agrupados por dia para n8n/IA) |
| `src/lib/public-service-prices.ts` | Exibição de preços no site do cliente (faixa antes da data, valor exato depois) |
| `src/lib/service-booking-stats.ts` | Contagem de agendamentos por serviço (catálogo público) |
| `src/lib/booking-service-groups.ts` | Ordenação e seções “Mais agendados” no site |
| `src/lib/service-prices-for-date.ts` | Resolve preço de serviço por data (painel admin e comanda) |
| `src/lib/service-weekday-prices.ts` | Preço por dia da semana (cadastro, API e validação de agendamento) |
| `src/lib/notifications/appointment-created-webhook.ts` | Avisa o n8n (webhook) sempre que um agendamento é criado, para notificar o barbeiro no WhatsApp |
| `src/lib/notifications/appointment-cancelled-webhook.ts` | Mesma ideia, para quando um agendamento é cancelado |
| `src/lib/notifications/appointment-updated-webhook.ts` | Mesma ideia, para quando um agendamento é alterado/remarcado |
| `src/lib/appointment-reminders.ts` | Lembretes automáticos para clientes (1h antes): criar, cancelar, listar vencidos, marcar enviado e confirmar |
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
| `customers` | Cadastro de clientes (nome, sobrenome, WhatsApp único) |
| `appointments` | Agendamentos dos clientes (vinculados a `customers`, com cópia do nome/WhatsApp) |
| `appointment_services` | Serviços escolhidos em cada agendamento |
| `schedule_blocks` | Bloqueios pontuais na agenda (impedem agendamento normal; encaixe ainda funciona) |
| `comandas` | Comanda financeira por cliente/dia (`open` ou `closed`); uma comanda aberta por WhatsApp + data |
| `comanda_appointments` | Vínculo entre comanda e agendamentos normais do mesmo cliente no dia (RLS ativo) |
| `comanda_items` | Serviços e produtos na comanda com preço de tabela e preço cobrado (snapshot); serviços podem referenciar encaixe (`squeeze_appointment_id`); produtos usam `product_id`, `quantity` e `commission_percent_snapshot` |
| `product_categories` | Categorias de produto (ex.: Produtos, Geladeira) |
| `products` | Produtos: nome, foto, ponto focal (`photo_position`), preço, estoque, comissão % por item |
| `comanda_payments` | Formas de pagamento ao fechar (permite misto: Pix + dinheiro etc.) |
| `cash_register_sessions` | Sessões de caixa por dia (`service_date`): abertura/fechamento, responsável, saldo inicial e totais |
| `appointment_notifications` | Controle de idempotência dos webhooks `appointment.created` e `appointment.cancelled` (evita avisar o barbeiro duas vezes pelo mesmo evento); guarda `source`. O evento `appointment.updated` não usa bloqueio — cada edição relevante gera um novo aviso |
| `appointment_reminders` | Lembretes para clientes (ex.: 1h antes do atendimento); o n8n consulta os vencidos via API e marca envio/confirmação |

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
- **Comanda unificada**: uma comanda aberta por cliente (WhatsApp) e dia; reúne todos os agendamentos normais **ainda ativos** do dia (vários barbeiros/horários) e os encaixes manuais desse cliente; ao **finalizar**, essa comanda fecha de vez — se o cliente marcar de novo no mesmo dia, abre uma **nova** comanda só com os novos atendimentos. Ao cancelar horário, itens do agendamento cancelado saem da comanda e o total é recalculado; se não sobrar atendimento ativo, a comanda aberta (incluindo gorjeta/produto órfãos) é apagada — assim não “contam” no próximo agendamento nem atrapalham a finalização. Itens que já entraram em **repasse de comissão** não podem ser apagados (histórico); a edição/fechamento ignora esses resíduos no total
- **Produtos na comanda**: na mesma comanda dos serviços, dá para adicionar produtos (busca, quantidade e barbeiro vendedor obrigatório); a comissão é a % cadastrada no produto; o estoque baixa só no **fechamento** da comanda e volta se reabrir
- Ao **adicionar serviço na comanda**, o dono escolhe barbeiro e horário — vira **serviço extra** na agenda (borda tracejada cinza; encaixe manual continua vermelho)
- Na comanda, o barbeiro de cada serviço é **somente leitura** — para mudar, edite o agendamento na agenda
- Fechar comanda marca os atendimentos vinculados como **atendido** (`done`) e lança no caixa; só o **dono** fecha, reabre ou edita valores
- **Reabrir comanda**: pagamento com crédito do cliente **sempre volta** ao saldo; se a comanda tinha gerado crédito e esse valor já foi gasto em outro atendimento, o dono confirma e o valor gasto não volta (só estorna o que ainda sobrar)
- Comissão: % configurável por barbeiro, calculada sobre o valor **cobrado** de cada serviço (taxa de cartão não entra no cálculo)
- **Caixa lateral na agenda** (aba **CAIXA** à direita): abrir/fechar o caixa do dia, ver comandas fechadas, entradas, comissões e repasse da barbearia; link para métricas do dia
- **Financeiro** (`/admin/financeiro`): painel de **análise** por período (`from` / `to`) — faturamento, comissões, evolução diária, formas de pagamento e ranking por barbeiro; não é onde se abre/fecha caixa
- **Caixas** (`/admin/financeiro/caixas`): histórico de sessões de caixa no período — abrir, fechar, reabrir, KPIs e atalhos para agenda/comissões do dia
- **Comissões** (`/admin/financeiro/comissoes`): relatório por barbeiro filtrado por `service_date` (dia do atendimento/caixa), com detalhamento individual. O dono vê todos; o barbeiro vê só as próprias (**Minhas comissões** no menu)
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
- A **prévia do link no WhatsApp** (Open Graph) usa nome, bio curta e logo de `shop_settings`, com imagem gerada em `/agenda/opengraph-image` (1200×630). Se a prévia ficar desatualizada após um deploy, force a atualização no [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Passos: barbeiro (**ou sem preferência**) → serviços → data/horário → WhatsApp (busca automática) → confirmação ou cadastro de nome
- **Sem preferência:** o site mostra a união dos horários livres de quem faz os serviços; na hora de confirmar, o servidor escolhe o barbeiro **com menos agendamentos ativos naquele dia** (empate: ordem do apelido)
- **Preços na escolha de serviços:** como o dia ainda não foi escolhido, cada serviço mostra a **faixa de preço** (ex.: `Seg–Qua R$ 60,00 · Qui–Sáb R$ 70,00` ou `R$ 60,00 – R$ 70,00`). O total aparece como **“a partir de …”** quando há variação por dia
- **Serviços mais agendados:** no topo da lista aparece a seção **“Mais agendados”** (até 5 serviços com histórico de marcações); o restante fica em **“Outros serviços”**, ordenado pela mesma contagem
- **Preços após escolher a data:** na etapa de data/horário e na confirmação, o total passa a usar o **valor exato** do dia selecionado (mesma regra da API ao gravar)
- Aba **Meus horários**: cliente digita WhatsApp, vê agendamentos futuros (total já pelo preço do dia do horário), pode **remarcar** (data, horário, serviços) ou **cancelar**
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
| GET | `/api/v1/catalog` | Pública | Catálogo completo (`weekdayPrices` em cada serviço) ou `?mode=booking` enxuto para n8n/IA (`dayLabels` + `prices` agrupados) |
| GET | `/api/v1/availability` | Pública | Horários livres de um barbeiro (`professionalId`) ou de qualquer um (`anyProfessional=1`) |
| GET | `/api/v1/customers/by-whatsapp` | **Privada** | Buscar cliente pelo WhatsApp (retorna `id`) — **n8n** |
| GET | `/api/v1/customers/lookup` | Pública | Buscar cliente (site `/agenda`, resposta simples) |
| GET | `/api/v1/appointments?whatsapp=` | **Privada** | Listar agendamentos futuros do cliente |
| GET | `/api/v1/appointments/last-completed?whatsapp=` | **Privada** | Último atendimento concluído do cliente |
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

## Aviso automático ao barbeiro (webhook n8n)

Sempre que um agendamento novo é **criado**, **cancelado** ou **alterado/remarcado** — pelo site `/agenda`, pela IA (n8n) ou pelo painel admin — o sistema dispara um webhook para um workflow do n8n avisar o(s) barbeiro(s) no WhatsApp. Não dispara em exclusão definitiva (só o dono, via `deleteAppointment`) nem em reatribuição interna de serviço já existente na comanda.

- Configuração e comportamento completo: criação em [API-N8N.md, seção 6b](./API-N8N.md#6b-webhook-aviso-automático-ao-barbeiro-appointmentcreated), cancelamento em [seção 6c](./API-N8N.md#6c-webhook-aviso-automático-ao-barbeiro-appointmentcancelled), alteração em [seção 6d](./API-N8N.md#6d-webhook-aviso-automático-ao-barbeiro-appointmentupdated)
- Funções centrais: `notifyAppointmentCreated`, `notifyAppointmentCancelled` e `notifyAppointmentUpdated` em `src/lib/notifications/`
- Nunca bloqueia nem desfaz a operação principal se falhar (logs com prefixo `[appointment-webhook]`, `[appointment-cancelled-webhook]` e `[appointment-updated-webhook]`)
- `appointment.created` e `appointment.cancelled` são protegidos contra duplicidade pela tabela `appointment_notifications`; `appointment.updated` **não** bloqueia edições futuras (cada alteração relevante gera um novo aviso)

## Clientes

- Cadastro automático na primeira reserva (página ou painel); um WhatsApp = um cliente
- No painel, ao agendar: o WhatsApp busca o cadastro existente e **não altera o nome**; para corrigir dados, use **Clientes**
- Somente o **dono** vê **Clientes** (`/admin/clientes`): busca, cadastro manual em **Novo cliente**, ficha com histórico
- Na ficha do cliente: editar dados e ver histórico de visitas (data, barbeiro, serviços, status)
- Alterar nome/WhatsApp no painel atualiza também os agendamentos vinculados
- Exclusão só é permitida se o cliente não tiver agendamentos no histórico

## Fotos (profissionais, serviços e produtos)

- No upload: a pessoa **recorta** a foto (quadrado) e depois pode **arrastar** na prévia para ajustar o enquadramento
- Toda foto é **comprimida no navegador** (`src/lib/compress-image.ts`): até 1024px, WebP
- O ponto focal fica em `photo_position` (CSS `object-position`, padrão `50% 50%`) nas tabelas `professionals`, `services` e `products`
- Se a compressão falhar, o arquivo original é enviado (limite de 10 MB no `next.config.ts`)

## Riscos de segurança conhecidos (aceitos por ora)

Identificados em auditoria (jul/2026); decisão consciente de não corrigir agora — revisar quando fizer sentido:

- **`GET /api/v1/customers/lookup` permite enumerar WhatsApp cadastrados**: é pública (usada no site para autocompletar nome ao agendar) e devolve se um número é cliente. Só tem rate limit de 10 tentativas/15 min por IP. Mitigar exigiria sessão prévia ou CAPTCHA, o que mudaria a experiência de quem chega direto no site.
- **Sessão "Meus horários" não confirma posse do WhatsApp**: `POST /api/agenda/session` emite cookie de acesso aos agendamentos só de informar o número, sem checar se quem está pedindo é o dono dele. Corrigir direito exige enviar um código de verificação por WhatsApp (integração nova, ex. via n8n) — planejar quando essa integração existir.

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
