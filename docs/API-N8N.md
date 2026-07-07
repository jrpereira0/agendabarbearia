# API Agenda Barbearia — guia para automação (n8n / WhatsApp)

Documento para colar no ChatGPT (ou outra IA) e pedir ajuda para montar workflows no **n8n** integrados ao sistema de agendamento.

---

## Contexto do sistema

- **Produto:** sistema de agendamento para barbearia (Agenda Barbearia).
- **Site do cliente:** `https://agendabarbearia-seven.vercel.app/agenda`
- **Painel admin:** `https://agendabarbearia-seven.vercel.app/` (login do dono/barbeiro).
- **API base (produção):** `https://agendabarbearia-seven.vercel.app/api/v1`
- **Fuso horário:** `America/Sao_Paulo`
- **Autenticação:** rotas públicas continuam acessíveis pelo site sem chave. Para integrações (n8n), use **chave de API** gerada no painel (`Configurações > Integrações > Chaves de API`). Header: `Authorization: Bearer dbc_live_<keyId>_<secret>`.
- **Formato:** JSON em todas as respostas. Erros vêm como `{ "error": "mensagem" }` (ou `{ "ok": false, "error": "..." }` em `/customers/by-whatsapp`).

O bot no WhatsApp (via n8n) deve **chamar essa API** para consultar catálogo, horários livres, buscar cliente, criar/cancelar/remarcar agendamentos — as mesmas regras do site `/agenda`.

---

## Índice de rotas (todas as disponíveis)

| # | Método | Rota | Auth | Função |
| --- | --- | --- | --- | --- |
| 1 | `GET` | `/catalog` | Pública | Catálogo completo ou enxuto (`?date=...&mode=booking`) |
| 2 | `GET` | `/availability` | Pública | Horários livres de um barbeiro num dia |
| 3 | `GET` | `/customers/by-whatsapp` | **Privada** | Buscar cliente pelo WhatsApp (**recomendado para n8n**; retorna `id`) |
| 4 | `GET` | `/customers/lookup` | Pública | Buscar cliente pelo WhatsApp (resposta simples; usado pelo site) |
| 5 | `GET` | `/appointments?whatsapp=` | **Privada** | Listar agendamentos futuros do cliente |
| 5b | `GET` | `/appointments/last-completed?whatsapp=` | **Privada** | Último atendimento concluído do cliente |
| 6 | `POST` | `/appointments` | Pública | Criar agendamento (site e bot sem chave) |
| 7 | `PATCH` | `/appointments/:id` | **Privada** | Remarcar agendamento |
| 8 | `DELETE` | `/appointments/:id?whatsapp=` | **Privada** | Cancelar agendamento |
| 9 | `GET` | `/comandas` | **Privada** | Listar comandas ou abrir por `appointmentId` |
| 10 | `GET/PATCH` | `/comandas/:id` | **Privada** | Ver ou editar itens da comanda |
| 11 | `POST` | `/comandas/:id/close` | **Privada** | Fechar comanda e registrar pagamento |
| 12 | `POST` | `/comandas/:id/reopen` | **Privada** | Reabrir comanda fechada |
| 13 | `GET` | `/finance/cash-register` | **Privada** | Caixa do dia |
| 14 | `GET` | `/finance/commissions` | **Privada** | Comissões por barbeiro no período |

**Resumo:** 4 rotas públicas (1, 2, 4, 6) e 10 privadas de agenda/cliente (3, 5, 7, 8) + **6 rotas financeiras** (9–14, todas privadas). Encaixe, status manual e cadastros continuam só pelo painel — exceto comandas/caixa via API com chave.

**Financeiro:** guia detalhado com exemplos de corpo JSON em [API-FINANCE.md](./API-FINANCE.md).

**Regra do header `Authorization`:** em rotas **públicas**, se você **não** enviar o header, a requisição passa. Se **enviar** `Bearer ...`, a chave será validada — chave inválida retorna **401** (não ignora o header).

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

Use a **mesma credencial** em todos os nós **HTTP Request** e **HTTP Request Tool** — inclusive nos nós de rotas públicas (`/catalog`, `/availability`, `POST /appointments`), para não misturar requisições com e sem header.

### Exemplo (substitua pela chave copiada no painel — nunca commite a chave real)

```
GET https://agendabarbearia-seven.vercel.app/api/v1/catalog
Authorization: Bearer <sua-chave-do-painel>
```

### Permissões (scopes)

| Scope | Rotas |
| --- | --- |
| `catalog:read` | `GET /catalog` |
| `availability:read` | `GET /availability` |
| `customers:read` | `GET /customers/by-whatsapp`, `GET /customers/lookup` |
| `appointments:read` | `GET /appointments`, `GET /appointments/last-completed` |
| `appointments:create` | `POST /appointments` |
| `appointments:update` | `PATCH /appointments/:id` |
| `appointments:cancel` | `DELETE /appointments/:id` |
| `comandas:read` | `GET /comandas`, `GET /comandas/:id` |
| `comandas:write` | `PATCH /comandas/:id`, `POST /comandas/:id/close`, `POST /comandas/:id/reopen` |
| `finance:read` | `GET /finance/cash-register`, `GET /finance/commissions` |

Presets no painel: **Agenda completa** (todos), **Somente leitura**, **Personalizada**.

### Erros de autenticação

| HTTP | Body | Quando |
| --- | --- | --- |
| **401** | `{ "ok": false, "error": "Não autorizado." }` | Chave ausente/inválida/revogada/expirada (mensagem genérica) |
| **403** | `{ "ok": false, "error": "Sem permissão." }` | Chave válida sem o scope da rota |

### Site público vs integração

- O site `/agenda` **não usa** chave de API no navegador
- **Meus horários:** após digitar o WhatsApp, o site chama `POST /api/agenda/session` (cookie httpOnly assinado) e depois as rotas protegidas com `credentials: include`
- **Novo agendamento:** continua em `POST /api/v1/appointments` sem chave (rate limit por IP/WhatsApp)
- **Catálogo e disponibilidade:** continuam públicos (`GET /catalog`, `GET /availability`)
- **Rotas sensíveis** exigem API Key, sessão admin ou cookie de cliente — sem fallback público:

| Rota | Auth obrigatória |
| --- | --- |
| `GET /customers/by-whatsapp` | Sim |
| `GET /appointments` | Sim |
| `PATCH /appointments/:id` | Sim |
| `DELETE /appointments/:id` | Sim |

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
| `GET /catalog`, `GET /availability` | 60 requisições / 15 min por IP (ou por chave de API) |
| `GET /customers/by-whatsapp`, `GET /customers/lookup`, `GET /appointments?whatsapp=` | 10 / 15 min por IP (ou por chave) |
| `POST /appointments` | 5 / hora por IP **e** 3 / hora por WhatsApp (chave: 120/15min por keyId) |
| `PATCH /appointments/:id`, `DELETE /appointments/:id` | 10 / 15 min por IP (ou por chave) |
| Qualquer rota com chave de API | 120 / 15 min por `keyId` |

**Dica para n8n:** chamar `/catalog` no início da conversa ou em cache; não repetir a cada mensagem “oi”.

---

## Dados atuais da barbearia (exemplo real)

Obtenha sempre a versão atual via `GET /catalog`. Referência de junho/2026:

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

Cada profissional tem `serviceIds`: lista de serviços que ele realiza (no catálogo).

### Serviços

Os preços **variam por dia da semana** (cadastrados no painel). No catálogo completo, cada serviço traz `weekdayPrices`; o campo `priceCents` é o **menor** preço da semana (referência). Consulte sempre a API — a tabela abaixo é só referência histórica.

**Como o site `/agenda` mostra isso:**

| Momento do fluxo | O que o cliente vê |
| --- | --- |
| Escolha de serviços (antes da data) | Faixa por serviço, ex.: `Seg–Qua R$ 60,00 · Qui–Sáb R$ 70,00` ou `R$ 60,00 – R$ 70,00`. Total: **“a partir de …”** se houver variação |
| Data/horário e confirmação | Valor **exato** do dia escolhido (mesma regra de `GET /catalog?date=...&mode=booking` e de `POST /appointments`) |
| Meus horários | Total do agendamento pelo preço do **dia do horário** |

O bot pode seguir a mesma lógica: mostrar `prices` agrupados no início e, depois que o cliente escolher a data, usar `priceCents` do catálogo com `date` ou somar os preços do dia antes de confirmar.

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

### 1. Catálogo

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/catalog` |
| **Auth** | Pública (sem header). Opcional: chave com `catalog:read` |
| **Rate limit** | 60 / 15 min por IP |

Retorna loja, profissionais ativos, serviços ativos (com **preço por dia** em `weekdayPrices`) e horários da barbearia. Use este modo para o **site** ou integrações que precisam de fotos, descrição e `businessHours`.

**Para bot com IA**, prefira `?mode=booking` (payload menor e `prices` agrupados — ver seção abaixo).

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/catalog
```

**Resposta 200:**

```json
{
  "timezone": "America/Sao_Paulo",
  "shop": {
    "name": "Dinho Barber Coffee",
    "bio": "",
    "address": "...",
    "whatsapp": "11981008852",
    "instagram": "dinhobarbercoffee",
    "logoUrl": "https://...",
    "slotStepMinutes": 30
  },
  "professionals": [
    {
      "id": "054a545a-75c8-4807-b72d-5c460bb3539f",
      "nickname": "Junior Barber",
      "photoUrl": "https://...",
      "serviceIds": ["0ab080c4-...", "3a62b091-...", "da8126ca-..."]
    }
  ],
  "services": [
    {
      "id": "3a62b091-6916-4741-a3d4-754a33b2cb31",
      "name": "Corte",
      "description": "",
      "photoUrl": "https://...",
      "durationMinutes": 30,
      "priceCents": 6000,
      "weekdayPrices": [
        { "weekday": 1, "priceCents": 6000 },
        { "weekday": 2, "priceCents": 6000 },
        { "weekday": 3, "priceCents": 6000 },
        { "weekday": 4, "priceCents": 6500 },
        { "weekday": 5, "priceCents": 6500 },
        { "weekday": 6, "priceCents": 6500 }
      ]
    }
  ],
  "businessHours": [
    { "weekday": 0, "label": "Domingo", "active": false, "openTime": "09:00", "closeTime": "19:00" }
  ]
}
```

**Uso no bot (menus fixos):** montar menus numerados (1, 2, 3…) com `nickname` e `name`. Guardar os `id` escolhidos no estado da conversa.

**`weekdayPrices`:** `weekday` 0=domingo … 6=sábado; só aparecem dias em que o serviço é oferecido. `priceCents` no catálogo completo é o **menor** preço da semana. **`bookingCount`:** quantas vezes o serviço entrou em agendamentos normais (não cancelados); o site usa isso para ordenar a seção **“Mais agendados”**.

#### Catálogo enxuto (`mode=booking`)

Para o bot de agendamento (n8n + IA), use o modo enxuto. Pode chamar **sem `date`** no início da conversa (cache com todos os `prices`) ou **com `date`** depois que o cliente escolher o dia (filtra serviços e preenche `priceCents`). `professionalId` é opcional.

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `date` | Não | Data do agendamento (`AAAA-MM-DD`). Com data: filtra serviços do dia e preenche `priceCents`. Sem data: lista todos com preços por dia |
| `mode` | Não | `booking` — ativa resposta enxuta para IA |
| `professionalId` | Não | UUID do barbeiro; se informado, filtra serviços que ele faz |

**Validações (400):** `date` inválida, `mode` diferente de `booking`, `professionalId` que não é UUID.

**404:** `professionalId` inexistente ou inativo → `{ "error": "Profissional não encontrado." }`

**Formato compacto de preços (economiza tokens na IA):**

- `dayLabels`: `["Dom","Seg","Ter","Qua","Qui","Sex","Sab"]` — legenda única; o número do dia é o índice (0=domingo … 6=sábado)
- Em cada serviço, `prices`: `[[centavos, [dias]], ...]` — dias com o mesmo preço vêm agrupados
- Com `date`: `priceCents` = preço **na data pedida**; `prices` traz **todos** os dias do serviço (a IA compara outros dias sem nova requisição)

**Exemplo (segunda-feira):**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/catalog?date=2026-07-06&mode=booking
```

**Resposta 200 (exemplo):**

```json
{
  "timezone": "America/Sao_Paulo",
  "dayLabels": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
  "date": "2026-07-06",
  "weekday": 1,
  "priceBand": "seg_qua",
  "shopClosed": false,
  "shop": {
    "name": "Dinho Barber Coffee",
    "address": "...",
    "whatsapp": "11981008852"
  },
  "professionals": [
    { "id": "054a545a-75c8-4807-b72d-5c460bb3539f", "nickname": "Junior Barber" }
  ],
  "services": [
    {
      "id": "3a62b091-6916-4741-a3d4-754a33b2cb31",
      "name": "Corte",
      "displayName": "Corte",
      "durationMinutes": 30,
      "priceCents": 6000,
      "prices": [[6000, [1, 2, 3]], [6500, [4, 5, 6]]]
    }
  ]
}
```

Leitura do exemplo: Corte custa **R$ 60,00** (`6000` centavos) seg–qua (índices 1–3) e **R$ 65,00** qui–sáb (4–6). Na data `2026-07-06` (segunda), `priceCents` já vem **6000**.

**Regras de filtro por data:**

- Cada serviço tem preços por dia em `prices` (cadastrados no painel)
- Com `date`: só entram serviços oferecidos naquele dia; `priceCents` = preço da data
- Sem `date`: todos os serviços ativos com `prices` (útil antes do cliente escolher o dia)
- `priceCents` na resposta com data é o preço **daquele dia**; use `prices` + `dayLabels` para explicar outros dias
- **Domingo:** se a loja estiver fechada (`businessHours[0].active = false`), retorna `shopClosed: true`, `professionals: []`, `services: []`, `priceBand: "sunday"`
- **Feriados:** não tratados nesta versão — use exceções de agenda no painel se precisar fechar um dia específico
- `GET /availability` e `POST /appointments` também validam se o serviço está disponível no dia escolhido

**Campo `displayName`:** igual ao `name` (nome limpo no cadastro). Mantido para o bot/IA.

**Uso no n8n (subworkflow `resolver_servico`):** troque a URL do nó HTTP de catálogo para:

```
GET {{baseUrl}}/catalog?date={{data_escolhida}}&mode=booking&professionalId={{professionalId}}
```

`professionalId` é opcional — omita se o cliente ainda não escolheu barbeiro.

`mode=booking` **não** resolve linguagem natural (“quero um corte”); só reduz o catálogo para o Code node do `resolver_servico` cruzar com a intenção da IA. A lógica de NLP continua no n8n.

`GET /catalog` **sem parâmetros** permanece igual (catálogo completo para o site).

#### Instrução para a IA (ler preços no `mode=booking`)

Cole no system prompt do agente ou no nó Code:

```
dayLabels: índice do dia (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab).
Cada serviço tem prices: [[centavos, [dias]], ...]. Ex.: [[6000,[1,2,3]],[6500,[4,5,6]]] = R$ 60 seg–qua, R$ 65 qui–sáb.
Com date na URL, priceCents já é o preço da data pedida; use prices para explicar outros dias.
Valores em centavos (6000 = R$ 60,00).
```

**Exemplo sem `date`** (cliente ainda não escolheu o dia — menos campos na resposta):

```
GET https://agendabarbearia-seven.vercel.app/api/v1/catalog?mode=booking
```

Retorna todos os serviços com `prices` (sem `priceCents` nem filtro por dia).

---

### 2. Horários livres

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/availability` |
| **Auth** | Pública (sem header). Opcional: chave com `availability:read` |
| **Rate limit** | 60 / 15 min por IP |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `professionalId` | Sim | UUID do barbeiro |
| `date` | Sim | `AAAA-MM-DD` |
| `serviceIds` | Sim | Um ou mais UUIDs separados por **vírgula** (sem espaço) |
| `excludeAppointmentId` | Não | UUID ao remarcar (ignora o próprio agendamento no cálculo) |

**Exemplo — Junior + Corte e Barba em 15/06/2026:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/availability?professionalId=054a545a-75c8-4807-b72d-5c460bb3539f&date=2026-06-15&serviceIds=da8126ca-730d-49e9-a429-2dd0d6965409
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

### 3. Buscar cliente pelo WhatsApp (recomendado para n8n)

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/customers/by-whatsapp` |
| **Auth** | **Obrigatória** — chave de API (`customers:read`), sessão admin ou cookie de cliente |
| **Rate limit** | 10 / 15 min por IP (ou por chave) |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | Número do cliente (aceita máscara, `+55`, com ou sem `55`) |

Normaliza o número e retorna o cadastro com `id`.

**Exemplos válidos:**

```
GET .../customers/by-whatsapp?whatsapp=11981008852
GET .../customers/by-whatsapp?whatsapp=5511981008852
GET .../customers/by-whatsapp?whatsapp=%2B55%20(11)%2098100-8852
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

**Sem autenticação (401):**

```json
{
  "ok": false,
  "error": "Não autorizado."
}
```

**Uso no bot:** se `found: true`, usar `customer.firstName`, `customer.lastName` e `customer.whatsapp` no `POST /appointments`. Se `found: false`, perguntar nome e sobrenome. No n8n, sempre envie `Authorization: Bearer dbc_live_...`.

**Teste (terminal):**

```bash
curl -s "https://agendabarbearia-seven.vercel.app/api/v1/customers/by-whatsapp?whatsapp=13981008852" \
  -H "Authorization: Bearer SUA_CHAVE_AQUI"
```

---

### 4. Buscar cliente (lookup — site `/agenda`)

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/customers/lookup` |
| **Auth** | Pública (sem header). Opcional: chave com `customers:read` |
| **Rate limit** | 10 / 15 min por IP |

Busca parecida com `/by-whatsapp`, mas resposta mais simples (sem `id`, sem campo `ok`). Usado pelo site público e pelo painel admin ao digitar WhatsApp. **Não use no n8n** — prefira o endpoint 3, que é privado e retorna o `id`.

**Query params:** `whatsapp` (obrigatório; mesma normalização do item 3).

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/customers/lookup?whatsapp=11981008852
```

**Encontrou (200):**

```json
{
  "found": true,
  "firstName": "João",
  "lastName": "Silva"
}
```

**Não encontrou (200):**

```json
{
  "found": false
}
```

**WhatsApp inválido (400):**

```json
{
  "error": "WhatsApp deve ter DDD + número (10 ou 11 dígitos)."
}
```

**Para n8n:** prefira o endpoint **3** (`/by-whatsapp`), que retorna o `id` do cliente.

---

### 5. Listar agendamentos futuros do cliente

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/appointments` |
| **Auth** | **Obrigatória** — chave de API (`appointments:read`), sessão admin ou cookie de cliente |
| **Rate limit** | 10 / 15 min por IP (ou por chave / WhatsApp da sessão) |

**Quem autentica como:**

| Origem | Como |
| --- | --- |
| **n8n** | `Authorization: Bearer dbc_live_...` |
| **Site — Meus horários** | `POST /api/agenda/session` com WhatsApp → cookie `agenda_client_session` → `GET /appointments` com `credentials: include` |
| **Painel admin** | Sessão Supabase (login do dono/barbeiro) |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | WhatsApp do cliente (normalizado automaticamente) |

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/appointments?whatsapp=11981008852
Authorization: Bearer dbc_live_SEU_KEYID_SEU_SECRET
```

**Sem autenticação (401):**

```json
{
  "ok": false,
  "error": "Não autorizado."
}
```

**Cookie de outro WhatsApp (403):**

```json
{
  "ok": false,
  "error": "Sem permissão."
}
```

**Resposta 200:**

```json
{
  "appointments": [
    {
      "id": "uuid-do-agendamento",
      "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
      "professionalName": "Junior Barber",
      "professionalPhotoUrl": "https://...",
      "date": "2026-06-15",
      "startTime": "14:30",
      "serviceIds": ["da8126ca-730d-49e9-a429-2dd0d6965409"],
      "serviceNames": ["Corte e Barba"],
      "totalMinutes": 60,
      "totalPriceCents": 12000
    }
  ]
}
```

Lista só agendamentos **futuros**, status ativo (`scheduled`, `confirmed`, `on_site`), **sem encaixe**. Array vazio se não houver nenhum.

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
| **Auth** | Pública — site e bot **não precisam** de chave. Opcional no n8n: chave com `appointments:create` |
| **Rate limit** | 5 / hora por IP e 3 / hora por WhatsApp |
| **Headers** | `Content-Type: application/json` |

**Body (JSON):**

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `professionalId` | UUID | Sim | Barbeiro |
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
  "appointmentId": "uuid-gerado"
}
```

**Erros comuns:**

| HTTP | Mensagem típica |
| --- | --- |
| 409 | `Esse horário não está mais disponível. Escolha outro.` |
| 409 | `Esse horário acabou de ser ocupado. Escolha outro.` |
| 400 | Validação (nome vazio, WhatsApp inválido, UUID inválido…) |
| 429 | Muitas tentativas |
| 500 | `Este WhatsApp já pertence a [nome]. Verifique o número…` (nome diferente do cadastro) |

O servidor **valida de novo** se o horário está livre antes de gravar. Status inicial: `scheduled`. Se o cliente já existir com o mesmo nome, reutiliza o cadastro; se existir com outro nome, recusa.

---

### 7. Remarcar agendamento

| | |
| --- | --- |
| **Método** | `PATCH` |
| **Rota** | `/appointments/:id` |
| **Auth** | **Obrigatória** — chave (`appointments:update`), sessão admin ou cookie de cliente (WhatsApp no body deve ser o mesmo da sessão) |
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

**Dica:** use `GET /availability` com `excludeAppointmentId` igual ao `id` do agendamento para listar horários na remarcação.

**Erros comuns:** 401 (sem auth), 403 (scope ou WhatsApp não confere com cookie), 404 (`Agendamento não encontrado ou não pode ser alterado.`), 409 (horário indisponível ou data passada).

---

### 8. Cancelar agendamento

| | |
| --- | --- |
| **Método** | `DELETE` |
| **Rota** | `/appointments/:id` |
| **Auth** | **Obrigatória** — chave (`appointments:cancel`), sessão admin ou cookie de cliente |
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
3. GET /catalog?mode=booking → profissionais + serviços com prices (cache no início da conversa)
4. Cliente escolhe barbeiro → guardar professionalId
5. Perguntar data (validar não domingo/fechado, não passado)
6. GET /catalog?date=AAAA-MM-DD&mode=booking&professionalId=... → serviços do dia + priceCents + prices completos
7. IA ou menu: cliente escolhe serviço(s) → guardar serviceIds[] (usar id do JSON)
8. GET /availability → listar slots
9. Cliente escolhe horário → guardar startTime
10. GET /customers/by-whatsapp?whatsapp= → se found: usar customer.firstName + lastName; senão perguntar firstName + lastName
11. Resumo e confirmação (Sim/Não) — mostrar preço de priceCents ou da faixa em prices
12. POST /appointments
13. Mensagem de sucesso com data, hora, barbeiro, serviço e endereço da loja

FLUXO AGENDAR (menus 1-2-3, sem IA):
3. GET /catalog → listar profissionais
4. Cliente escolhe número → guardar professionalId
5. Filtrar services onde id está em professional.serviceIds → listar (priceCents = menor da semana; após escolher data, chame availability para preço certo)
6. Cliente escolhe serviço(s) → guardar serviceIds[]
7. Perguntar data (validar não domingo, não passado)
8. GET /availability → listar slots
9. Cliente escolhe horário → guardar startTime
10. GET /customers/by-whatsapp?whatsapp= → se found: usar customer.firstName + lastName; senão perguntar firstName + lastName
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
- GET /availability?excludeAppointmentId=... → novos horários
- PATCH /appointments/:id
```

---

## Nós HTTP no n8n (referência)

Todos os nós devem usar a credencial **Header Auth** (`Authorization: Bearer dbc_live_...`).

| Passo | Method | URL | Auth |
| --- | --- | --- | --- |
| Catálogo (site) | GET | `{{baseUrl}}/catalog` | Pública (envie a chave mesmo assim) |
| Catálogo (bot, com data) | GET | `{{baseUrl}}/catalog?date={{data}}&mode=booking&professionalId={{id}}` | Pública |
| Catálogo (bot, sem data) | GET | `{{baseUrl}}/catalog?mode=booking` | Pública |
| Disponibilidade | GET | `{{baseUrl}}/availability?professionalId=...&date=...&serviceIds=...` | Pública |
| Disponibilidade (remarcar) | GET | `{{baseUrl}}/availability?...&excludeAppointmentId=...` | Pública |
| Lookup cliente | GET | `{{baseUrl}}/customers/by-whatsapp?whatsapp=...` | **Privada** |
| Listar agendamentos | GET | `{{baseUrl}}/appointments?whatsapp=...` | **Privada** |
| Criar | POST | `{{baseUrl}}/appointments` + JSON body | Pública (chave opcional) |
| Remarcar | PATCH | `{{baseUrl}}/appointments/{{id}}` + JSON body | **Privada** |
| Cancelar | DELETE | `{{baseUrl}}/appointments/{{id}}?whatsapp=...` | **Privada** |

`baseUrl` = `https://agendabarbearia-seven.vercel.app/api/v1`

**Rota auxiliar (só site, não n8n):** `POST /api/agenda/session` com body `{ "whatsapp": "..." }` — emite cookie para **Meus horários** no navegador.

---

## O que pedir ao ChatGPT

Cole este arquivo inteiro e use um prompt como:

> Sou dono da barbearia Dinho Barber Coffee. Quero montar um workflow no n8n que recebe mensagens do WhatsApp (via [Evolution API / Z-API / informe seu provedor]) e usa a API descrita acima. Me guie passo a passo: gatilho, nós HTTP, como guardar o estado da conversa, menus com números, tratamento de erros 409 e 429, e mensagens em português informal para o cliente. Comece pela versão simples sem IA, só menus 1-2-3.

Substitua `[Evolution API / Z-API / ...]` pelo provedor que você usar.

---

## Checklist Vercel (API no ar)

- [ ] Variáveis no painel Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] **`CLIENT_SESSION_SECRET`** (32+ caracteres) — obrigatório para **Meus horários** no site (`POST /api/agenda/session`)
- [ ] Redeploy após salvar variáveis
- [ ] `GET /catalog` retorna JSON com profissionais e serviços
- [ ] Profissionais e serviços cadastrados e **ativos** no painel
- [ ] Serviços cadastrados com **preço por dia** em pelo menos um dia aberto (painel > Serviços)
- [ ] `GET /catalog?mode=booking&date=AAAA-MM-DD` retorna `dayLabels`, `prices` e `priceCents` nos serviços
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
| Catálogo público | Abrir `/api/v1/catalog` no navegador | **200** |
| Lookup público | `GET /customers/lookup?whatsapp=...` sem header | **200** |
| Privada bloqueada | `GET /appointments?whatsapp=...` sem header | **401** |
| by-whatsapp bloqueada | `GET /customers/by-whatsapp?whatsapp=...` sem header | **401** |
| Chave errada | Qualquer rota privada com Bearer inválido | **401** |
| Meus horários | `/agenda` → aba Meus horários → F12 → Rede | `session` **200**, `appointments` **200** |
| Cookie de outro número | `GET /appointments` com cookie de sessão e outro `whatsapp` | **403** |

**Última verificação automática (jun/2026):** todas as rotas privadas retornaram **401** sem auth; públicas **200**; sessão por cookie funcionando em produção.

---

## Links úteis

- Site cliente: https://agendabarbearia-seven.vercel.app/agenda
- API catálogo: https://agendabarbearia-seven.vercel.app/api/v1/catalog
- Arquitetura completa do projeto: [ARQUITETURA.md](./ARQUITETURA.md)
