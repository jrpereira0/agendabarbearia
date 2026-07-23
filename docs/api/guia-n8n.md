# API Agenda Barbearia — guia para automação (n8n / WhatsApp)

Documento para colar no ChatGPT (ou outra IA) e pedir ajuda para montar workflows no **n8n** integrados ao sistema de agendamento.

---

## Contexto do sistema

- **Produto:** sistema de agendamento para barbearia (Agenda Barbearia).
- **Site do cliente:** `https://agendabarbearia-seven.vercel.app/agenda`
- **Painel admin:** `https://agendabarbearia-seven.vercel.app/login-admin` (login do dono/barbeiro).
- **API base (produção):** `https://agendabarbearia-seven.vercel.app/api/v1`
- **Fuso horário:** `America/Sao_Paulo`
- **Autenticação:**
  - **Públicas** (`/shop`, catálogo, disponibilidade): sem chave OK
  - **Privadas** (lookup de cliente, criar/listar/remarcar/cancelar, lembretes): chave de API no n8n, **ou** sessão OTP do cliente (cookie / `accessToken`)
  - Header da chave: `Authorization: Bearer dbc_live_<keyId>_<secret>` (Configurações > Integrações > Chaves de API)
- **Formato:** JSON em todas as respostas. Erros vêm como `{ "error": "mensagem" }` (ou `{ "ok": false, "error": "..." }` em `/customers`).

O bot no WhatsApp (via n8n) deve **chamar essa API** para consultar serviços e profissionais, horários livres, buscar cliente, criar/cancelar/remarcar agendamentos — as mesmas regras do site `/agenda`.

---

## Índice de rotas (todas as disponíveis)

| # | Método | Rota | Auth | Função |
| --- | --- | --- | --- | --- |
| 0 | `GET` | `/shop` | Pública | Dados da loja (nome, contato, horários, slots) |
| 1 | `GET` | `/services` | Pública | Listar serviços ativos (opcional `?professionalId=` / `?date=`) |
| 1b | `GET` | `/professionals` | Pública | Listar profissionais ativos (opcional `?serviceId=`) |
| 2 | `GET` | `/appointments/availability` | Pública | Horários livres |
| 3 | `GET` | `/customers?whatsapp=` | **Privada** | Buscar cliente (chave ou OTP do mesmo número) |
| 3b | `GET` | `/customers/me` | **Privada** | Perfil do cliente logado (só OTP / app) |
| 3c | `PATCH` | `/customers/me` | **Privada** | Editar nome/sobrenome do próprio cadastro (só OTP / app) |
| 5 | `GET` | `/appointments?whatsapp=` | **Privada** | Listar / histórico (`mode=upcoming` \| `history` \| `all`) |
| 5b | `GET` | `/appointments/last-completed?whatsapp=` | **Privada** | Último atendimento concluído do cliente |
| 6 | `POST` | `/appointments` | **Privada** | Criar agendamento (n8n: chave; site/app: OTP) |
| 6b | `PUT` | `/appointments/:id/status` | **Privada** | Atualizar status (`scheduled` / `confirmed` / `cancelled` / `done`) |
| 7 | `PATCH` | `/appointments/:id` | **Privada** | Remarcar agendamento |
| 8 | `DELETE` | `/appointments/:id?whatsapp=` | **Privada** | Cancelar agendamento |
| 8b | `GET` | `/appointment-reminders/due` | **Privada** | Listar lembretes vencidos (n8n consulta pra disparar no WhatsApp) — ver [seção 6e](#6e-lembretes-automáticos-para-clientes-1h-antes) |
| 8c | `POST` | `/appointment-reminders/:id/mark-sent` | **Privada** | Marcar lembrete como enviado |
| 8d | `GET` | `/appointment-reminders/pending-response?whatsapp=` | **Privada** | Buscar lembrete enviado aguardando confirmação do cliente |
| 8e | `POST` | `/appointment-reminders/:id/confirm` | **Privada** | Marcar lembrete como confirmado pelo cliente |

**Resumo:** públicas (0–2: loja, serviços, profissionais, disponibilidade) + privadas (3–3c, 5–8: cliente e agenda) + **4 rotas de lembretes** (8b–8e). Comandas, caixa e comissões ficam **só no painel** — ver regras em [financeiro.md](./financeiro.md). Encaixe e cadastros também só pelo painel.

**App do cliente:** [app-mobile.md](./app-mobile.md) · OTP: [cliente-otp-whatsapp.md](./cliente-otp-whatsapp.md)

**Referência interativa (OpenAPI):** [../openapi/v1.yaml](../openapi/v1.yaml) — tela dedicada em `/docs/api` (**Configurações → Integrações → Documentação da API**).

**Regra do header `Authorization`:** em rotas **públicas**, se você **não** enviar o header, a requisição passa. Se **enviar** `Bearer ...` de chave de API, a chave será validada — chave inválida retorna **401**.

---

## Autenticação com chave de API (n8n)

### Gerar a chave

1. Entre no painel como **dono**
2. Vá em **Configurações > Integrações > Chaves de API**
3. Clique em **Nova chave**, dê um nome (ex.: `WhatsApp n8n`) e escolha as permissões
4. **Copie a chave na hora** — ela não será exibida de novo

Formato da chave:

```
dbc_live_<keyId>_<secret>
```

### Configurar no n8n

| Campo | Valor |
| --- | --- |
| Tipo de credencial | **Header Auth** |
| Nome do header | `Authorization` |
| Valor | `Bearer dbc_live_SEU_KEYID_SEU_SECRET` |

Use a **mesma credencial** em todos os nós **HTTP Request** e **HTTP Request Tool** — inclusive nos nós de rotas públicas (`/shop`, `/services`, `/professionals`, `/appointments/availability`), para não misturar requisições com e sem header. `POST /appointments` é **privado** (precisa da chave).

### Exemplo (substitua pela chave copiada no painel — nunca commite a chave real)

```
GET https://agendabarbearia-seven.vercel.app/api/v1/services
Authorization: Bearer <sua-chave-do-painel>
```

### Permissões (scopes)

| Scope | Rotas |
| --- | --- |
| `catalog:read` | `GET /services`, `GET /professionals` |
| `availability:read` | `GET /appointments/availability` |
| `customers:read` | `GET /customers`, `GET /customers/me` (me = só sessão OTP) |
| `customers:update` | `PATCH /customers/me` (só sessão OTP do app/site) |
| `appointments:read` | `GET /appointments`, `GET /appointments/last-completed` |
| `appointments:create` | `POST /appointments` |
| `appointments:update` | `PATCH /appointments/:id`, `PUT /appointments/:id/status` |
| `appointments:cancel` | `DELETE /appointments/:id` |
| `appointment_reminders:read` | `GET /appointment-reminders/due`, `GET /appointment-reminders/pending-response` |
| `appointment_reminders:write` | `POST /appointment-reminders/:id/mark-sent`, `POST /appointment-reminders/:id/confirm` |

Presets no painel: **Agenda completa** (todos), **Somente leitura**, **Personalizada**.

### Erros de autenticação

| HTTP | Body | Quando |
| --- | --- | --- |
| **401** | `{ "ok": false, "error": "Não autorizado." }` | Chave ausente/inválida/revogada/expirada (mensagem genérica) |
| **403** | `{ "ok": false, "error": "Sem permissão." }` | Chave válida sem o scope da rota |

### Site público vs integração

- O site `/agenda` **não usa** chave de API no navegador
- **Meus horários / Agendar:** o site pede um **código no WhatsApp** (`POST /api/agenda/otp/send` + `verify`); depois usa cookie `agenda_client_session` (app: Bearer com `accessToken`). Guia: [cliente-otp-whatsapp.md](./cliente-otp-whatsapp.md) · [app-mobile.md](./app-mobile.md)
- **Novo agendamento:** `POST /api/v1/appointments` é **privado** (cookie OTP, Bearer do cliente ou chave de API)
- **Serviços, profissionais, disponibilidade e loja:** públicos (`GET /shop`, `GET /services`, `GET /professionals`, `GET /appointments/availability`)
- **Lookup de cliente** (`GET /customers`): **privado** — chave ou OTP do mesmo WhatsApp (app: preferir `GET /customers/me`)
- **Minha conta (app):** `GET` / `PATCH /customers/me` — só sessão OTP; edita nome/sobrenome (WhatsApp imutável). Guia: [app-mobile.md](./app-mobile.md)
- **Rotas sensíveis** exigem API Key, sessão admin, cookie de cliente ou Bearer do OTP — sem fallback público:

| Rota | Auth obrigatória |
| --- | --- |
| `GET /appointments` | Sim |
| `GET /appointments/last-completed` | Sim |
| `PUT /appointments/:id/status` | Sim (chave ou dono; não sessão do cliente) |
| `PATCH /appointments/:id` | Sim |
| `DELETE /appointments/:id` | Sim |
| `GET /appointment-reminders/due` | Sim |
| `GET /appointment-reminders/pending-response` | Sim |
| `POST /appointment-reminders/:id/mark-sent` | Sim |
| `POST /appointment-reminders/:id/confirm` | Sim |

- Se você **enviar** `Authorization: Bearer ...` na requisição, a chave será validada e o scope exigido
- Chaves com rate limit próprio: **120 req / 15 min** por chave (além dos limites por IP/WhatsApp onde aplicável)

---

1. **WhatsApp:** aceita **DDD + número** (10 ou 11 dígitos), com ou sem o prefixo `55`, com ou sem máscara (`(11) 98100-8852`) ou `+55`. O sistema normaliza e grava como `5511981008852`. Nos exemplos abaixo pode usar `11981008852` ou `5511981008852`.
2. **Datas:** formato `AAAA-MM-DD` (ex.: `2026-06-15`). Não aceita datas no passado para agendar.
3. **Horários:** formato `HH:MM` em 24h (ex.: `14:30`).
4. **IDs:** barbeiros e serviços usam **UUID**. Nunca usar texto placeholder como `ID_DO_JUNIOR`.
5. **Agenda aberta:** até **60 dias** à frente.
6. **Hoje:** só horários com pelo menos **10 minutos** de antecedência.
7. **Intervalo dos slots:** configurável na barbearia (`slotStepMinutes` no catálogo; ex.: **30 min**).
8. **Encaixe manual** e alteração de status pelo painel **não existem na API** — só agendamento normal de cliente.
9. **Cancelar pela API** marca status `cancelled` (não apaga o registro). Exclusão definitiva é só no painel admin.
10. **Cliente já cadastrado:** ao criar agendamento, se o WhatsApp existir com outro nome, a API recusa (mesma regra do site).

---

## Códigos HTTP

| Código | Quando |
| --- | --- |
| **200** | Sucesso |
| **401** | Rota **privada** sem auth (API Key, admin ou cookie de cliente); ou `Authorization: Bearer` inválido/ausente quando o header foi enviado |
| **403** | Chave válida ou cookie de cliente sem permissão (scope); ou WhatsApp da URL/body diferente do cookie de sessão |
| **404** | Profissional/serviço/agendamento não encontrado |
| **409** | Conflito (horário ocupado, data passada, agendamento não pode mais ser alterado) |
| **429** | Muitas requisições (rate limit) — header `Retry-After` em segundos |
| **503** | Sistema indisponível (Supabase não configurado ou erro interno) |

---

## Limites de uso (rate limit)

Se exceder, a API responde **429** com:

```json
{
  "error": "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
}
```

| Rotas | Limite |
| --- | --- |
| `GET /services`, `GET /professionals`, `GET /appointments/availability` | 60 requisições / 15 min por IP (ou por chave de API) |
| `GET /customers`, `GET|PATCH /customers/me`, `GET /appointments?whatsapp=` | 60 / 15 min por IP (ou por chave) |
| `POST /appointments` | 5 / hora por IP **e** 3 / hora por WhatsApp (chave: 120/15min por keyId) |
| `PUT /appointments/:id/status`, `PATCH /appointments/:id`, `DELETE /appointments/:id` | 10 / 15 min por IP (ou por chave) |
| Qualquer rota com chave de API | 120 / 15 min por `keyId` |

**Dica para n8n:** chamar `/services` e `/professionals` no início da conversa ou em cache; não repetir a cada mensagem “oi”.

---

## Dados atuais da barbearia (exemplo real)

Obtenha sempre a versão atual via `GET /services` e `GET /professionals`. Referência de junho/2026:

### Loja (`shop`)

| Campo | Valor |
| --- | --- |
| Nome | Dinho Barber Coffee |
| WhatsApp | 11981008852 |
| Instagram | dinhobarbercoffee |
| Endereço | Rua Paraguai, 173 - Enseada - Guarujá - SP |
| slotStepMinutes | 30 |

### Profissionais

| Apelido | professionalId |
| --- | --- |
| Junior Barber | `054a545a-75c8-4807-b72d-5c460bb3539f` |
| Seu Chico | `94e8b62b-366d-4c8d-baf5-2ca07165c93d` |

Cada profissional tem `serviceIds`: só os **IDs** dos serviços que ele realiza. Detalhes (nome, preço, duração) vêm de `GET /services` — recursos separados.

### Serviços

Os preços **variam por dia da semana** (cadastrados no painel). Em `GET /services`, cada serviço traz `prices` agrupados; com `?date=` vem também `priceCentsForDate`. Consulte sempre a API — a tabela abaixo é só referência histórica.

**Como o site `/agenda` mostra isso:**

| Momento do fluxo | O que o cliente vê |
| --- | --- |
| Escolha de serviços (antes da data) | Faixa por serviço, ex.: `Seg–Qua R$ 60,00 · Qui–Sáb R$ 70,00` ou `R$ 60,00 – R$ 70,00`. Total: **“a partir de …”** se houver variação |
| Data/horário e confirmação | Valor **exato** do dia escolhido (mesma regra de `GET /services?date=...` e de `POST /appointments`) |
| Meus horários | Total do agendamento pelo preço do **dia do horário** |

O bot pode seguir a mesma lógica: mostrar `prices` de `GET /services` no início e, depois que o cliente escolher a data, usar `priceCentsForDate` (`?date=`) ou o total de `GET /appointments/availability` antes de confirmar.

| Nome | serviceId | Duração | Preço (ex.) |
| --- | --- | --- | --- |
| Barba | `0ab080c4-514c-41ef-9ad3-07b66141d0c1` | 30 min | varia por dia |
| Corte | `3a62b091-6916-4741-a3d4-754a33b2cb31` | 30 min | varia por dia |
| Corte e Barba | `da8126ca-730d-49e9-a429-2dd0d6965409` | 60 min | varia por dia |

### Horário de funcionamento

- **Segunda a sábado:** 09:00–19:00
- **Domingo:** fechado

---

## Endpoints (detalhado)

### 1. Serviços

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/services` |
| **Auth** | Pública. Opcional: chave com `catalog:read` |
| **Rate limit** | 60 / 15 min por IP |

Lista dados do serviço úteis pra bot/integração (nome, descrição, duração, preços, foto)
e **quem realiza**: `professionalIds` + resumo (`id`, `nickname`, `photoUrl`).

Não vêm: `photoPosition`, `bookingCount`, `weekdayPrices`, `priceLabel` (ajuste visual / ranking do site — o detalhe de preço fica em `prices`).

| Query | Descrição |
| --- | --- |
| `professionalId` | Opcional — só serviços que esse barbeiro realiza |
| `date` | Opcional — `AAAA-MM-DD` para preencher `priceCentsForDate` do dia |

```
GET {{baseUrl}}/services
GET {{baseUrl}}/services?professionalId=054a545a-75c8-4807-b72d-5c460bb3539f
GET {{baseUrl}}/services?date=2026-07-22
```

---

### 1b. Profissionais

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/professionals` |
| **Auth** | Pública. Opcional: chave com `catalog:read` |
| **Rate limit** | 60 / 15 min por IP |

Lista **só dados públicos do profissional** (apelido, foto, `serviceIds`). Não embute detalhes de serviços.

Não entram nesta rota pública: `photoPosition`, e-mail, WhatsApp do barbeiro, nome/sobrenome completo nem comissão (dados internos do painel / ajuste visual do site).

| Query | Descrição |
| --- | --- |
| `serviceId` | Opcional — só quem realiza aquele serviço |

```
GET {{baseUrl}}/professionals
GET {{baseUrl}}/professionals?serviceId=3a62b091-6916-4741-a3d4-754a33b2cb31
```

**Resposta (exemplo):**

```json
{
  "ok": true,
  "timezone": "America/Sao_Paulo",
  "professionals": [
    {
      "id": "054a545a-75c8-4807-b72d-5c460bb3539f",
      "nickname": "Junior Barber",
      "photoUrl": "https://...",
      "serviceIds": ["0ab080c4-...", "3a62b091-...", "da8126ca-..."]
    }
  ]
}
```

Para montar o card completo no bot: chame `/professionals` e `/services` e cruze pelos IDs.

---

### 2. Horários livres

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/appointments/availability` |
| **Auth** | Pública (sem header). Opcional: chave com `availability:read` |
| **Rate limit** | 60 / 15 min por IP |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `professionalId` | Condicional | UUID do barbeiro (**obrigatório** se não usar `anyProfessional`) |
| `anyProfessional` | Condicional | `1` = união dos horários de quem faz os serviços (**obrigatório** se não enviar `professionalId`) |
| `date` | Sim | `AAAA-MM-DD` |
| `serviceIds` | Sim | Um ou mais UUIDs separados por **vírgula** (sem espaço) |
| `excludeAppointmentId` | Não | UUID ao remarcar (ignora o próprio agendamento no cálculo) |

**Sem preferência (qualquer barbeiro livre):**

```
GET {{baseUrl}}/appointments/availability?anyProfessional=1&date=2026-06-15&serviceIds=da8126ca-730d-49e9-a429-2dd0d6965409
```

**Exemplo — Junior + Corte e Barba em 15/06/2026:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/appointments/availability?professionalId=054a545a-75c8-4807-b72d-5c460bb3539f&date=2026-06-15&serviceIds=da8126ca-730d-49e9-a429-2dd0d6965409
```

**Resposta 200 — com horários disponíveis:**

```json
{
  "ok": true,
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "date": "2026-06-15",
  "durationMinutes": 60,
  "totalPriceCents": 12000,
  "slots": ["09:00", "09:30", "10:00", "10:30"],
  "available": true,
  "unavailableReason": null,
  "message": null,
  "professionalDayOff": false,
  "shopClosed": false,
  "workingPeriods": [
    { "startTime": "09:00", "endTime": "19:00" }
  ]
}
```

**Resposta 200 — profissional de folga:**

```json
{
  "ok": true,
  "professionalId": "054a545a-...",
  "date": "2026-06-21",
  "durationMinutes": 60,
  "totalPriceCents": 12000,
  "slots": [],
  "available": false,
  "unavailableReason": "professional_day_off",
  "message": "Profissional de folga nessa data.",
  "professionalDayOff": true,
  "shopClosed": false,
  "workingPeriods": []
}
```

**Resposta 200 — agenda cheia (profissional trabalha, mas sem horários livres):**

```json
{
  "ok": true,
  "professionalId": "054a545a-...",
  "date": "2026-06-15",
  "durationMinutes": 60,
  "totalPriceCents": 12000,
  "slots": [],
  "available": false,
  "unavailableReason": "no_slots",
  "message": "Não há horários disponíveis para esse profissional nessa data.",
  "professionalDayOff": false,
  "shopClosed": false,
  "workingPeriods": [
    { "startTime": "09:00", "endTime": "19:00" }
  ]
}
```

**Resposta 200 — barbearia fechada:**

```json
{
  "ok": true,
  "slots": [],
  "available": false,
  "unavailableReason": "shop_closed",
  "message": "A barbearia está fechada nessa data.",
  "professionalDayOff": false,
  "shopClosed": true,
  "workingPeriods": []
}
```

**Campos da resposta:**

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `slots` | `string[]` | Horários de início disponíveis (`"HH:MM"`). Vazio quando indisponível. **Campo legado — sempre presente.** |
| `available` | `boolean` | `true` quando há pelo menos um horário livre |
| `unavailableReason` | `string \| null` | Motivo quando `available = false` (ver tabela abaixo) |
| `message` | `string \| null` | Mensagem legível para o cliente / IA. `null` quando disponível |
| `professionalDayOff` | `boolean` | O barbeiro está de folga nesta data |
| `shopClosed` | `boolean` | A barbearia está fechada nesta data |
| `workingPeriods` | `{ startTime, endTime }[]` | Faixas de trabalho do barbeiro (antes de remover horários ocupados) |
| `durationMinutes` | `number` | Duração total dos serviços em minutos |
| `totalPriceCents` | `number` | Preço total em centavos |

**Valores de `unavailableReason`:**

| Valor | Quando ocorre |
| --- | --- |
| `null` | Há horários disponíveis |
| `"shop_closed"` | Barbearia fechada nessa data (grade semanal ou exceção de folha) |
| `"professional_day_off"` | Barbeiro sem expediente ou com exceção de folga nessa data |
| `"no_slots"` | Barbeiro trabalha no dia, mas toda a agenda está ocupada ou bloqueada |
| `"service_unavailable_on_date"` | O serviço não tem preço configurado para esse dia da semana |

**Erros comuns (400/404):**

| Mensagem | Causa |
| --- | --- |
| `professionalId inválido.` | UUID errado ou placeholder |
| `Essa data já passou.` | Data no passado |
| `Escolha pelo menos um serviço.` | `serviceIds` vazio |
| `Profissional não encontrado.` | UUID inexistente ou inativo |
| `Serviço não encontrado.` | UUID de serviço inválido |

**Uso no bot:**

- Verificar `available` antes de listar horários.
- Usar `message` para responder ao cliente quando `available = false` — ex.: _"O Chico está de folga nesse dia. Quer tentar outro dia ou outro barbeiro?"_
- Quando `unavailableReason = "professional_day_off"`, o bot pode sugerir outra data ou outro profissional.
- `workingPeriods` informa ao bot o horário de trabalho do barbeiro (para respostas como _"O Junior trabalha das 09:00 às 19:00"_).
- `totalPriceCents / 100` = valor em reais.

---

### 3. Buscar cliente

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/customers` |
| **Auth** | **Obrigatória** — chave (`customers:read`), dono, ou OTP do **mesmo** WhatsApp |
| **Rate limit** | 10 / 15 min por IP (ou por chave) |

Busca o cliente pelo WhatsApp e devolve só o essencial: `id`, `firstName`, `lastName` e `whatsapp`.

No **app**, use `GET /customers/me` com o Bearer (sem passar WhatsApp na URL).

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | Número do cliente (aceita máscara, `+55`, com ou sem `55`) |

**Exemplos (n8n — com chave):**

```
GET {{baseUrl}}/customers?whatsapp=11981008852
Authorization: Bearer dbc_live_...
```

**Cliente encontrado (200):**

```json
{
  "ok": true,
  "found": true,
  "customer": {
    "id": "uuid-do-cliente",
    "firstName": "João",
    "lastName": "Silva",
    "whatsapp": "5511981008852"
  }
}
```

**Cliente não encontrado (200):**

```json
{
  "ok": true,
  "found": false,
  "customer": null
}
```

**WhatsApp inválido (400):**

```json
{
  "ok": false,
  "error": "WhatsApp inválido."
}
```

**Uso no bot:** se `found: true`, use `customer.firstName`, `customer.lastName` e `customer.whatsapp` no `POST /appointments`. Se `found: false`, pergunte nome e sobrenome.

**Teste (terminal):**

```bash
curl -s "https://agendabarbearia-seven.vercel.app/api/v1/customers?whatsapp=13981008852" \
  -H "Authorization: Bearer dbc_live_SUA_CHAVE"
```

---

### 3b. Minha conta (app — perfil do cliente)

| | |
| --- | --- |
| **Métodos** | `GET` e `PATCH` |
| **Rota** | `/customers/me` |
| **Auth** | **Só sessão OTP** (`Authorization: Bearer <accessToken>` do verify). Chave de API → **403**. |
| **Scopes** | `customers:read` (GET), `customers:update` (PATCH) |

Usado pela aba **Minha conta** do app. O WhatsApp vem da sessão — **não** vai na URL nem no body do PATCH.

**GET** — ler cadastro:

```http
GET {{baseUrl}}/customers/me
Authorization: Bearer <accessToken>
```

**PATCH** — editar nome/sobrenome (cria o cadastro se ainda não existir):

```http
PATCH {{baseUrl}}/customers/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "firstName": "João", "lastName": "Silva" }
```

Resposta de sucesso do PATCH:

```json
{
  "ok": true,
  "customer": {
    "id": "uuid-do-cliente",
    "firstName": "João",
    "lastName": "Silva",
    "whatsapp": "5511981008852"
  }
}
```

Contrato completo: [app-mobile.md](./app-mobile.md#minha-conta-perfil-do-cliente).

---

### 5. Consultar agendamentos / histórico

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/appointments` |
| **Auth** | **Obrigatória** — chave de API (`appointments:read`), sessão admin, cookie OTP ou Bearer `accessToken` |
| **Rate limit** | 10 / 15 min por IP (ou por chave / WhatsApp da sessão) |

**Quem autentica como:**

| Origem | Como |
| --- | --- |
| **n8n** | `Authorization: Bearer dbc_live_...` |
| **Site — Meus horários** | OTP (`/api/agenda/otp/verify`) → cookie → `GET /appointments` com `credentials: include` |
| **App** | OTP → guardar `accessToken` → `Authorization: Bearer <accessToken>` |
| **Painel admin** | Sessão Supabase (login do dono/barbeiro) |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | WhatsApp do cliente (normalizado automaticamente) |
| `mode` | Não | `upcoming` (padrão), `history` ou `all` |

| `mode` | O que retorna |
| --- | --- |
| `upcoming` | Futuros ativos (`scheduled` / `confirmed`) — site "Meus horários" |
| `history` | Passados, cancelados e concluídos (mais recentes primeiro) |
| `all` | Todos os status (até 50) |

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/appointments?whatsapp=11981008852
GET https://agendabarbearia-seven.vercel.app/api/v1/appointments?whatsapp=11981008852&mode=history
Authorization: Bearer dbc_live_SEU_KEYID_SEU_SECRET
```

**Resposta 200:**

```json
{
  "ok": true,
  "mode": "upcoming",
  "appointments": [
    {
      "id": "uuid-do-agendamento",
      "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
      "professionalName": "Junior Barber",
      "professionalPhotoUrl": "https://...",
      "date": "2026-06-15",
      "startTime": "14:30",
      "status": "scheduled",
      "serviceIds": ["da8126ca-730d-49e9-a429-2dd0d6965409"],
      "serviceNames": ["Corte e Barba"],
      "totalMinutes": 60,
      "totalPriceCents": 12000
    }
  ]
}
```

Sem encaixe. Array vazio se não houver nenhum no modo pedido.

---

### 5b. Último atendimento concluído

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/appointments/last-completed` |
| **Auth** | **Privada** — scope `appointments:read` |
| **Rate limit** | 10 / 15 min (mesmo bucket de consultas sensíveis por WhatsApp) |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | WhatsApp do cliente |

**Exemplo:**

```bash
curl -G "https://agendabarbearia-seven.vercel.app/api/v1/appointments/last-completed" \
  --data-urlencode "whatsapp=5513981008852" \
  -H "Authorization: Bearer SUA_CHAVE"
```

**Resposta 200 — encontrado:**

```json
{
  "found": true,
  "lastAppointment": {
    "appointmentId": "uuid",
    "professionalId": "uuid",
    "professionalName": "Chico",
    "date": "2026-06-20",
    "startTime": "15:00",
    "serviceIds": ["uuid"],
    "serviceNames": ["02 - Corte Qui. - Sáb."]
  }
}
```

**Resposta 200 — sem histórico:**

```json
{
  "found": false,
  "lastAppointment": null
}
```

**Sem chave (401):** `{ "ok": false, "error": "Não autorizado." }`

Retorna o agendamento mais recente com status **`done`** (atendido), ordenado por data e horário decrescentes.

---

### 6. Criar agendamento

| | |
| --- | --- |
| **Método** | `POST` |
| **Rota** | `/appointments` |
| **Auth** | **Obrigatória** — chave com `appointments:create` (n8n), cookie OTP (site) ou Bearer `accessToken` (app) |
| **Rate limit** | 5 / hora por IP e 3 / hora por WhatsApp |
| **Headers** | `Content-Type: application/json` |

**Body (JSON):**

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `professionalId` | UUID | Condicional | Barbeiro (**obrigatório** se `anyProfessional` não for `true`) |
| `anyProfessional` | boolean | Condicional | `true` = servidor escolhe o barbeiro com **menos agendamentos ativos no dia** entre quem tem o horário livre |
| `date` | string | Sim | `AAAA-MM-DD` |
| `startTime` | string | Sim | `HH:MM` |
| `serviceIds` | UUID[] | Sim | Pelo menos um serviço |
| `firstName` | string | Sim | Nome do cliente |
| `lastName` | string | Sim | Sobrenome |
| `whatsapp` | string | Sim | WhatsApp (normalizado automaticamente) |

**Exemplo:**

```json
{
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "date": "2026-06-15",
  "startTime": "14:30",
  "serviceIds": ["da8126ca-730d-49e9-a429-2dd0d6965409"],
  "firstName": "Maria",
  "lastName": "Santos",
  "whatsapp": "11981008852"
}
```

**Sucesso (200):**

```json
{
  "ok": true,
  "appointmentId": "uuid-gerado",
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "professionalNickname": "Junior"
}
```

Com `anyProfessional: true`, o `professionalId` / `professionalNickname` são os do barbeiro atribuído (o com menos horários no dia, entre quem tinha o slot livre).

**Erros comuns:**

| HTTP | Mensagem típica |
| --- | --- |
| 401 | Sem auth (chave / cookie OTP / Bearer) |
| 409 | `Esse horário não está mais disponível. Escolha outro.` |
| 409 | `Esse horário acabou de ser ocupado. Escolha outro.` |
| 400 | Validação (nome vazio, WhatsApp inválido, UUID inválido…) |
| 429 | Muitas tentativas |
| 500 | `Este WhatsApp já pertence a [nome]. Verifique o número…` (nome diferente do cadastro) |

O servidor **valida de novo** se o horário está livre antes de gravar. Status inicial: `scheduled`. Se o cliente já existir com o mesmo nome, reutiliza o cadastro; se existir com outro nome, recusa.

---

### 6b. Webhook: aviso automático ao barbeiro (`appointment.created`)

Depois que um agendamento é criado com sucesso, o sistema pode disparar um **webhook** para um workflow do n8n avisar o barbeiro no WhatsApp. Isso é separado da API de criação — o cliente nunca vê esse processo nem é afetado se ele falhar.

**Cobre todos os pontos de criação de agendamento do sistema.** Cada um envia um valor diferente no campo `source` do payload, para o workflow do n8n (e os logs) saberem de onde veio sem precisar adivinhar:

| Origem | `source` | Onde acontece |
| --- | --- | --- |
| Site `/agenda` ou app (OTP) e bot via n8n | `public_api` | `POST /appointments` |
| Painel admin — botão **+ Agendar** | `admin_agenda` | Server action `createNormalAppointment` |
| Painel admin — botão **+ Encaixe** | `admin_squeeze_in` | Server action `createSqueezeInAppointment` |
| Painel admin — serviço extra novo na comanda | `comanda_extra` | `updateComandaItems` (modal da comanda) |

Não notifica ao **reatribuir um serviço da comanda para outro barbeiro** (o cliente já está sendo atendido na loja, não é um agendamento novo) nem ao **editar/remarcar** um agendamento existente — só na criação.

**Como habilitar:** configure as variáveis de ambiente na Vercel (ver [Checklist Vercel](#checklist-vercel-api-no-ar)):

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `N8N_APPOINTMENT_WEBHOOK_URL` | Não | URL do webhook do n8n. Se vazia, nenhum webhook é enviado e o agendamento continua funcionando normalmente |
| `N8N_APPOINTMENT_WEBHOOK_SECRET` | Não (recomendado) | Segredo enviado no header `x-appointment-webhook-secret`, para o n8n validar que a chamada veio do sistema |

**Regras de comportamento:**

- Disparado **só depois** que o agendamento e os serviços já foram salvos no banco com sucesso.
- **Nunca** derruba o agendamento nem retorna erro para quem chamou `POST /appointments` — a resposta continua `{ "ok": true, "appointmentId": "..." }` mesmo se o webhook falhar.
- Se o **profissional não tiver WhatsApp cadastrado** (campo vazio no painel > Profissionais), o webhook **não é enviado** — evita chamar o n8n com um número inválido.
- Falhas de rede, timeout ou erro do n8n geram apenas um `console.warn`/`console.error` nos logs da Vercel (com o `appointmentId`), para debug — nunca uma exceção.
- Protegido contra **envio duplicado**: antes de enviar, o sistema tenta gravar um registro `(appointment_id, event)` na tabela `appointment_notifications` (chave única). Se já existir — outro retry, chamada duplicada etc. — o envio é ignorado e loga `notificação já enviada, ignorando`. A tabela também guarda o `source`, para auditoria.

**Requisição enviada ao n8n:**

```
POST {{N8N_APPOINTMENT_WEBHOOK_URL}}
Content-Type: application/json
x-appointment-webhook-secret: {{N8N_APPOINTMENT_WEBHOOK_SECRET}}
```

**Payload:**

```json
{
  "event": "appointment.created",
  "source": "admin_agenda",
  "appointment": {
    "id": "uuid",
    "date": "2026-07-08",
    "startTime": "10:00",
    "endTime": "10:30",
    "totalPriceCents": 6500
  },
  "customer": {
    "firstName": "Matheus",
    "lastName": "Silva",
    "whatsapp": "5513999999999"
  },
  "professional": {
    "id": "uuid",
    "name": "Chico",
    "whatsapp": "5513988888888"
  },
  "services": [
    { "id": "uuid", "name": "Corte", "priceCents": 6500 }
  ],
  "shop": {
    "name": "Dinho Barber Coffee"
  }
}
```

`source` pode ser `"public_api"`, `"admin_agenda"`, `"admin_squeeze_in"` ou `"comanda_extra"` (ver tabela acima) — útil para o workflow tratar diferente cada origem, por exemplo pulando o aviso pro encaixe se preferir.

**Origem gravada no agendamento (`booking_source`):** além do `source` do webhook, cada agendamento grava internamente `admin`, `site` ou `ai` em `appointments.booking_source` — usado pelo ícone na agenda do painel. Em `POST /appointments`, o sistema grava `ai` quando a chamada usa **chave de API** (n8n/IA) e `site` quando é o site/app com sessão OTP do cliente.

`professional.whatsapp` e `customer.whatsapp` já vêm normalizados (DDI + DDD + número, sem máscara) — prontos para usar em nós de envio de WhatsApp (Evolution API, Z-API, etc.). `totalPriceCents` já soma o preço de todos os serviços **no dia do agendamento** (considerando preço por dia da semana).

**Configuração do nó Webhook no n8n:**

1. Adicione um nó **Webhook** (método `POST`), copie a URL gerada e coloque em `N8N_APPOINTMENT_WEBHOOK_URL` na Vercel.
2. No nó **Webhook**, em "Authentication", pode deixar `None` e validar o segredo manualmente num nó **IF** logo em seguida, comparando `{{$json.headers['x-appointment-webhook-secret']}}` com o valor configurado em `N8N_APPOINTMENT_WEBHOOK_SECRET`.
3. Depois do IF, monte a mensagem de WhatsApp usando `{{$json.body.professional.whatsapp}}`, `{{$json.body.customer.firstName}}`, `{{$json.body.appointment.date}}`, `{{$json.body.appointment.startTime}}` e `{{$json.body.services}}`.
4. Envie pelo nó do seu provedor de WhatsApp (Evolution API, Z-API, etc.) usando `professional.whatsapp` como destinatário — nunca hardcode o número do barbeiro no workflow.

**Testar manualmente (sem esperar um agendamento real):**

```bash
curl -X POST https://SEU-N8N/webhook/agendamento-criado \
  -H "Content-Type: application/json" \
  -H "x-appointment-webhook-secret: SEU_SECRET" \
  -d '{
    "event": "appointment.created",
    "source": "admin_agenda",
    "appointment": { "id": "teste", "date": "2026-07-08", "startTime": "10:00", "endTime": "10:30", "totalPriceCents": 6500 },
    "customer": { "firstName": "Teste", "lastName": "Cliente", "whatsapp": "5513999999999" },
    "professional": { "id": "teste", "name": "Chico", "whatsapp": "5513988888888" },
    "services": [{ "id": "teste", "name": "Corte", "priceCents": 6500 }],
    "shop": { "name": "Dinho Barber Coffee" }
  }'
```

---

### 6c. Webhook: aviso automático ao barbeiro (`appointment.cancelled`)

Mesma ideia da seção anterior, mas disparado quando um agendamento é **cancelado** (nunca quando é excluído/apagado de vez pelo dono, nem ao remarcar). Reaproveita a mesma URL, o mesmo segredo e a mesma proteção contra duplicidade do `appointment.created`.

**Cobre todos os pontos de cancelamento do sistema:**

| Origem | `source` | Onde acontece |
| --- | --- | --- |
| Site público `/agenda` (aba "Meus horários") e bot via n8n | `api_cancel` | `DELETE /appointments/:id` |
| Painel admin — cancelar agendamento normal | `admin_cancel` | Server action `cancelAppointment` |
| Painel admin — cancelar encaixe manual | `admin_squeeze_cancel` | Server action `cancelAppointment` (ramo do encaixe) |

Quando um agendamento normal é cancelado e ele tinha **encaixes vinculados** (mesmo cliente/dia), esses encaixes também são cancelados automaticamente — e cada um dispara seu próprio aviso com `source: "admin_squeeze_cancel"`.

**Não dispara** ao **excluir** um agendamento (`deleteAppointment`, exclusão definitiva feita só pelo dono) nem ao **reatribuir um serviço da comanda para outro barbeiro** (troca de barbeiro internamente cancela e recria o registro, mas não é um cancelamento visível pro cliente).

**Variáveis de ambiente:** as mesmas do `appointment.created` — `N8N_APPOINTMENT_WEBHOOK_URL` e `N8N_APPOINTMENT_WEBHOOK_SECRET` (ver seção 6b). Se a URL não estiver configurada, nenhum webhook é enviado e o cancelamento continua funcionando normalmente.

**Regras de comportamento:** as mesmas do `appointment.created` (nunca derruba o cancelamento nem muda a resposta da rota/action, pula se o profissional não tiver WhatsApp, protegido contra duplicidade pela tabela `appointment_notifications` — mesma tabela, `event` diferente).

**Payload:**

```json
{
  "event": "appointment.cancelled",
  "source": "admin_cancel",
  "appointment": {
    "id": "uuid",
    "date": "2026-07-08",
    "startTime": "10:00",
    "endTime": "10:30",
    "status": "cancelled",
    "cancelReason": "Cliente solicitou cancelamento"
  },
  "customer": {
    "firstName": "Matheus",
    "lastName": "Silva",
    "whatsapp": "5513999999999"
  },
  "professional": {
    "id": "uuid",
    "name": "Chico",
    "whatsapp": "5513988888888"
  },
  "services": [
    { "id": "uuid", "name": "Corte", "priceCents": 6500 }
  ],
  "shop": {
    "name": "Dinho Barber Coffee"
  }
}
```

`cancelReason` vem `null` quando não há motivo registrado (é o caso do cancelamento pelo site `/agenda` e pela IA, que não pedem motivo — só o painel admin exige). `source` pode ser `"api_cancel"`, `"admin_cancel"` ou `"admin_squeeze_cancel"` (ver tabela acima).

**Testar manualmente:**

```bash
curl -X POST https://SEU-N8N/webhook/agendamento-criado \
  -H "Content-Type: application/json" \
  -H "x-appointment-webhook-secret: SEU_SECRET" \
  -d '{
    "event": "appointment.cancelled",
    "source": "admin_cancel",
    "appointment": { "id": "teste", "date": "2026-07-08", "startTime": "10:00", "endTime": "10:30", "status": "cancelled", "cancelReason": "Cliente pediu para cancelar" },
    "customer": { "firstName": "Teste", "lastName": "Cliente", "whatsapp": "5513999999999" },
    "professional": { "id": "teste", "name": "Chico", "whatsapp": "5513988888888" },
    "services": [{ "id": "teste", "name": "Corte", "priceCents": 6500 }],
    "shop": { "name": "Dinho Barber Coffee" }
  }'
```

No n8n, use um nó **IF** ou **Switch** logo após validar o segredo, ramificando por `{{$json.body.event}}` (`appointment.created`, `appointment.cancelled` ou `appointment.updated`) para montar mensagens diferentes no WhatsApp do barbeiro.

---

### 6d. Webhook: aviso automático ao barbeiro (`appointment.updated`)

Disparado quando um agendamento é **alterado/remarcado** com sucesso (data, horário, profissional ou serviços). Reaproveita a mesma URL e o mesmo segredo dos outros eventos.

**Cobre todos os pontos de edição do sistema:**

| Origem | `source` | Onde acontece |
| --- | --- | --- |
| Site `/agenda` (aba "Meus horários"), bot via n8n | `api_update` | `PATCH /appointments/:id` |
| Painel admin — editar agendamento normal | `admin_update` | Server action `updateAppointment` |
| Painel admin — editar encaixe manual | `admin_squeeze_update` | Server action `updateAppointment` (ramo do encaixe) |

**Não dispara** se a edição falhar, se não houver **nenhuma mudança relevante** (data, horário, profissional, serviços ou valor) ou ao mudar apenas o status do fluxo (`scheduled` → `done` etc.).

**Idempotência:** diferente de `appointment.created` e `appointment.cancelled`, **não bloqueia** edições futuras — cada alteração relevante gera um novo webhook (o mesmo agendamento pode ser editado várias vezes).

**Payload** inclui estado **anterior** e **novo**, além de um array `changes` com frases prontas para montar a mensagem no n8n. Se o profissional mudou, o payload traz `professional` (novo) e `previousProfessional` (antigo) — o workflow pode avisar os dois barbeiros.

```json
{
  "event": "appointment.updated",
  "source": "api_update",
  "appointment": {
    "id": "uuid",
    "date": "2026-07-09",
    "startTime": "14:00",
    "endTime": "14:30",
    "status": "scheduled",
    "totalPriceCents": 6500
  },
  "previousAppointment": {
    "id": "uuid",
    "date": "2026-07-08",
    "startTime": "10:00",
    "endTime": "10:30",
    "status": "scheduled",
    "totalPriceCents": 6000
  },
  "customer": {
    "firstName": "Matheus",
    "lastName": "Silva",
    "whatsapp": "5513999999999"
  },
  "professional": {
    "id": "uuid-novo",
    "name": "Querino",
    "whatsapp": "5513999999999"
  },
  "previousProfessional": {
    "id": "uuid-antigo",
    "name": "Chico",
    "whatsapp": "5513888888888"
  },
  "services": [
    { "id": "uuid", "name": "Corte de Cabelo", "priceCents": 6500 }
  ],
  "previousServices": [
    { "id": "uuid", "name": "Barba", "priceCents": 6000 }
  ],
  "changes": [
    "Data alterada de 08/07/2026 para 09/07/2026",
    "Horário alterado de 10h para 14h",
    "Profissional alterado de Chico para Querino",
    "Serviço alterado de Barba para Corte de Cabelo",
    "Valor alterado de R$ 60,00 para R$ 65,00"
  ],
  "shop": {
    "name": "Dinho Barber Coffee"
  }
}
```

**Testar manualmente:**

```bash
curl -X POST https://SEU-N8N/webhook/agendamento-criado \
  -H "Content-Type: application/json" \
  -H "x-appointment-webhook-secret: SEU_SECRET" \
  -d '{
    "event": "appointment.updated",
    "source": "admin_update",
    "appointment": { "id": "teste", "date": "2026-07-09", "startTime": "14:00", "endTime": "14:30", "status": "scheduled", "totalPriceCents": 6500 },
    "previousAppointment": { "id": "teste", "date": "2026-07-08", "startTime": "10:00", "endTime": "10:30", "status": "scheduled", "totalPriceCents": 6000 },
    "customer": { "firstName": "Teste", "lastName": "Cliente", "whatsapp": "5513999999999" },
    "professional": { "id": "novo", "name": "Querino", "whatsapp": "5513999999999" },
    "previousProfessional": { "id": "antigo", "name": "Chico", "whatsapp": "5513888888888" },
    "services": [{ "id": "s2", "name": "Corte", "priceCents": 6500 }],
    "previousServices": [{ "id": "s1", "name": "Barba", "priceCents": 6000 }],
    "changes": ["Data alterada de 08/07/2026 para 09/07/2026", "Horário alterado de 10h para 14h"],
    "shop": { "name": "Dinho Barber Coffee" }
  }'
```

---

### 6e. Lembretes automáticos para clientes (1h antes)

O sistema **controla** os lembretes na tabela `appointment_reminders`. O n8n **não usa Wait** — consulta periodicamente os lembretes vencidos, envia o WhatsApp e marca o status via API.

**Quando o lembrete é criado/atualizado:**
- Após `appointment.created` (qualquer origem)
- Após `appointment.updated` com mudança relevante (data, horário, profissional, serviços ou valor)

**Quando o lembrete é cancelado:**
- Após `appointment.cancelled`
- Se o agendamento ficar inativo ou no passado

**Escopos da chave de API:** `appointment_reminders:read` e `appointment_reminders:write` (incluídos no preset **Agenda completa**).

#### GET `/appointment-reminders/due`

| | |
| --- | --- |
| **Auth** | `appointment_reminders:read` |
| **Query** | `limit` (1–100, padrão 50), `now` (ISO opcional — para testes) |

Retorna lembretes com `status = pending`, `scheduled_for <= now`, agendamento ativo e ainda no futuro.

**Resposta:**

```json
{
  "ok": true,
  "reminders": [
    {
      "id": "uuid-reminder",
      "appointmentId": "uuid",
      "scheduledFor": "2026-07-08T18:00:00.000Z",
      "appointment": {
        "id": "uuid",
        "date": "2026-07-08",
        "startTime": "19:00",
        "endTime": "19:30",
        "totalPriceCents": 6000
      },
      "customer": {
        "firstName": "Matheus",
        "lastName": "Silva",
        "whatsapp": "5513999999999"
      },
      "professional": {
        "id": "uuid",
        "name": "Chico"
      },
      "services": [
        { "id": "uuid", "name": "Corte de Cabelo", "priceCents": 6000 }
      ],
      "shop": {
        "name": "Dinho Barber Coffee",
        "address": "Rua Paraguai, 173 · Enseada – Guarujá – SP"
      }
    }
  ]
}
```

#### POST `/appointment-reminders/:id/mark-sent`

| | |
| --- | --- |
| **Auth** | `appointment_reminders:write` |
| **Body** | `{ "providerMessageId": "opcional" }` |

Marca `status = sent` e `sent_at = now()`. Só aceita lembrete com `status = pending`.

#### GET `/appointment-reminders/pending-response?whatsapp=`

| | |
| --- | --- |
| **Auth** | `appointment_reminders:read` |

Busca o lembrete mais recente **enviado** nas últimas 4 horas para o WhatsApp informado, com agendamento ainda ativo e futuro. Usado pelo bot para saber qual agendamento o cliente está confirmando.

**Resposta (encontrou):**

```json
{
  "ok": true,
  "found": true,
  "reminder": {
    "id": "uuid-reminder",
    "appointmentId": "uuid",
    "appointment": { "id": "uuid", "date": "2026-07-08", "startTime": "19:00", "endTime": "19:30", "totalPriceCents": 6000 },
    "customer": { "firstName": "Matheus", "lastName": "Silva", "whatsapp": "5513999999999" },
    "professional": { "id": "uuid", "name": "Chico" },
    "services": [{ "id": "uuid", "name": "Corte", "priceCents": 6000 }],
    "shop": { "name": "Dinho Barber Coffee", "address": "..." }
  }
}
```

**Resposta (não encontrou):**

```json
{
  "ok": true,
  "found": false,
  "reminder": null
}
```

#### POST `/appointment-reminders/:id/confirm`

| | |
| --- | --- |
| **Auth** | `appointment_reminders:write` |

Marca `status = confirmed` e `confirmed_at = now()`. Se o agendamento ainda estiver `scheduled`, passa para `confirmed`. Só aceita lembrete com `status = sent`.

**Fluxo sugerido no n8n:**

1. **Schedule** (ex.: a cada 5 min) → `GET /appointment-reminders/due`
2. Para cada lembrete → enviar WhatsApp ao **cliente** (`customer.whatsapp`)
3. `POST /appointment-reminders/:id/mark-sent`
4. Quando o cliente responder → `GET /appointment-reminders/pending-response?whatsapp=...`
5. Se confirmar → `POST /appointment-reminders/:id/confirm`

---

### 6b. Atualizar status do agendamento

| | |
| --- | --- |
| **Método** | `PUT` |
| **Rota** | `/appointments/:id/status` |
| **Auth** | **Obrigatória** — chave (`appointments:update`) ou sessão do **dono** no painel |
| **Rate limit** | 10 / 15 min por IP (ou por chave) |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer ...` |

Não usa a sessão do cliente do site. Para o cliente cancelar, continue com `DELETE /appointments/:id`.

**Body:**

```json
{ "status": "confirmed" }
```

Valores: `scheduled`, `confirmed`, `cancelled`, `done`.

**Resposta 200:**

```json
{
  "ok": true,
  "appointmentId": "uuid-do-agendamento",
  "status": "confirmed"
}
```

---

### 7. Remarcar agendamento

| | |
| --- | --- |
| **Método** | `PATCH` |
| **Rota** | `/appointments/:id` |
| **Auth** | **Obrigatória** — chave (`appointments:update`), sessão admin, cookie OTP ou Bearer `accessToken` (WhatsApp do body = sessão) |
| **Rate limit** | 10 / 15 min por IP (ou por chave) |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer ...` (n8n) |

**Path:** `id` = UUID do agendamento.

**Body (JSON):**

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `whatsapp` | string | Sim | WhatsApp do dono do agendamento |
| `professionalId` | UUID | Sim | Barbeiro (pode ser o mesmo ou outro) |
| `date` | string | Sim | Nova data `AAAA-MM-DD` |
| `startTime` | string | Sim | Novo horário `HH:MM` |
| `serviceIds` | UUID[] | Sim | Serviços (pode alterar a combinação) |

**Exemplo:**

```json
{
  "whatsapp": "11981008852",
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "date": "2026-06-16",
  "startTime": "10:00",
  "serviceIds": ["3a62b091-6916-4741-a3d4-754a33b2cb31"]
}
```

**Sucesso (200):**

```json
{
  "ok": true,
  "appointmentId": "uuid-do-agendamento"
}
```

Só funciona para agendamentos **futuros**, status ativo, **sem encaixe**. O `whatsapp` deve ser do dono do agendamento.

**Dica:** use `GET /appointments/availability` com `excludeAppointmentId` igual ao `id` do agendamento para listar horários na remarcação.

**Erros comuns:** 401 (sem auth), 403 (scope ou WhatsApp não confere com cookie), 404 (`Agendamento não encontrado ou não pode ser alterado.`), 409 (horário indisponível ou data passada).

---

### 8. Cancelar agendamento

| | |
| --- | --- |
| **Método** | `DELETE` |
| **Rota** | `/appointments/:id` |
| **Auth** | **Obrigatória** — chave (`appointments:cancel`), sessão admin, cookie OTP ou Bearer `accessToken` |
| **Rate limit** | 10 / 15 min por IP (ou por chave) |

**Path:** `id` = UUID do agendamento.

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | WhatsApp do dono do agendamento |

**Exemplo:**

```
DELETE https://agendabarbearia-seven.vercel.app/api/v1/appointments/UUID-DO-AGENDAMENTO?whatsapp=11981008852
Authorization: Bearer dbc_live_SEU_KEYID_SEU_SECRET
```

**Sucesso (200):**

```json
{
  "ok": true,
  "appointmentId": "uuid-do-agendamento"
}
```

Cancela (status `cancelled`); libera o horário na agenda. Não apaga o registro do banco.

**Erros comuns:** 401 (sem auth), 403 (scope ou WhatsApp não confere com cookie), 404 (agendamento não encontrado ou WhatsApp não confere), 409 (`Esse horário já passou e não pode mais ser cancelado.`).

---

## Fluxo de conversa sugerido para o n8n

Estado da conversa deve ser guardado por número de WhatsApp (variáveis do workflow, Redis, Data Store, etc.).

```
1. Cliente manda mensagem
2. Menu principal:
   - 1 Agendar
   - 2 Meus horários
   - 3 Cancelar
   - 4 Falar com atendente (opcional)

FLUXO AGENDAR (com IA):
3. GET /professionals + GET /services → cache no início da conversa
4. Cliente escolhe barbeiro → guardar professionalId
5. Perguntar data (validar não domingo/fechado, não passado)
6. GET /services?date=AAAA-MM-DD&professionalId=... → serviços do barbeiro com priceCentsForDate
7. IA ou menu: cliente escolhe serviço(s) → guardar serviceIds[] (usar id do JSON)
8. GET /appointments/availability → listar slots
9. Cliente escolhe horário → guardar startTime
10. GET /customers?whatsapp= → se found: usar customer.firstName + lastName; senão perguntar firstName + lastName
11. Resumo e confirmação (Sim/Não) — mostrar priceCentsForDate ou faixa em prices
12. POST /appointments
13. Mensagem de sucesso com data, hora, barbeiro, serviço e endereço da loja

FLUXO AGENDAR (menus 1-2-3, sem IA):
3. GET /professionals → listar barbeiros
4. Cliente escolhe número → guardar professionalId
5. GET /services?professionalId=... → listar (após escolher data, use ?date= ou availability para preço certo)
6. Cliente escolhe serviço(s) → guardar serviceIds[]
7. Perguntar data (validar não domingo, não passado)
8. GET /appointments/availability → listar slots
9. Cliente escolhe horário → guardar startTime
10. GET /customers?whatsapp= → se found: usar customer.firstName + lastName; senão perguntar firstName + lastName
11. Resumo e confirmação (Sim/Não)
12. POST /appointments
13. Mensagem de sucesso com data, hora, barbeiro, serviço e endereço da loja

FLUXO MEUS HORÁRIOS:
- GET /appointments?whatsapp=

FLUXO CANCELAR:
- GET /appointments?whatsapp= → cliente escolhe qual
- DELETE /appointments/:id?whatsapp=

FLUXO REMARCAR (opcional):
- GET /appointments?whatsapp= → cliente escolhe qual
- GET /appointments/availability?excludeAppointmentId=... → novos horários
- PATCH /appointments/:id
```

---

## Nós HTTP no n8n (referência)

Todos os nós devem usar a credencial **Header Auth** (`Authorization: Bearer dbc_live_...`).

| Passo | Method | URL | Auth |
| --- | --- | --- | --- |
| Serviços | GET | `{{baseUrl}}/services` (opcional `?date=` / `?professionalId=`) | Pública (envie a chave mesmo assim) |
| Profissionais | GET | `{{baseUrl}}/professionals` (opcional `?serviceId=`) | Pública |
| Horários livres | GET | `{{baseUrl}}/appointments/availability?professionalId=...&date=...&serviceIds=...` | Pública |
| Horários livres (remarcar) | GET | `{{baseUrl}}/appointments/availability?...&excludeAppointmentId=...` | Pública |
| Lookup cliente | GET | `{{baseUrl}}/customers?whatsapp=...` | **Privada** |
| Minha conta (app) | GET / PATCH | `{{baseUrl}}/customers/me` | **Privada** (só OTP) |
| Loja | GET | `{{baseUrl}}/shop` | Pública |
| Listar agendamentos | GET | `{{baseUrl}}/appointments?whatsapp=...` | **Privada** |
| Criar | POST | `{{baseUrl}}/appointments` + JSON body | **Privada** (chave ou OTP) |
| Remarcar | PATCH | `{{baseUrl}}/appointments/{{id}}` + JSON body | **Privada** |
| Cancelar | DELETE | `{{baseUrl}}/appointments/{{id}}?whatsapp=...` | **Privada** |
| Lembretes vencidos | GET | `{{baseUrl}}/appointment-reminders/due` | **Privada** |
| Marcar lembrete enviado | POST | `{{baseUrl}}/appointment-reminders/{{id}}/mark-sent` | **Privada** |
| Lembrete aguardando resposta | GET | `{{baseUrl}}/appointment-reminders/pending-response?whatsapp=...` | **Privada** |
| Confirmar lembrete | POST | `{{baseUrl}}/appointment-reminders/{{id}}/confirm` | **Privada** |

`baseUrl` = `https://agendabarbearia-seven.vercel.app/api/v1`

**Login do cliente (site/app, não n8n):** `POST /api/agenda/otp/send` + `POST /api/agenda/otp/verify` — ver [cliente-otp-whatsapp.md](./cliente-otp-whatsapp.md) e [app-mobile.md](./app-mobile.md).

---

## O que pedir ao ChatGPT

Cole este arquivo inteiro e use um prompt como:

> Sou dono da barbearia Dinho Barber Coffee. Quero montar um workflow no n8n que recebe mensagens do WhatsApp (via [Evolution API / Z-API / informe seu provedor]) e usa a API descrita acima. Me guie passo a passo: gatilho, nós HTTP, como guardar o estado da conversa, menus com números, tratamento de erros 409 e 429, e mensagens em português informal para o cliente. Comece pela versão simples sem IA, só menus 1-2-3.

Substitua `[Evolution API / Z-API / ...]` pelo provedor que você usar.

---

## Checklist Vercel (API no ar)

- [ ] Variáveis no painel Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] **`CLIENT_SESSION_SECRET`** (32+ caracteres) — obrigatório para login OTP do cliente (site e app)
- [ ] **`N8N_CLIENT_OTP_WEBHOOK_URL`** / **`N8N_CLIENT_OTP_WEBHOOK_SECRET`** — envio do código no WhatsApp
- [ ] **`N8N_APPOINTMENT_WEBHOOK_URL`** e **`N8N_APPOINTMENT_WEBHOOK_SECRET`** — opcionais, só para o aviso automático ao barbeiro (ver [seção 6b](#6b-webhook-aviso-automático-ao-barbeiro-appointmentcreated))
- [ ] Rodar as migrations (`npm run db:migrate`) — incluir `0053` (OTP do cliente)
- [ ] Rodar também `0047` (status do atendimento por IA) e `0048` (`booking_source` — ícone de origem na agenda)
- [ ] Redeploy após salvar variáveis
- [ ] `GET /shop` retorna JSON da loja
- [ ] `GET /professionals` retorna JSON com barbeiros e `serviceIds`
- [ ] `GET /services` retorna JSON com serviços e `prices`
- [ ] Profissionais e serviços cadastrados e **ativos** no painel
- [ ] Serviços cadastrados com **preço por dia** em pelo menos um dia aberto (painel > Serviços)
- [ ] `GET /services?date=AAAA-MM-DD` retorna `prices` e `priceCentsForDate` nos serviços
- [ ] Chave de API criada no painel (`Configurações > Integrações > Chaves de API`)

### Testes de segurança (produção)

Rode no terminal (substitua a URL se usar outro ambiente):

```bash
# Rotas privadas bloqueiam sem chave (deve retornar 401)
API_BASE_URL=https://agendabarbearia-seven.vercel.app npm run test:api:protected

# Com sua chave — deve retornar 200
TEST_API_KEY="dbc_live_sua_chave_completa" \
API_BASE_URL=https://agendabarbearia-seven.vercel.app \
npm run test:api:protected
```

| Teste | Como | Esperado |
| --- | --- | --- |
| Loja pública | Abrir `/api/v1/shop` no navegador | **200** |
| Serviços públicos | Abrir `/api/v1/services` no navegador | **200** |
| Profissionais públicos | Abrir `/api/v1/professionals` no navegador | **200** |
| Lookup cliente | `GET /customers?whatsapp=...` sem header | **401** |
| Lookup com chave | `GET /customers?whatsapp=...` + Bearer válido | **200** |
| Minha conta sem token | `GET /customers/me` sem header | **401** |
| Minha conta com OTP | `GET` / `PATCH /customers/me` + Bearer `accessToken` | **200** |
| Criar sem auth | `POST /appointments` sem header | **401** |
| Privada bloqueada | `GET /appointments?whatsapp=...` sem header | **401** |
| Chave errada | Qualquer rota privada com Bearer inválido | **401** |
| Meus horários | `/agenda` → OTP → Horários → F12 → Rede | `otp/verify` **200**, `appointments` **200** |
| Cookie de outro número | `GET /appointments` com sessão e outro `whatsapp` | **403** |

**Última atualização (jul/2026):** `/shop` público; `POST /appointments` privado; OTP devolve `accessToken`; app com `GET`/`PATCH /customers/me` (Minha conta).

---

## Links úteis

- Site cliente: https://agendabarbearia-seven.vercel.app/agenda
- API serviços: https://agendabarbearia-seven.vercel.app/api/v1/services
- API profissionais: https://agendabarbearia-seven.vercel.app/api/v1/professionals
- Arquitetura completa do projeto: [ARQUITETURA.md](./ARQUITETURA.md)
