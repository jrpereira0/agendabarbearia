# Arquitetura — Agenda Barbearia

Atualizado por fase, conforme o sistema evolui.

## Visão geral

- **Next.js (App Router)**: site público, painel admin e API no mesmo projeto
- **Supabase**: banco PostgreSQL, login (Auth) e fotos (Storage)
- **Vercel** (fase final): hospedagem

## Estrutura de pastas

| Pasta | O que tem |
| --- | --- |
| `src/app/page.tsx` | Página inicial pública |
| `src/app/admin/login` | Tela de login do painel |
| `src/app/admin/(panel)` | Painel protegido (exige login) |
| `src/app/admin/(panel)/profissionais` | Lista, cadastro e edição de profissionais |
| `src/components/ui` | Componentes visuais (shadcn/ui) |
| `src/components/admin` | Componentes do painel (sidebar, formulários, cards) |
| `src/lib/supabase` | Conexões com o Supabase (browser, server, admin) |
| `src/proxy.ts` | Protege as rotas `/admin` (redireciona pro login) |
| `supabase/migrations` | Histórico de mudanças do banco (SQL) |
| `scripts` | Ferramentas: `db:migrate` e `create-admin` |

## Banco de dados

| Tabela | Função |
| --- | --- |
| `profiles` | Usuários do painel (papel: `owner` ou `barber`) |
| `professionals` | Barbeiros: nome, sobrenome, apelido, WhatsApp, e-mail, Instagram, foto |
| `services` | Serviços: nome, foto, preço (centavos), duração (minutos) |
| `professional_services` | Quais serviços cada profissional faz |
| `working_hours` | Grade semanal de horários por profissional |
| `appointments` | Agendamentos dos clientes (nome, sobrenome, WhatsApp, status) |
| `appointment_services` | Serviços escolhidos em cada agendamento |

Regras importantes no banco:

- O **primeiro usuário** criado vira `owner`; os demais, `barber`
- O banco **impede dois agendamentos confirmados no mesmo horário** do mesmo profissional
- Visitantes (sem login) só leem o catálogo; agendamentos exigem login ou passam pela API do sistema

## Papéis e permissões

- **Dono (`owner`)**: vê e gerencia tudo (profissionais, serviços, horários, agendamentos)
- **Barbeiro (`barber`)**: entra com e-mail/senha criados pelo dono; vê a própria agenda e os próprios horários

## Profissionais

- Cadastro cria automaticamente o **login do barbeiro** (e-mail + senha)
- Excluir um profissional apaga também o login; se houver agendamentos no histórico, o sistema bloqueia a exclusão e sugere **desativar**
- Foto vai pro bucket `photos` do Supabase Storage (pasta `professionals/`)

## Serviços

- Campos: nome, descrição, foto, preço (guardado em **centavos**) e duração (em **minutos** — é o que define os horários livres na agenda)
- Excluir um serviço usado em agendamentos é bloqueado; o caminho é **desativar**
- Foto vai pro bucket `photos` (pasta `services/`)
- No formulário, o preço tem máscara de moeda (digite números e vira R$ automaticamente)

## Horários

Três camadas, da mais geral pra mais específica:

1. **Horário da barbearia** (`business_hours`): por dia da semana, abre/fecha ou fechado. É o teto — ninguém atende fora dele. Editado na tela **Horários**
2. **Grade do profissional** (`working_hours`): faixas de horário por dia da semana (várias faixas = pausa de almoço; nenhuma faixa = folga). Editada **no cadastro do profissional** (Profissionais > editar)
3. **Dias especiais** (`schedule_exceptions`): valem pra uma data específica e vencem as camadas acima. Pode ser da barbearia toda ou de um barbeiro só; fechado ou com horário diferente. Editados na tela **Horários**

Somente o **dono** edita horários; o barbeiro vê a própria grade em modo leitura na tela Horários.

## Motor de horários livres

- **Lógica pura** em `src/lib/availability.ts` (cálculo, sem banco) e **busca de dados** em `src/lib/get-availability.ts`
- Cruza: horário da barbearia ∩ grade do barbeiro, aplica exceções do dia, soma a duração dos serviços escolhidos e remove conflitos com agendamentos confirmados
- O **intervalo da agenda** (de quantos em quantos minutos os horários aparecem) é configurável na tela Horários: 5, 10, 15, 20, 30, 45 ou 60 min (`shop_settings.slot_step_minutes`, padrão 15)
- Pra hoje, só oferece horários com 10 min de antecedência; agenda aberta até **60 dias** à frente
- Fuso fixo da barbearia: `America/Sao_Paulo`
- Exposto em `GET /api/v1/availability?professionalId=...&date=AAAA-MM-DD&serviceIds=id1,id2` (público, mesmo endpoint que o site e as automações de WhatsApp usam)

## Fotos (profissionais e serviços)

- Toda foto é **comprimida no navegador antes do envio** (`src/lib/compress-image.ts`): redimensionada pra até 1024px e convertida pra WebP
- Se a compressão falhar, o arquivo original é enviado (limite de 10 MB configurado no `next.config.ts`)

## Como atualizar o banco

Nunca rode SQL manualmente. Crie um arquivo numerado em `supabase/migrations` e rode:

```bash
npm run db:migrate
```
