-- Permissões granulares por profissional no painel (agenda e comanda).

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS can_book_clients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_create_squeeze_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_open_comanda boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_edit_comanda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_close_comanda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_appointments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_cancel_appointments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_manage_schedule_blocks boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN professionals.can_book_clients IS 'Pode marcar cliente na agenda.';
COMMENT ON COLUMN professionals.can_create_squeeze_in IS 'Pode fazer encaixe na agenda.';
COMMENT ON COLUMN professionals.can_open_comanda IS 'Pode abrir e visualizar comandas.';
COMMENT ON COLUMN professionals.can_edit_comanda IS 'Pode editar itens e pagamentos da comanda.';
COMMENT ON COLUMN professionals.can_close_comanda IS 'Pode fechar comandas.';
COMMENT ON COLUMN professionals.can_edit_appointments IS 'Pode editar agendamentos na agenda.';
COMMENT ON COLUMN professionals.can_cancel_appointments IS 'Pode cancelar agendamentos.';
COMMENT ON COLUMN professionals.can_manage_schedule_blocks IS 'Pode bloquear horários na agenda.';
