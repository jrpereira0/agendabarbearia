import type { AppointmentStatus } from "@/lib/appointment-status";

/**
 * Paleta da grade — identidade escura (#0E0F11) + destaque (#ECF15E).
 * Cards: fundo pastel + barra esquerda bem mais escura (mesmo tom).
 */

export const agendaStatusBarColor: Record<
  AppointmentStatus | "squeezeIn" | "comandaExtra",
  string
> = {
  scheduled: "#5c6208",
  confirmed: "#0f4c56",
  cancelled: "#7f1d1d",
  done: "#14532d",
  squeezeIn: "#5c6208",
  comandaExtra: "#3f3f46",
};

export const agendaLegend = {
  free: "border border-white/12 bg-[#0e0f11]",
  outside: "bg-[#1c1d21]",
  blocked: "bg-[#18191c] ring-1 ring-white/10",
  occupied: "bg-[#0e0f11]",
  scheduled: "bg-[#eef2a3]",
  confirmed: "bg-[#c5e4ea]",
  cancelled: "bg-[#f5c6d0]",
  done: "bg-[#c6e2ce]",
  squeezeIn: "border border-dashed border-[#0e0f11]/35 bg-[#eef2a3]",
  comandaExtra: "border border-dashed border-[#52525b]/40 bg-[#e4e4e7]",
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
  scheduled: "bg-[#eef2a3] text-[#0e0f11]",
  confirmed: "bg-[#c5e4ea] text-[#0e0f11]",
  cancelled: "bg-[#f5c6d0] text-[#4c0519] line-through opacity-95",
  done: "bg-[#c6e2ce] text-[#052e16]",
};

export function agendaStatusSwatchClass(
  status: "scheduled" | "confirmed" | "cancelled" | "done"
): string {
  const map = {
    scheduled: agendaLegend.scheduled,
    confirmed: agendaLegend.confirmed,
    cancelled: agendaLegend.cancelled,
    done: agendaLegend.done,
  } as const;
  return map[status];
}

export function agendaStatusBarKey(appointment: {
  status: AppointmentStatus;
  isSqueezeIn?: boolean;
  isComandaExtra?: boolean;
}): keyof typeof agendaStatusBarColor {
  if (appointment.status === "cancelled") return "cancelled";
  if (appointment.status === "done") return "done";
  if (appointment.isComandaExtra) return "comandaExtra";
  if (appointment.isSqueezeIn) return "squeezeIn";
  return appointment.status;
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
    if (appointment.isComandaExtra || appointment.isSqueezeIn) {
      return "border border-dashed border-[#14532d]/40 bg-[#c6e2ce] text-[#052e16]";
    }
    return statusCardClass.done;
  }
  if (appointment.isComandaExtra) {
    return "border border-dashed border-[#52525b]/40 bg-[#e4e4e7] text-[#0e0f11]";
  }
  if (appointment.isSqueezeIn) {
    return "border border-dashed border-[#0e0f11]/35 bg-[#eef2a3] text-[#0e0f11]";
  }
  return statusCardClass[appointment.status];
}
