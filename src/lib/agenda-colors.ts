import type { AppointmentStatus } from "@/lib/appointment-status";

/**
 * Paleta da grade — identidade escura.
 * Fora do expediente: cinza. Em funcionamento: preto.
 * Agendado: verde do sistema.
 */

export const agendaLegend = {
  /** Horário disponível (barbearia aberta) */
  free: "border border-white/10 bg-[#0e0f11]",
  /** Fora do expediente */
  outside: "bg-[#1c1d21]",
  /** Bloqueio manual — mesmo tom do fora do expediente */
  blocked: "bg-[#1c1d21]",
  occupied: "bg-[#0e0f11]",
  /** Ainda não confirmado — cor de destaque da marca */
  scheduled: "bg-[#ecf15e]",
  /** Cliente confirmou */
  confirmed: "bg-[#0891b2]",
  /** Cliente chegou */
  onSite: "bg-[#ea580c]",
  /** Cancelado */
  cancelled: "bg-[#dc2626]",
  /** Atendido / finalizado */
  done: "bg-[#15803d]",
  /** Encaixe — destaque da marca */
  squeezeIn: "border-2 border-dashed border-[#0e0f11] bg-[#ecf15e]",
  /** Serviço extra na comanda */
  comandaExtra: "border-2 border-dashed border-[#ecf15e] bg-[#f4f4f5]",
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

export const agendaCellHoverFree =
  "hover:bg-[rgb(236_241_94_/_18%)] hover:ring-2 hover:ring-inset hover:ring-[#ecf15e]";

const statusCardClass: Record<AppointmentStatus, string> = {
  scheduled: "bg-[#ecf15e] text-[#0e0f11] ring-1 ring-black/10",
  confirmed: "bg-[#0891b2] text-white ring-1 ring-white/20",
  on_site: "bg-[#ea580c] text-white ring-1 ring-black/15",
  cancelled:
    "bg-[#dc2626] text-white line-through opacity-95 ring-1 ring-white/15",
  done: "bg-[#15803d] text-white ring-1 ring-white/20",
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
    if (appointment.isComandaExtra) {
      return "border-2 border-dashed border-[#ecf15e] bg-[#15803d] text-white";
    }
    if (appointment.isSqueezeIn) {
      return "border-2 border-dashed border-[#ecf15e] bg-[#15803d] text-white";
    }
    return statusCardClass.done;
  }
  if (appointment.isComandaExtra) {
    return "border-2 border-dashed border-[#0e0f11] bg-[#f4f4f5] text-[#0e0f11]";
  }
  if (appointment.isSqueezeIn) {
    return "border-2 border-dashed border-[#0e0f11] bg-[#ecf15e] text-[#0e0f11]";
  }
  return statusCardClass[appointment.status];
}
