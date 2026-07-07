import type { ActionResult } from "@/lib/require-owner";
import type { AdminSession } from "@/lib/require-admin";

export type ProfessionalPermissions = {
  canBookClients: boolean;
  canCreateSqueezeIn: boolean;
  canOpenComanda: boolean;
  canEditComanda: boolean;
  canCloseComanda: boolean;
  canEditAppointments: boolean;
  canCancelAppointments: boolean;
  canManageScheduleBlocks: boolean;
};

export type ProfessionalPermissionsRow = {
  can_book_clients: boolean;
  can_create_squeeze_in: boolean;
  can_open_comanda: boolean;
  can_edit_comanda: boolean;
  can_close_comanda: boolean;
  can_edit_appointments: boolean;
  can_cancel_appointments: boolean;
  can_manage_schedule_blocks: boolean;
};

export const OWNER_PERMISSIONS: ProfessionalPermissions = {
  canBookClients: true,
  canCreateSqueezeIn: true,
  canOpenComanda: true,
  canEditComanda: true,
  canCloseComanda: true,
  canEditAppointments: true,
  canCancelAppointments: true,
  canManageScheduleBlocks: true,
};

export const DEFAULT_BARBER_PERMISSIONS: ProfessionalPermissions = {
  canBookClients: true,
  canCreateSqueezeIn: true,
  canOpenComanda: true,
  canEditComanda: false,
  canCloseComanda: false,
  canEditAppointments: true,
  canCancelAppointments: true,
  canManageScheduleBlocks: true,
};

export const PERMISSION_LABELS: {
  key: keyof ProfessionalPermissions;
  title: string;
  description: string;
  group: "agenda" | "comanda";
}[] = [
  {
    key: "canBookClients",
    title: "Marcar cliente",
    description: "Criar agendamento normal na agenda.",
    group: "agenda",
  },
  {
    key: "canCreateSqueezeIn",
    title: "Fazer encaixe",
    description: "Agendar fora do horário livre ou sobrepondo outro horário.",
    group: "agenda",
  },
  {
    key: "canEditAppointments",
    title: "Editar agendamentos",
    description: "Alterar data, horário, serviços ou cliente.",
    group: "agenda",
  },
  {
    key: "canCancelAppointments",
    title: "Cancelar agendamentos",
    description: "Cancelar horários marcados na agenda.",
    group: "agenda",
  },
  {
    key: "canManageScheduleBlocks",
    title: "Bloquear horários",
    description: "Criar e remover bloqueios na própria agenda.",
    group: "agenda",
  },
  {
    key: "canOpenComanda",
    title: "Abrir comanda",
    description: "Visualizar e iniciar comandas dos atendimentos.",
    group: "comanda",
  },
  {
    key: "canEditComanda",
    title: "Editar comanda",
    description: "Alterar serviços, valores e formas de pagamento.",
    group: "comanda",
  },
  {
    key: "canCloseComanda",
    title: "Fechar comanda",
    description: "Finalizar atendimento e registrar pagamento no caixa.",
    group: "comanda",
  },
];

const PERMISSION_ERRORS: Record<keyof ProfessionalPermissions, string> = {
  canBookClients: "Você não pode marcar clientes na agenda.",
  canCreateSqueezeIn: "Você não pode fazer encaixe na agenda.",
  canOpenComanda: "Você não pode abrir comandas.",
  canEditComanda: "Você não pode editar comandas.",
  canCloseComanda: "Você não pode fechar comandas.",
  canEditAppointments: "Você não pode editar agendamentos.",
  canCancelAppointments: "Você não pode cancelar agendamentos.",
  canManageScheduleBlocks: "Você não pode bloquear horários na agenda.",
};

export function mapProfessionalPermissionsRow(
  row: Partial<ProfessionalPermissionsRow> | null | undefined
): ProfessionalPermissions {
  if (!row) return { ...DEFAULT_BARBER_PERMISSIONS };

  return {
    canBookClients: row.can_book_clients ?? true,
    canCreateSqueezeIn: row.can_create_squeeze_in ?? true,
    canOpenComanda: row.can_open_comanda ?? true,
    canEditComanda: row.can_edit_comanda ?? false,
    canCloseComanda: row.can_close_comanda ?? false,
    canEditAppointments: row.can_edit_appointments ?? true,
    canCancelAppointments: row.can_cancel_appointments ?? true,
    canManageScheduleBlocks: row.can_manage_schedule_blocks ?? true,
  };
}

export function permissionsToDbRow(
  permissions: ProfessionalPermissions
): ProfessionalPermissionsRow {
  return {
    can_book_clients: permissions.canBookClients,
    can_create_squeeze_in: permissions.canCreateSqueezeIn,
    can_open_comanda: permissions.canOpenComanda,
    can_edit_comanda: permissions.canEditComanda,
    can_close_comanda: permissions.canCloseComanda,
    can_edit_appointments: permissions.canEditAppointments,
    can_cancel_appointments: permissions.canCancelAppointments,
    can_manage_schedule_blocks: permissions.canManageScheduleBlocks,
  };
}

export function parsePermissionsFormData(
  formData: FormData
): ProfessionalPermissions {
  return {
    canBookClients: formData.get("canBookClients") === "1",
    canCreateSqueezeIn: formData.get("canCreateSqueezeIn") === "1",
    canOpenComanda: formData.get("canOpenComanda") === "1",
    canEditComanda: formData.get("canEditComanda") === "1",
    canCloseComanda: formData.get("canCloseComanda") === "1",
    canEditAppointments: formData.get("canEditAppointments") === "1",
    canCancelAppointments: formData.get("canCancelAppointments") === "1",
    canManageScheduleBlocks: formData.get("canManageScheduleBlocks") === "1",
  };
}

export function assertPermission(
  session: AdminSession,
  permission: keyof ProfessionalPermissions
): ActionResult | null {
  if (session.isOwner || session.permissions[permission]) return null;
  return { ok: false, error: PERMISSION_ERRORS[permission] };
}
