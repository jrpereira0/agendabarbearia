import type { AppointmentStatus } from "@/lib/appointment-status";

/** Cores da grade e dos status dos agendamentos. */

const outsideCell = "bg-neutral-700";

export const agendaLegend = {
  free: "border border-neutral-300 bg-white",
  outside: outsideCell,
  blocked: outsideCell,
  occupied: "bg-blue-50",
  scheduled: "bg-[#1e40af]",
  confirmed: "bg-[#0d9488]",
  onSite: "bg-[#d97706]",
  cancelled: "bg-[#c41e3a]",
  squeezeIn: "border-2 border-dashed border-[#c41e3a] bg-white",
  comandaExtra: "border-2 border-dashed border-neutral-900 bg-neutral-100",
  done: "bg-[#15803d]",
} as const;

export function agendaCellClass({
  inSchedule,
  occupied,
  blocked,
}: {
  inSchedule: boolean;
  occupied: boolean;
  blocked?: boolean;
}): string {
  if (!inSchedule) return agendaLegend.outside;
  if (blocked && !occupied) return agendaLegend.blocked;
  if (occupied) return agendaLegend.occupied;
  return agendaLegend.free;
}

export const agendaCellHoverFree = "hover:bg-blue-50/80";

const statusCardClass: Record<AppointmentStatus, string> = {
  scheduled: "bg-[#1e40af] text-white",
  confirmed: "bg-[#0d9488] text-white",
  on_site: "bg-[#d97706] text-white",
  cancelled: "bg-[#c41e3a] text-white line-through opacity-90",
  done: "bg-[#15803d] text-white",
};

export function agendaStatusSwatchClass(
  status: "scheduled" | "confirmed" | "on_site" | "cancelled" | "done"
): string {
  const map = {
    scheduled: agendaLegend.scheduled,
    confirmed: agendaLegend.confirmed,
    on_site: agendaLegend.onSite,
    cancelled: agendaLegend.cancelled,
    done: agendaLegend.done,
  } as const;
  return map[status];
}

export function agendaAppointmentClass(appointment: {
  status: AppointmentStatus;
  isSqueezeIn?: boolean;
  isComandaExtra?: boolean;
}): string {
  if (appointment.status === "cancelled") {
    return statusCardClass.cancelled;
  }
  if (appointment.status === "done") {
    return statusCardClass.done;
  }
  if (appointment.isComandaExtra) {
    return "border-2 border-dashed border-neutral-900 bg-neutral-100 text-neutral-900";
  }
  if (appointment.isSqueezeIn) {
    return "border-2 border-dashed border-[#c41e3a] bg-white text-[#9f1239]";
  }
  return statusCardClass[appointment.status];
}
