# Documentação da API

Referência e guias da API REST em `/api/v1`.

## No painel

**Configurações → Integrações → Documentação da API** — abre a tela dedicada `/docs/api` (Scalar, só para o dono; fora do layout do painel).

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| [../openapi/v1.yaml](../openapi/v1.yaml) | Especificação OpenAPI 3.1 (fonte da referência) |
| [app-mobile.md](./app-mobile.md) | Contrato pra app do cliente (token OTP + loja + fluxo) |
| [guia-n8n.md](./guia-n8n.md) | Guia para n8n / WhatsApp: auth, exemplos, webhooks, fluxo de conversa |
| [cliente-otp-whatsapp.md](./cliente-otp-whatsapp.md) | Login do cliente por código WhatsApp (OTP) + prompt para fluxo n8n |
| [financeiro.md](./financeiro.md) | Regras de comandas, caixa e comissões (painel; sem rotas REST) |

## Visão geral

Ver também [ARQUITETURA.md](../ARQUITETURA.md) (tabela de rotas, rate limits e autenticação).
