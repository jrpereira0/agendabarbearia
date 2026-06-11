-- Descricao do servico, exibida ao cliente na hora de escolher.
alter table public.services
  add column description text not null default '';
