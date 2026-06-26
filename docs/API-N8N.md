# API Agenda Barbearia — guia para automação (n8n / WhatsApp)

Documento para colar no ChatGPT (ou outra IA) e pedir ajuda para montar workflows no **n8n** integrados ao sistema de agendamento.

---

## Contexto do sistema

- **Produto:** sistema de agendamento para barbearia (Agenda Barbearia).
- **Site do cliente:** `https://agendabarbearia-seven.vercel.app/agenda`
- **Painel admin:** `https://agendabarbearia-seven.vercel.app/` (login do dono/barbeiro).
- **API base (produção):** `https://agendabarbearia-seven.vercel.app/api/v1`
- **Fuso horário:** `America/Sao_Paulo`
- **Autenticação:** nenhuma chave obrigatória hoje. A API é pública com limite de requisições por IP (e por WhatsApp em algumas rotas).
- **Formato:** JSON em todas as respostas. Erros vêm como `{ "error": "mensagem" }` (ou `{ "ok": false, "error": "..." }` em `/customers/by-whatsapp`).

O bot no WhatsApp (via n8n) deve **chamar essa API** para consultar catálogo, horários livres, buscar cliente, criar/cancelar/remarcar agendamentos — as mesmas regras do site `/agenda`.

---

## Índice de rotas (todas as disponíveis)

| # | Método | Rota | Função |
| --- | --- | --- | --- |
| 1 | `GET` | `/catalog` | Catálogo da barbearia (loja, barbeiros, serviços, horários) |
| 2 | `GET` | `/availability` | Horários livres de um barbeiro num dia |
| 3 | `GET` | `/customers/by-whatsapp` | Buscar cliente pelo WhatsApp (**recomendado para n8n**; retorna `id`) |
| 4 | `GET` | `/customers/lookup` | Buscar cliente pelo WhatsApp (resposta simples; usado pelo site) |
| 5 | `GET` | `/appointments?whatsapp=` | Listar agendamentos futuros do cliente |
| 6 | `POST` | `/appointments` | Criar agendamento |
| 7 | `PATCH` | `/appointments/:id` | Remarcar agendamento |
| 8 | `DELETE` | `/appointments/:id?whatsapp=` | Cancelar agendamento |

**Não existem outras rotas públicas em `/api/v1`.** Tudo que o painel admin faz (encaixe, status, exclusão definitiva, cadastro de profissionais etc.) é só pelo painel — não pela API.

---

## Regras de negócio importantes

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
| **400** | Parâmetro ou body inválido (data, UUID, WhatsApp, nome vazio…) |
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
| `GET /catalog`, `GET /availability` | 60 requisições / 15 min por IP |
| `GET /customers/by-whatsapp`, `GET /customers/lookup`, `GET /appointments?whatsapp=` | 10 / 15 min por IP |
| `POST /appointments` | 5 / hora por IP **e** 3 / hora por WhatsApp |
| `PATCH /appointments/:id`, `DELETE /appointments/:id` | 10 / 15 min por IP |

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

| Nome | serviceId | Duração | Preço |
| --- | --- | --- | --- |
| Barba | `0ab080c4-514c-41ef-9ad3-07b66141d0c1` | 30 min | R$ 65,00 |
| Corte | `3a62b091-6916-4741-a3d4-754a33b2cb31` | 30 min | R$ 65,00 |
| Corte e Barba | `da8126ca-730d-49e9-a429-2dd0d6965409` | 60 min | R$ 120,00 |

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
| **Auth** | Nenhuma |
| **Rate limit** | 60 / 15 min por IP |

Retorna loja, profissionais ativos, serviços ativos e horários da barbearia.

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
      "priceCents": 6500
    }
  ],
  "businessHours": [
    { "weekday": 0, "label": "Domingo", "active": false, "openTime": "09:00", "closeTime": "19:00" }
  ]
}
```

**Uso no bot:** montar menus numerados (1, 2, 3…) com `nickname` e `name`. Guardar os `id` escolhidos no estado da conversa.

---

### 2. Horários livres

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/availability` |
| **Auth** | Nenhuma |
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

**Resposta 200:**

```json
{
  "ok": true,
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "date": "2026-06-15",
  "durationMinutes": 60,
  "totalPriceCents": 12000,
  "slots": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"]
}
```

**Erros comuns (400/404):**

| Mensagem | Causa |
| --- | --- |
| `professionalId inválido.` | UUID errado ou placeholder |
| `Essa data já passou.` | Data no passado |
| `Escolha pelo menos um serviço.` | `serviceIds` vazio |
| `Profissional não encontrado.` | UUID inexistente ou inativo |
| `Serviço não encontrado.` | UUID de serviço inválido |

**Uso no bot:** mostrar `slots` numerados; `totalPriceCents / 100` = valor em reais.

---

### 3. Buscar cliente pelo WhatsApp (recomendado para n8n)

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/customers/by-whatsapp` |
| **Auth** | Nenhuma |
| **Rate limit** | 10 / 15 min por IP |

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

**Uso no bot:** se `found: true`, usar `customer.firstName`, `customer.lastName` e `customer.whatsapp` no `POST /appointments`. Se `found: false`, perguntar nome e sobrenome.

**Teste local:**

```bash
npm run test:api:customer-by-whatsapp -- "(11) 98100-8852"
API_BASE_URL=https://agendabarbearia-seven.vercel.app npm run test:api:customer-by-whatsapp
```

---

### 4. Buscar cliente (lookup — site `/agenda`)

| | |
| --- | --- |
| **Método** | `GET` |
| **Rota** | `/customers/lookup` |
| **Auth** | Nenhuma |
| **Rate limit** | 10 / 15 min por IP |

Mesma busca do endpoint anterior, mas resposta mais simples (sem `id`, sem campo `ok`). Usado pelo site público e pelo painel admin ao digitar WhatsApp.

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
| **Auth** | Nenhuma |
| **Rate limit** | 10 / 15 min por IP |

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | WhatsApp do cliente (normalizado automaticamente) |

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/appointments?whatsapp=11981008852
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

### 6. Criar agendamento

| | |
| --- | --- |
| **Método** | `POST` |
| **Rota** | `/appointments` |
| **Auth** | Nenhuma |
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
| **Auth** | Nenhuma (validação pelo WhatsApp no body) |
| **Rate limit** | 10 / 15 min por IP |
| **Headers** | `Content-Type: application/json` |

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

**Erros comuns:** 404 (`Agendamento não encontrado ou não pode ser alterado.`), 409 (horário indisponível ou data passada).

---

### 8. Cancelar agendamento

| | |
| --- | --- |
| **Método** | `DELETE` |
| **Rota** | `/appointments/:id` |
| **Auth** | Nenhuma (validação pelo WhatsApp na query) |
| **Rate limit** | 10 / 15 min por IP |

**Path:** `id` = UUID do agendamento.

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `whatsapp` | Sim | WhatsApp do dono do agendamento |

**Exemplo:**

```
DELETE https://agendabarbearia-seven.vercel.app/api/v1/appointments/UUID-DO-AGENDAMENTO?whatsapp=11981008852
```

**Sucesso (200):**

```json
{
  "ok": true,
  "appointmentId": "uuid-do-agendamento"
}
```

Cancela (status `cancelled`); libera o horário na agenda. Não apaga o registro do banco.

**Erros comuns:** 404 (agendamento não encontrado ou WhatsApp não confere), 409 (`Esse horário já passou e não pode mais ser cancelado.`).

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

FLUXO AGENDAR:
3. GET /catalog → listar profissionais
4. Cliente escolhe número → guardar professionalId
5. Filtrar services onde id está em professional.serviceIds → listar
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

| Passo | Method | URL |
| --- | --- | --- |
| Catálogo | GET | `{{baseUrl}}/catalog` |
| Disponibilidade | GET | `{{baseUrl}}/availability?professionalId=...&date=...&serviceIds=...` |
| Disponibilidade (remarcar) | GET | `{{baseUrl}}/availability?...&excludeAppointmentId=...` |
| Lookup cliente | GET | `{{baseUrl}}/customers/by-whatsapp?whatsapp=...` |
| Listar agendamentos | GET | `{{baseUrl}}/appointments?whatsapp=...` |
| Criar | POST | `{{baseUrl}}/appointments` + JSON body |
| Remarcar | PATCH | `{{baseUrl}}/appointments/{{id}}` + JSON body |
| Cancelar | DELETE | `{{baseUrl}}/appointments/{{id}}?whatsapp=...` |

`baseUrl` = `https://agendabarbearia-seven.vercel.app/api/v1`

---

## O que pedir ao ChatGPT

Cole este arquivo inteiro e use um prompt como:

> Sou dono da barbearia Dinho Barber Coffee. Quero montar um workflow no n8n que recebe mensagens do WhatsApp (via [Evolution API / Z-API / informe seu provedor]) e usa a API descrita acima. Me guie passo a passo: gatilho, nós HTTP, como guardar o estado da conversa, menus com números, tratamento de erros 409 e 429, e mensagens em português informal para o cliente. Comece pela versão simples sem IA, só menus 1-2-3.

Substitua `[Evolution API / Z-API / ...]` pelo provedor que você usar.

---

## Checklist Vercel (API no ar)

- [ ] Variáveis no painel Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Redeploy após salvar variáveis
- [ ] `GET /catalog` retorna JSON com profissionais e serviços
- [ ] Profissionais e serviços cadastrados e **ativos** no painel

---

## Links úteis

- Site cliente: https://agendabarbearia-seven.vercel.app/agenda
- API catálogo: https://agendabarbearia-seven.vercel.app/api/v1/catalog
- Arquitetura completa do projeto: [ARQUITETURA.md](./ARQUITETURA.md)
