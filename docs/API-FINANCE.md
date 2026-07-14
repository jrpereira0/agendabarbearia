# API Financeiro — comandas, caixa e comissões

Documentação das rotas de **comandas** e **relatórios financeiros** em `/api/v1`. Use com chave de API (n8n) ou sessão do dono no painel.

Guia geral de autenticação e chaves: [API-N8N.md](./API-N8N.md).

---

## Regras de negócio

| Regra | Detalhe |
| --- | --- |
| Comanda por cliente/dia | Uma comanda **aberta** por WhatsApp + data; agrupa todos os agendamentos **ativos** do mesmo cliente naquele dia (ex.: 12h com um barbeiro e 15h com outro) |
| Nova comanda no mesmo dia | Depois de **fechar** a comanda, um novo agendamento do cliente naquele dia abre **outra** comanda — não mistura com a já finalizada |
| Encaixes na comanda | Encaixes manuais do mesmo cliente no dia entram na comanda automaticamente (serviços + lista de atendimentos) |
| Extras na comanda | Serviço adicionado na comanda além dos do agendamento vira **encaixe** na agenda |
| Comissão | % sobre o valor **cobrado** de cada serviço na comanda (configurável por barbeiro) |
| Gorjeta | Opcional ao fechar; linha `is_tip` na comanda — o barbeiro escolhido recebe **100%** (entra no total e no caixa) |
| Crédito do cliente | Saldo por cliente; pode pagar comanda com `store_credit`; troco ou depósito vira crédito e **entra no caixa** pelo método de origem (Pix, dinheiro etc.) |
| Uso de crédito | Pagamento `store_credit` **não** entra no caixa (dinheiro já entrou antes), mas **gera comissão** normalmente |
| Quem fecha | Somente o **dono** (painel ou API com chave com `comandas:write`) |
| Taxa de cartão | **Não** entra no cálculo da comissão |
| Pagamento misto | Várias formas na mesma comanda (ex.: R$ 50 Pix + R$ 50 dinheiro) |
| Preço editável | Cada linha da comanda guarda snapshot do preço cobrado (não altera a tabela de serviços) |
| Barbeiro na comanda | Exibido por serviço, mas **não é editável** na comanda — altere na agenda |
| Fechar comanda | Registra pagamento, marca atendimentos como `done` e entra no caixa/comissão |
| Caixa do dia | Precisa estar **aberto** para finalizar comandas daquele dia |
| Um caixa por vez | Só pode haver **um** caixa aberto; feche o atual antes de abrir outro dia |
| Comanda no caixa | Só fecha comanda do **mesmo dia** do caixa aberto; fica vinculada à sessão |
| Reabrir comanda | Remove do caixa do dia; agendamento volta a ser editável; **estorna** depósitos e usos de crédito ligados à comanda (bloqueia se o cliente já tiver gasto esse crédito em outro lugar) |
| Cancelar horário | Motivo obrigatório; some da agenda; **bloqueado** se a comanda estiver fechada (reabra antes) |

Formas de pagamento aceitas: `pix`, `cash`, `debit`, `credit`, `store_credit`.

**Crédito do cliente:** depósitos (troco ou valor extra ao fechar comanda) entram no caixa do dia pelo método informado. Pagamentos com `store_credit` não somam nas entradas do caixa.

No painel **Financeiro**, **Entradas no caixa** soma pagamentos reais + depósitos de crédito; **Faturamento em serviços** é só o valor dos atendimentos (base das comissões).

O painel **Financeiro** (`/admin/financeiro`, só dono) abre em **visão geral enxuta** (período + faturamento, comissões, serviços, ticket médio + evolução das entradas) e permite **abrir o detalhe de cada métrica** (`?metric=faturamento|caixa|ticket|servicos|comissoes`): dia a dia, dia da semana, ranking e por barbeiro conforme a métrica.

No menu lateral, a ordem é: Agenda → Caixas → Comissões → Financeiro.

---

## Índice de rotas

| # | Método | Rota | Scope | Função |
| --- | --- | --- | --- | --- |
| 1 | `GET` | `/comandas?date=` | `comandas:read` | Listar comandas de um dia |
| 2 | `GET` | `/comandas?appointmentId=` | `comandas:read` | Buscar ou criar comanda do agendamento |
| 3 | `GET` | `/comandas/:id` | `comandas:read` | Detalhe de uma comanda |
| 4 | `PATCH` | `/comandas/:id` | `comandas:write` | Atualizar itens (serviços e preços) |
| 5 | `POST` | `/comandas/:id/close` | `comandas:write` | Fechar comanda e registrar pagamentos |
| 6 | `POST` | `/comandas/:id/reopen` | `comandas:write` | Reabrir comanda fechada |
| 7 | `GET` | `/finance/cash-register?date=` | `finance:read` | Caixa do dia |
| 8 | `GET` | `/finance/commissions?from=&to=` | `finance:read` | Comissões por barbeiro no período |

Todas são **privadas** (chave de API, sessão admin ou cookie de cliente — financeiro só para **dono** ou chave com scope adequado).

**Barbeiro logado:** pode **ler** apenas as próprias comandas (`comandas:read`). Escrita e relatórios financeiros retornam **403**.

---

## Scopes novos

| Scope | Rotas |
| --- | --- |
| `comandas:read` | `GET /comandas`, `GET /comandas/:id` |
| `comandas:write` | `PATCH /comandas/:id`, `POST .../close`, `POST .../reopen` |
| `finance:read` | `GET /finance/cash-register`, `GET /finance/commissions` |

O preset **Agenda completa** no painel já inclui esses scopes.

---

## 1. Listar comandas do dia

```
GET /api/v1/comandas?date=2026-06-25
Authorization: Bearer <chave>
```

Parâmetros opcionais:

| Parâmetro | Valores | Descrição |
| --- | --- | --- |
| `status` | `open` \| `closed` | Filtrar por status |
| `professionalId` | UUID | Filtrar por barbeiro (dono / API key) |

Resposta (`200`):

```json
{
  "comandas": [
    {
      "id": "uuid",
      "appointmentId": "uuid",
      "professionalId": "uuid",
      "status": "closed",
      "totalCents": 8000,
      "commissionCents": 4000,
      "closedAt": "2026-06-25T18:30:00.000Z"
    }
  ]
}
```

---

## 2. Comanda por agendamento

Cria automaticamente a comanda (status `open`) se ainda não existir. Une todos os agendamentos **normais** do mesmo cliente naquele dia e inclui **encaixes manuais** desse cliente (serviços e atendimentos na resposta).

```
GET /api/v1/comandas?appointmentId=<uuid-do-agendamento>
Authorization: Bearer <chave>
```

Resposta (`200`):

```json
{
  "comanda": {
    "id": "uuid",
    "appointmentId": "uuid",
    "professionalId": "uuid",
    "professionalNickname": "Carlão",
    "status": "open",
    "commissionPercentSnapshot": null,
    "totalCents": 0,
    "commissionCents": 0,
    "closedAt": null,
    "customerFirstName": "João",
    "customerLastName": "Silva",
    "customerWhatsapp": "5511999999999",
    "serviceDate": "2026-06-25",
    "items": [
      {
        "id": "uuid",
        "serviceId": "uuid",
        "serviceName": "Corte",
        "catalogPriceCents": 4000,
        "chargedPriceCents": 4000,
        "sortOrder": 0,
        "professionalId": "uuid",
        "professionalNickname": "Carlão",
        "appointmentId": "uuid",
        "squeezeAppointmentId": null
      }
    ],
    "linkedAppointments": [
      {
        "id": "uuid",
        "professionalId": "uuid",
        "professionalNickname": "Carlão",
        "startTime": "14:00",
        "endTime": "14:30",
        "status": "confirmed",
        "isSqueezeIn": false
      }
    ],
    "payments": [],
    "appointment": {
      "date": "2026-06-25",
      "startTime": "14:00",
      "endTime": "14:30",
      "status": "confirmed",
      "customerFirstName": "João",
      "customerLastName": "Silva",
      "customerWhatsapp": "5511999999999",
      "isSqueezeIn": false
    }
  }
}
```

`appointment` no JSON é legado; prefira `linkedAppointments` e `serviceDate`.

---

## 3. Detalhe da comanda

```
GET /api/v1/comandas/<id>
Authorization: Bearer <chave>
```

Mesmo formato de `comanda` do item anterior.

---

## 4. Atualizar itens

Somente comanda **aberta**. Substitui a lista inteira de serviços.

```
PATCH /api/v1/comandas/<id>
Authorization: Bearer <chave>
Content-Type: application/json
```

Corpo:

```json
{
  "items": [
    {
      "serviceId": "uuid-do-servico",
      "serviceName": "Corte",
      "catalogPriceCents": 4000,
      "chargedPriceCents": 3500
    },
    {
      "serviceId": "uuid-outro",
      "serviceName": "Barba",
      "catalogPriceCents": 2500,
      "chargedPriceCents": 2500
    }
  ]
}
```

- `catalogPriceCents`: preço de tabela no momento (referência)
- `chargedPriceCents`: valor cobrado (pode ter desconto)

Também **espelha na agenda** os serviços extras da comanda: cada item além dos do agendamento principal vira um **encaixe** (card ao lado, borda tracejada), sem alterar o horário do agendamento original. Cada serviço extra novo (não reatribuição) também dispara o webhook `appointment.created` (`source: "comanda_extra"`) — ver [API-N8N.md, seção 6b](./API-N8N.md#6b-webhook-aviso-automático-ao-barbeiro-appointmentcreated).

Resposta: `{ "comanda": { ... } }` atualizada.

---

## 5. Fechar comanda

A soma de `payments[].amountCents` deve ser **igual** ao total dos itens.

```
POST /api/v1/comandas/<id>/close
Authorization: Bearer <chave>
Content-Type: application/json
```

Corpo:

```json
{
  "payments": [
    { "paymentMethod": "pix", "amountCents": 5000 },
    { "paymentMethod": "cash", "amountCents": 1000 }
  ]
}
```

Efeitos:

- Comanda → `status: "closed"`
- Grava `% comissão` do barbeiro na hora (`commissionPercentSnapshot`)
- Calcula `totalCents` e `commissionCents`
- Agendamento → `status: "done"`

---

## 6. Reabrir comanda

```
POST /api/v1/comandas/<id>/reopen
Authorization: Bearer <chave>
```

Remove pagamentos, zera totais e volta o agendamento para status editável (geralmente `confirmed`). Sai do caixa do dia em que estava fechada.

---

## 7. Caixa do dia

```
GET /api/v1/finance/cash-register?date=2026-06-25
Authorization: Bearer <chave>
```

Resposta (`200`):

```json
{
  "summary": {
    "date": "2026-06-25",
    "totalCents": 15000,
    "commissionCents": 7500,
    "shopCents": 7500,
    "byPaymentMethod": {
      "pix": 10000,
      "cash": 3000,
      "debit": 2000,
      "credit": 0
    },
    "comandaCount": 3,
    "comandas": [
      {
        "id": "uuid",
        "appointmentId": "uuid",
        "closedAt": "2026-06-25T18:30:00.000Z",
        "professionalNickname": "Carlão",
        "customerName": "João Silva",
        "totalCents": 5000,
        "commissionCents": 2500,
        "payments": [
          { "method": "pix", "amountCents": 5000 }
        ]
      }
    ]
  }
}
```

Filtro por `service_date` (dia do caixa / data do atendimento), não por `closed_at`.

---

## 8. Comissões no período

```
GET /api/v1/finance/commissions?from=2026-06-01&to=2026-06-25
Authorization: Bearer <chave>
```

Parâmetro opcional: `professionalId` (UUID).

Os valores por barbeiro somam **cada item da comanda** pelo `professional_id` do serviço (não o barbeiro “principal” da comanda). Gorjetas entram no faturamento e vão 100% para o barbeiro escolhido na hora de fechar.

No painel admin, o dono pode **registrar o pagamento** da comissão de um barbeiro no período filtrado. Itens já pagos saem do relatório e desta API — o valor não entra de novo no próximo repasse.

Resposta (`200`):

```json
{
  "summary": {
    "from": "2026-06-01",
    "to": "2026-06-25",
    "rows": [
      {
        "professionalId": "uuid",
        "professionalNickname": "Carlão",
        "commissionPercent": 50,
        "comandaCount": 12,
        "totalCents": 48000,
        "commissionCents": 24000,
        "shopCents": 24000,
        "tipCents": 0,
        "serviceItemCount": 14
      }
    ],
    "totals": {
      "totalCents": 48000,
      "commissionCents": 24000,
      "shopCents": 24000,
      "comandaCount": 12
    }
  }
}
```

---

## Erros comuns

| HTTP | Quando |
| --- | --- |
| **400** | Data inválida, soma de pagamentos diferente do total, comanda já fechada |
| **401** | Sem autenticação ou chave inválida |
| **403** | Barbeiro tentando fechar comanda ou ver caixa; scope insuficiente |
| **404** | Comanda ou agendamento não encontrado |
| **409** | Conflito ao reabrir (ex.: horário já ocupado) |

---

## Fluxo típico no n8n

1. `GET /appointments?whatsapp=` — achar agendamento do cliente
2. `GET /comandas?appointmentId=` — abrir comanda
3. `PATCH /comandas/:id` — ajustar serviços/preços se necessário
4. `POST /comandas/:id/close` — registrar pagamento e finalizar
5. (Opcional) `GET /finance/cash-register?date=` — conferir caixa do dia

---

## Painel admin (financeiro)

Somente o **dono** vê as rotas abaixo (menu **Dia a dia** na sidebar).

| Rota | Função |
| --- | --- |
| `/admin` (aba **CAIXA**) | Operar o caixa do dia na agenda: abrir/fechar, comandas fechadas, entradas, comissões e barbearia |
| `/admin/financeiro` | Dashboard de métricas por período: KPIs, evolução diária, pagamentos e barbeiros (comparação com período anterior) |
| `/admin/financeiro/caixas` | Histórico de sessões de caixa: filtro por período, busca, abrir/fechar/reabrir, links para agenda e comissões |
| `/admin/financeiro/comissoes` | Comissões por barbeiro no período (`service_date`). Ao **detalhar** um barbeiro: resumo com **faturamento**, **comissão** e **serviços**, **dia a dia**, ranking de serviços, lista de **atendimentos** (cliente, itens, valores e pagamentos) e formas de pagamento. Clique em um dia para filtrar só aquele dia |

- **Agenda:** clique no horário → modal de comanda (fechar, reabrir, pagamento misto)
- **Profissionais:** campo **% de comissão** no cadastro de cada barbeiro

Relatórios do painel e da API filtram comandas fechadas por **`service_date`** (dia do atendimento / dia do caixa), não por `closed_at`.
