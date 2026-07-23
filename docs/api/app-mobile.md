# App mobile do cliente — contrato da API

Guia curto para montar o **aplicativo do cliente** (agendar, gerenciar horários e **Minha conta**).
Comandas, caixa e painel do barbeiro **não** entram aqui.

Base URL: `https://seu-dominio/api/v1`  
Auth do cliente (fora do `/v1`): `/api/agenda/...`

---

## Fluxo recomendado

```
1. GET  /api/v1/shop
2. GET  /api/v1/services  (+ opcional ?date=)
3. GET  /api/v1/professionals  (+ opcional ?serviceId=)
4. GET  /api/v1/appointments/availability?...
5. POST /api/agenda/otp/send     { whatsapp }
6. POST /api/agenda/otp/verify  { whatsapp, code }
      → guardar accessToken no aparelho (~14 dias)
7. GET  /api/v1/customers/me     (Bearer — preenche nome se já for cliente)
8. POST /api/v1/appointments    (Bearer accessToken)
9. GET  /api/v1/appointments?whatsapp=…&mode=upcoming
10. PATCH / DELETE quando precisar remarcar / cancelar
11. PATCH /api/v1/customers/me  (Minha conta — editar nome/sobrenome)
```

---

## Login (OTP)

| Etapa | Rota | Resposta importante |
| --- | --- | --- |
| Pedir código | `POST /api/agenda/otp/send` | `{ ok: true }` |
| Validar | `POST /api/agenda/otp/verify` | `accessToken`, `expiresAt`, `whatsapp` |
| Ver sessão | `GET /api/agenda/session` | cookie **ou** `Authorization: Bearer` |
| Sair | apague o token no app (+ `DELETE /api/agenda/session` limpa cookie do site) |

Exemplo de verify:

```json
{
  "ok": true,
  "whatsapp": "5511999999999",
  "accessToken": "eyJ….assinatura",
  "tokenType": "Bearer",
  "expiresAt": 1720000000000
}
```

Nas rotas privadas do `/api/v1`:

```http
Authorization: Bearer <accessToken>
```

O **site** continua usando cookie httpOnly; o **app** usa só o Bearer.
O WhatsApp do body/query (nas rotas de agenda) precisa ser o **mesmo** da sessão.

Detalhes do n8n (envio do código): [cliente-otp-whatsapp.md](./cliente-otp-whatsapp.md).

---

## Minha conta (perfil do cliente)

Só com sessão OTP do **próprio** cliente (Bearer `accessToken`).  
**Não** use chave de API nestas rotas.

| Método | Rota | Scope da sessão | Função |
| --- | --- | --- | --- |
| GET | `/customers/me` | `customers:read` | Ler cadastro (`id`, `firstName`, `lastName`, `whatsapp`) |
| PATCH | `/customers/me` | `customers:update` | Atualizar **nome** e **sobrenome** |

### GET — exemplo

```http
GET /api/v1/customers/me
Authorization: Bearer <accessToken>
```

**Já cadastrado:**

```json
{
  "ok": true,
  "found": true,
  "customer": {
    "id": "22222222-2222-2222-2222-222222222222",
    "firstName": "João",
    "lastName": "Silva",
    "whatsapp": "5511999999999",
    "creditBalanceCents": 5000
  }
}
```

`creditBalanceCents` é o crédito na loja (em centavos). Ex.: `5000` = R$ 50,00.

**Ainda sem cadastro** (nunca agendou / nunca salvou perfil):

```json
{
  "ok": true,
  "found": false,
  "customer": null
}
```

### PATCH — exemplo

```http
PATCH /api/v1/customers/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "firstName": "João",
  "lastName": "Silva"
}
```

```json
{
  "ok": true,
  "customer": {
    "id": "22222222-2222-2222-2222-222222222222",
    "firstName": "João",
    "lastName": "Silva",
    "whatsapp": "5511999999999"
  }
}
```

**Regras**

- WhatsApp **não** muda por aqui (é o da sessão).
- Se ainda não existir cliente, o PATCH **cria** o cadastro com esse WhatsApp.
- Nome/sobrenome são normalizados (primeira letra maiúscula).
- Erros comuns: **401** (sem token / expirado), **403** (não é sessão de cliente), **400** (nome/sobrenome vazios).

Para o n8n buscar **outro** número, continue com `GET /customers?whatsapp=` + chave de API (`customers:read`).

---

## Bootstrap da loja

`GET /api/v1/shop` (público):

- nome, bio, endereço, WhatsApp, Instagram, logo
- `timezone` (`America/Sao_Paulo`)
- `slotStepMinutes`
- `booking.maxDaysAhead` (hoje: 60)
- `businessHours[]` (dia da semana, ativo, abertura/fechamento)

---

## Agendamentos (privado)

| Método | Rota | Scope |
| --- | --- | --- |
| POST | `/appointments` | create |
| GET | `/appointments?whatsapp=&mode=` | read |
| PATCH | `/appointments/:id` | update |
| DELETE | `/appointments/:id?whatsapp=` | cancel |

Catálogo e slots continuam **públicos** (`/services`, `/professionals`, `/appointments/availability`).

OpenAPI completo: [../openapi/v1.yaml](../openapi/v1.yaml).
