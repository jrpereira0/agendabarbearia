export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "on_site",
  "cancelled",
  "done",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Bloqueia horário na grade e na disponibilidade. */
export const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "on_site",
] as const;

export type ActiveAppointmentStatus =
  (typeof ACTIVE_APPOINTMENT_STATUSES)[number];

/** Opções do menu com botão direito no card. */
export const CONTEXT_MENU_STATUSES = [
  "scheduled",
  "confirmed",
  "on_site",
  "cancelled",
  "done",
] as const;

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  on_site: "No local",
  cancelled: "Cancelado",
  done: "Atendido",
};

export function isActiveAppointmentStatus(
  status: string
): status is ActiveAppointmentStatus {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

export function blocksAgendaSlot(appointment: {
  status: string;
  isSqueezeIn?: boolean;
}): boolean {
  return isActiveAppointmentStatus(appointment.status) && !appointment.isSqueezeIn;
}

/** Inclui encaixe e atendido na divisão lado a lado quando horários se sobrepõem. */
export function sharesAgendaColumnLayout(appointment: {
  status: string;
}): boolean {
  return (
    isActiveAppointmentStatus(appointment.status) ||
    appointment.status === "done"
  );
}
