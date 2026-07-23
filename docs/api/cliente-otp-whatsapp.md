# Login do cliente por código WhatsApp (OTP)

O site `/agenda` e o **app mobile** exigem que o cliente **prove que o número é dele** antes de:

- confirmar um agendamento
- ver / remarcar / cancelar em **Meus horários**

O código chega no WhatsApp via **n8n**. Depois de acertar uma vez, o cliente fica **logado ~14 dias**.

| Canal | Como a sessão é usada |
| --- | --- |
| **Site** | Cookie httpOnly `agenda_client_session` |
| **App** | `accessToken` no body do verify → `Authorization: Bearer <accessToken>` |

Guia do app: [app-mobile.md](./app-mobile.md).

---

## O que o sistema já faz

| Etapa | Rota |
| --- | --- |
| Pedir código | `POST /api/agenda/otp/send` body `{ "whatsapp": "11999999999" }` |
| Validar código + login | `POST /api/agenda/otp/verify` body `{ "whatsapp": "...", "code": "123456" }` |
| Ver se já está logado | `GET /api/agenda/session` (cookie ou Bearer) |
| Sair (site) | `DELETE /api/agenda/session` |

Resposta do **verify** (site + app):

```json
{
  "ok": true,
  "whatsapp": "5511999999999",
  "accessToken": "<token>",
  "tokenType": "Bearer",
  "expiresAt": 1720000000000
}
```

O site ignora o token e usa o cookie. O app **guarda** o `accessToken` e envia nas rotas privadas de `/api/v1`.

Após o login, `POST /api/v1/appointments` (criar) e as rotas de listar/remarcar/cancelar exigem cookie, Bearer do cliente **ou** chave de API (n8n/bot).

### Variáveis de ambiente

No `.env.local` / Vercel:

```env
CLIENT_SESSION_SECRET=... # já existia (32+ chars)
N8N_CLIENT_OTP_WEBHOOK_URL=https://seu-n8n.com/webhook/client-otp
N8N_CLIENT_OTP_WEBHOOK_SECRET=gere-um-segredo-aleatorio
```

Migration do banco: `0053_client_whatsapp_otps.sql` — rode `npm run db:migrate`.

Em **desenvolvimento**, se a URL do webhook não estiver configurada, o código é só **impresso no log do servidor** (pra testar sem n8n). Em **produção**, sem webhook o envio falha com mensagem amigável.

### Payload que o site manda ao n8n

`POST` JSON para `N8N_CLIENT_OTP_WEBHOOK_URL`:

```json
{
  "event": "client.otp",
  "whatsapp": "5511999999999",
  "code": "482913",
  "expiresInMinutes": 5,
  "shop": { "name": "Dinho Barber Coffee" },
  "message": "Dinho Barber Coffee: seu código de acesso é 482913. Vale por 5 minutos. Não compartilhe."
}
```

Header opcional (se `N8N_CLIENT_OTP_WEBHOOK_SECRET` estiver setado):

```http
x-client-otp-webhook-secret: <mesmo valor da env>
```

O n8n deve responder **2xx**. Qualquer outro status = o site avisa o cliente que não conseguiu enviar.

---

## Prompt para colar no ChatGPT (criar o fluxo n8n)

Copie o bloco abaixo inteiro e cole no ChatGPT (ou outra IA). Ajuste a URL do seu n8n / provedor de WhatsApp se ele pedir.

````text
Quero que você me ajude a montar um workflow no n8n que recebe um webhook do meu sistema de agendamento (Agenda Barbearia / Dinho Barber Coffee) e envia um código OTP no WhatsApp do cliente.

## Contexto
- O site Next.js chama meu webhook quando o cliente pede o código de login.
- Depois o cliente digita o código no site; o n8n NÃO valida o código — só entrega a mensagem.
- Já uso n8n + WhatsApp (Evolution API / Z-API / similar) para outros avisos da barbearia.

## Contrato do webhook (entrada)
- Método: POST
- Content-Type: application/json
- Header opcional de segurança: `x-client-otp-webhook-secret` (comparar com um valor fixo que eu configurar no n8n)
- Body exemplo:
```json
{
  "event": "client.otp",
  "whatsapp": "5511999999999",
  "code": "482913",
  "expiresInMinutes": 5,
  "shop": { "name": "Dinho Barber Coffee" },
  "message": "Dinho Barber Coffee: seu código de acesso é 482913. Vale por 5 minutos. Não compartilhe."
}
```

## O que o workflow deve fazer
1. Nó Webhook (POST) — path tipo `/client-otp` (ou o que eu escolher).
2. Validar o header `x-client-otp-webhook-secret` (se não bater, responder 401 e parar).
3. Extrair `whatsapp` e `message` (preferir o campo `message` pronto; se quiser, pode montar a partir de `code` + `shop.name` + `expiresInMinutes`).
4. Enviar a mensagem de texto no WhatsApp para o número `whatsapp` (já vem com DDI 55).
5. Responder 200 JSON `{ "ok": true }` rápido (não precisa esperar confirmação de leitura).

## Requisitos de UX da mensagem
- Curta e clara.
- Incluir o código em destaque.
- Dizer que vale poucos minutos e para não compartilhar.
- Usar o nome da loja (`shop.name`).

## Me oriente passo a passo
1. Quais nós criar no n8n (nomes e ordem).
2. Como configurar o Webhook (método, path, “Respond” / “Response Mode”).
3. Expressão para ler `whatsapp`, `code`, `message` e o header do secret.
4. Exemplo de nó HTTP Request (ou nó nativo do meu provedor) para enviar WhatsApp — me peça qual provedor eu uso (Evolution, Z-API, Twilio, Meta Cloud API, etc.) e monte o exemplo certo.
5. Como testar com um POST de exemplo (curl).
6. Checklist de erros comuns (número sem 55, secret errado, webhook não público, etc.).

## Restrições
- Não invente rotas da API do Agenda Barbearia além deste webhook.
- Não guarde o código no n8n além do necessário para enviar a mensagem.
- Responda em português, de forma prática, como um tutorial.
````

---

## Checklist seu

1. [ ] `npm run db:migrate` (tabela `client_whatsapp_otps`)
2. [ ] Criar workflow no n8n com o prompt acima
3. [ ] Colar a URL do webhook em `N8N_CLIENT_OTP_WEBHOOK_URL`
4. [ ] Mesmo segredo em `N8N_CLIENT_OTP_WEBHOOK_SECRET` e no n8n
5. [ ] Redeploy na Vercel com as novas envs
6. [ ] Testar em `/agenda`: Agendar → dados → receber código → confirmar
7. [ ] Testar aba Horários: código → lista → Sair
8. [ ] (App) Guardar `accessToken` do verify e chamar `GET /api/v1/appointments` com Bearer
