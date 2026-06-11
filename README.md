# Agenda Barbearia

Sistema de agendamento online para barbearia. Os clientes escolhem o profissional, os serviços e o horário disponível, e confirmam com nome e WhatsApp. A barbearia gerencia profissionais, serviços e horários por um painel administrativo. Toda a funcionalidade também é exposta por uma API REST para automações (ex: agendamento via WhatsApp com IA).

## Tecnologias

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL, Auth e Storage)
- Zod (validação)

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Crie um projeto no [supabase.com](https://supabase.com), copie `.env.example` para `.env.local` e preencha as chaves:

```bash
cp .env.example .env.local
```

3. Rode o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Comandos úteis

```bash
npm run dev           # roda o site em localhost:3000
npm run db:migrate    # aplica mudanças pendentes no banco
npm run create-admin  # cria usuário do painel: -- email senha "Nome"
```

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — como o sistema é organizado, tabelas do banco e permissões
