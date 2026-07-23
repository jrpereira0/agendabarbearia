# App mobile do cliente — contrato da API

Guia curto para montar o **aplicativo do cliente** (agendar e gerenciar horários).
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
7. POST /api/v1/appointments    (Bearer accessToken)
8. GET  /api/v1/appointments?whatsapp=…&mode=upcoming
9. PATCH / DELETE quando precisar remarcar / cancelar
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
O WhatsApp do body/query precisa ser o **mesmo** da sessão.

Detalhes do n8n (envio do código): [cliente-otp-whatsapp.md](./cliente-otp-whatsapp.md).

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
