-- Campos detalhados do profissional: nome, sobrenome, apelido (exibido
-- ao cliente), contato e Instagram. Substitui a coluna unica "name".

alter table public.professionals drop column name;

alter table public.professionals
  add column first_name text not null default '',
  add column last_name text not null default '',
  add column nickname text not null default '',
  add column email text not null default '',
  add column whatsapp text not null default '',
  add column instagram text;

-- Os defaults vazios existiam so para permitir o "not null" na criacao.
alter table public.professionals
  alter column first_name drop default,
  alter column last_name drop default,
  alter column nickname drop default,
  alter column email drop default,
  alter column whatsapp drop default;
