# Comandas, caixa e comissões — regras de negócio

Comandas, caixa e comissões vivem **só no painel admin** (não há rotas `/api/v1` para isso). Este guia resume as regras do dia a dia na barbearia.

Guia da API de agenda/lembretes: [guia-n8n.md](./guia-n8n.md).

---

## Regras de negócio

| Regra | Detalhe |
| --- | --- |
| Comanda por cliente/dia | Uma comanda **aberta** por WhatsApp + data; agrupa todos os agendamentos **ativos** do mesmo cliente naquele dia (ex.: 12h com um barbeiro e 15h com outro) |
| Nova comanda no mesmo dia | Depois de **fechar** a comanda, um novo agendamento do cliente naquele dia abre **outra** comanda — não mistura com a já finalizada |
| Encaixes na comanda | Encaixes manuais do mesmo cliente no dia entram na comanda automaticamente (serviços + lista de atendimentos) |
| Extras na comanda | Serviço adicionado na comanda além dos do agendamento vira **encaixe** na agenda |
| Produtos na comanda | Item com produto; barbeiro é **opcional**. Sem barbeiro: **sem comissão** (100% barbearia). Com barbeiro: % do produto |
| Comissão | % sobre o valor **cobrado** de cada **serviço** (configurável por barbeiro). Produto: % do cadastro **só se** houver barbeiro |
| Gorjeta | Opcional ao fechar; o barbeiro escolhido recebe **100%** (entra no total e no caixa) |
| Crédito do cliente | Saldo por cliente; pode pagar comanda com crédito da loja; valor pago a mais que vira crédito **entra no caixa** pelo método de origem (Pix, dinheiro etc.), mas **não** entra no faturamento de serviços |
| Uso de crédito | Pagamento com crédito da loja **não** entra no caixa (dinheiro já entrou antes), mas **gera comissão** normalmente |
| Crédito manual | Adicionar/remover crédito no cadastro do cliente **não** entra no caixa nem no faturamento |
| Quem fecha | **Dono** no painel; barbeiro se tiver permissão |
| Taxa de cartão | **Não** entra no cálculo da comissão |
| Pagamento misto | Várias formas na mesma comanda (ex.: R$ 50 Pix + R$ 50 dinheiro) |
| Preço editável | Cada linha da comanda guarda o preço cobrado (não altera a tabela de serviços) |
| Barbeiro na comanda | Em **serviços**, exibido mas **não editável** na comanda — altere na agenda. Em **produtos**, pode ser omitido ou escolhido na hora |
| Fechar comanda | Registra pagamento, marca atendimentos como concluídos e entra no caixa/comissão |
| Caixa do dia | Precisa estar **aberto** para finalizar comandas daquele dia |
| Um caixa por vez | Só pode haver **um** caixa aberto; feche o atual antes de abrir outro dia |
| Comanda no caixa | Só fecha comanda do **mesmo dia** do caixa aberto; fica vinculada à sessão |
| Reabrir comanda | Remove do caixa do dia; agendamento volta a ser editável; **estorna** depósitos e usos de crédito ligados à comanda. Se o cliente já gastou esse crédito em outro lugar, a tela pede confirmação e estorna só o que ainda sobrar no saldo |
| Cancelar horário | Motivo obrigatório; some da agenda; **bloqueado** se a comanda estiver fechada (reabra antes) |

Formas de pagamento aceitas: Pix, dinheiro, débito, crédito e crédito da loja.

**Crédito do cliente:** depósitos (valor pago a mais ao fechar comanda, com “guardar crédito”) entram no **caixa** do dia pelo método informado; **não** somam no faturamento de serviços. Pagamentos com crédito da loja não somam nas entradas do caixa, mas a comissão do barbeiro segue pelo serviço feito naquele dia. Crédito lançado manualmente no cadastro do cliente não entra no caixa nem no faturamento.

No painel **Métricas**, **Entradas no caixa** soma pagamentos reais + depósitos de crédito; **Faturamento** é só o valor dos atendimentos/serviços (base das comissões).

O painel **Métricas** (`/admin/metricas`, só dono; o antigo `/admin/financeiro` redireciona para cá) abre em **visão geral enxuta** (período + faturamento, saídas, lucro, atendimentos, ticket, comissões, produtos, clientes novos, ocupação, cancelamentos + gráfico dos últimos 7 dias). Os cards principais mostram a **variação % vs. o período anterior equivalente**. Dá para **abrir o detalhe de cada métrica** (`?metric=faturamento|caixa|ticket|servicos|produtos|saidas|comissoes|pagamentos|barbeiros|semana|ranking|clientes|ocupacao|cancelamentos`): dia a dia, dia da semana, ranking, por barbeiro, lista de novos/recorrentes, ocupação da grade ou cancelamentos conforme a métrica. **Novos vs. recorrentes** usa o WhatsApp (ignorando cancelados): novo = primeira visita no período; recorrente = já tinha vindo antes. **Ocupação** = minutos de agendamento (sem encaixe/cancelado) ÷ minutos disponíveis na grade (loja ∩ barbeiro − bloqueios). Na agenda, o card do horário ganha um ícone de **primeira visita** quando for o caso.

No menu lateral, a ordem é: Agenda → Financeiro (Caixas, Despesas, Comissões) → Métricas.

---

## Painel admin (financeiro)

Somente o **dono** vê as rotas abaixo (menu **Dia a dia** na sidebar). O barbeiro vê **Minhas comissões**.

| Rota | Função |
| --- | --- |
| `/admin` (aba **CAIXA**) | Operar o caixa do dia na agenda: **saldo em destaque**, entradas/comissões/barbearia, barras por forma de pagamento, lista de comandas fechadas, abrir/encerrar caixa e link para métricas |
| `/admin/metricas` | Dashboard de métricas por período: KPIs, evolução diária, pagamentos e barbeiros (comparação com período anterior). `/admin/financeiro` redireciona para cá |
| `/admin/financeiro/caixas` | Histórico de sessões de caixa: filtro por período, busca, abrir/fechar/reabrir, links para agenda e comissões |
| `/admin/financeiro/comissoes` | Comissões por barbeiro no período (dia do atendimento/caixa). Ao **detalhar** um barbeiro: resumo com **faturamento**, **comissão** e **serviços**, **dia a dia**, ranking de serviços, lista de **atendimentos** e formas de pagamento. Produtos sem profissional **não** entram no repasse |

- **Agenda:** clique no horário → modal de comanda (fechar, reabrir, pagamento misto; produto com opção **Sem profissional**)
- **Profissionais:** campo **% de comissão** no cadastro de cada barbeiro

Relatórios do painel filtram comandas fechadas pelo **dia do atendimento / dia do caixa**, não pelo horário em que a comanda foi fechada.
