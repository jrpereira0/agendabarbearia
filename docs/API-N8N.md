# API Agenda Barbearia — guia para automação (n8n / WhatsApp)

Documento para colar no ChatGPT (ou outra IA) e pedir ajuda para montar workflows no **n8n** integrados ao sistema de agendamento.

---

## Contexto do sistema

- **Produto:** sistema de agendamento para barbearia (Agenda Barbearia).
- **Site do cliente:** `https://agendabarbearia-seven.vercel.app/agenda`
- **Painel admin:** `https://agendabarbearia-seven.vercel.app/` (login do dono/barbeiro).
- **API base (produção):** `https://agendabarbearia-seven.vercel.app/api/v1`
- **Fuso horário:** `America/Sao_Paulo`
- **Autenticação:** nenhuma chave obrigatória hoje. A API é pública com limite de requisições por IP.
- **Formato:** JSON em todas as respostas. Erros vêm como `{ "error": "mensagem" }` com HTTP 400, 409, 429, 503 etc.

O bot no WhatsApp (via n8n) deve **chamar essa API** para consultar catálogo, horários livres, criar/cancelar/remarcar agendamentos — as mesmas regras do site `/agenda`.

---

## Regras de negócio importantes

1. **WhatsApp** nos requests: apenas dígitos, **10 a 13 caracteres** (DDD + número). Exemplos válidos: `11981008852`, `5511981008852`. Sem `+`, espaços ou parênteses.
2. **Datas:** formato `AAAA-MM-DD` (ex.: `2026-06-15`). Não aceita datas no passado para agendar.
3. **Horários:** formato `HH:MM` em 24h (ex.: `14:30`).
4. **IDs:** barbeiros e serviços usam **UUID** (código longo). Nunca usar texto placeholder como `ID_DO_JUNIOR`.
5. **Agenda aberta:** até **60 dias** à frente.
6. **Hoje:** só horários com pelo menos **10 minutos** de antecedência.
7. **Intervalo dos slots:** configurável na barbearia (`slotStepMinutes` no catálogo; atualmente **30 min**).
8. **Domingo:** barbearia **fechada** (`businessHours` com `active: false`).
9. **Encaixe manual** e alteração de status pelo painel **não existem na API** — só agendamento normal de cliente.
10. **Cancelar pela API** marca status `cancelled` (não apaga o registro). Exclusão definitiva é só no painel admin.

---

## Limites de uso (rate limit)

Se exceder, a API responde **429** com mensagem de “muitas tentativas”.

| Rotas | Limite |
| --- | --- |
| `GET /catalog`, `GET /availability` | 60 requisições / 15 min por IP |
| `GET /customers/lookup`, `GET /appointments?whatsapp=` | 10 / 15 min por IP |
| `POST /appointments` | 5 / hora por IP **e** 3 / hora por WhatsApp |
| `PATCH` e `DELETE /appointments/:id` | 10 / 15 min por IP |

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

## Endpoints

### 1. Catálogo

**`GET /catalog`**

Retorna loja, profissionais ativos, serviços ativos e horários da barbearia.

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/catalog
```

**Resposta (estrutura):**

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

**`GET /availability`**

**Query params:**

| Parâmetro | Obrigatório | Descrição |
| --- | --- | --- |
| `professionalId` | Sim | UUID do barbeiro |
| `date` | Sim | `AAAA-MM-DD` |
| `serviceIds` | Sim | Um ou mais UUIDs separados por **vírgula** (sem espaço) |
| `excludeAppointmentId` | Não | UUID ao remarcar (ignora o próprio agendamento) |

**Exemplo — Junior + Corte e Barba em 15/06/2026:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/availability?professionalId=054a545a-75c8-4807-b72d-5c460bb3539f&date=2026-06-15&serviceIds=da8126ca-730d-49e9-a429-2dd0d6965409
```

**Resposta de sucesso:**

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

**Erros comuns:**

| Mensagem | Causa |
| --- | --- |
| `professionalId inválido.` | UUID errado ou placeholder |
| `Essa data já passou.` | Data no passado |
| `Escolha pelo menos um serviço.` | `serviceIds` vazio |

**Uso no bot:** mostrar `slots` numerados; `totalPriceCents / 100` = valor em reais.

---

### 3. Buscar cliente pelo WhatsApp (recomendado para n8n)

**`GET /customers/by-whatsapp?whatsapp=`**

Normaliza o número (remove máscara, aceita `+55`, padroniza com código do Brasil) e retorna o cadastro com `id`.

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/customers/by-whatsapp?whatsapp=5511981008852
```

Também aceita máscara: `?whatsapp=%2B55%20(11)%2098100-8852`

**Cliente encontrado:**

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

**Cliente não encontrado:**

```json
{
  "ok": true,
  "found": false,
  "customer": null
}
```

**WhatsApp inválido (HTTP 400):**

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

### 3b. Buscar cliente (legado — site `/agenda`)

**`GET /customers/lookup?whatsapp=`**

Mesma busca, resposta mais simples (sem `id`, sem `ok`). Mantido para o site público.

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/customers/lookup?whatsapp=5511981008852
```

**Resposta se encontrou:**

```json
{
  "found": true,
  "firstName": "João",
  "lastName": "Silva"
}
```

**Resposta se não encontrou:**

```json
{
  "found": false
}
```

---

### 4. Listar agendamentos futuros do cliente

**`GET /appointments?whatsapp=`**

**Exemplo:**

```
GET https://agendabarbearia-seven.vercel.app/api/v1/appointments?whatsapp=5511981008852
```

**Resposta:**

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

Lista só agendamentos **futuros**, status ativo, **sem encaixe**.

---

### 5. Criar agendamento

**`POST /appointments`**

**Headers:** `Content-Type: application/json`

**Body:**

```json
{
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "date": "2026-06-15",
  "startTime": "14:30",
  "serviceIds": ["da8126ca-730d-49e9-a429-2dd0d6965409"],
  "firstName": "Maria",
  "lastName": "Santos",
  "whatsapp": "5511981008852"
}
```

**Resposta de sucesso:**

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
| 400 | Validação (nome vazio, WhatsApp inválido, etc.) |
| 429 | Muitas tentativas |

O servidor **valida de novo** se o horário está livre antes de gravar. Status inicial: `scheduled`.

---

### 6. Remarcar agendamento

**`PATCH /appointments/:id`**

**Body:**

```json
{
  "whatsapp": "5511981008852",
  "professionalId": "054a545a-75c8-4807-b72d-5c460bb3539f",
  "date": "2026-06-16",
  "startTime": "10:00",
  "serviceIds": ["3a62b091-6916-4741-a3d4-754a33b2cb31"]
}
```

O `whatsapp` deve ser **do dono** do agendamento. Só funciona para agendamentos futuros ativos (não encaixe).

**Resposta:**

```json
{
  "ok": true,
  "appointmentId": "uuid-do-agendamento"
}
```

Para remarcar, pode usar `GET /availability` com `excludeAppointmentId` igual ao `id` do agendamento.

---

### 7. Cancelar agendamento

**`DELETE /appointments/:id?whatsapp=`**

**Exemplo:**

```
DELETE https://agendabarbearia-seven.vercel.app/api/v1/appointments/UUID-DO-AGENDAMENTO?whatsapp=5511981008852
```

**Resposta:**

```json
{
  "ok": true,
  "appointmentId": "uuid-do-agendamento"
}
```

Cancela (status `cancelled`); libera o horário na agenda.

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
```

---

## Nós HTTP no n8n (referência)

| Passo | Method | URL |
| --- | --- | --- |
| Catálogo | GET | `{{baseUrl}}/catalog` |
| Disponibilidade | GET | `{{baseUrl}}/availability?professionalId=...&date=...&serviceIds=...` |
| Lookup cliente | GET | `{{baseUrl}}/customers/by-whatsapp?whatsapp=...` |
| Listar | GET | `{{baseUrl}}/appointments?whatsapp=...` |
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
