/** Visual da grade: neutro, alto contraste, sem cores saturadas. */

export const agendaLegend = {
  free: "border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-950",
  outside: "bg-neutral-300 dark:bg-neutral-700",
  blocked:
    "bg-neutral-400/40 [background-image:repeating-linear-gradient(135deg,rgba(0,0,0,0.1)_0,rgba(0,0,0,0.1)_1px,transparent_1px,transparent_7px)] dark:bg-neutral-600/50",
  occupied: "bg-neutral-200 dark:bg-neutral-800",
  confirmed: "bg-neutral-900 dark:bg-neutral-100",
  squeezeIn:
    "border-2 border-dashed border-neutral-900 bg-white dark:border-neutral-200 dark:bg-neutral-900",
  done: "bg-neutral-500 dark:bg-neutral-500",
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
  if (!inSchedule) return "bg-neutral-300 dark:bg-neutral-700";
  if (blocked && !occupied) return agendaLegend.blocked;
  if (occupied) return "bg-neutral-200 dark:bg-neutral-800";
  return "bg-white dark:bg-neutral-950";
}

export const agendaCellHoverFree =
  "hover:bg-neutral-100 dark:hover:bg-neutral-900";

export function agendaAppointmentClass(appointment: {
  status: "confirmed" | "cancelled" | "done";
  isSqueezeIn?: boolean;
}): string {
  if (appointment.status === "done") {
    return "bg-neutral-500 text-white";
  }
  if (appointment.isSqueezeIn) {
    return "border-2 border-dashed border-neutral-900 bg-white text-neutral-900 dark:border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100";
  }
  return "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900";
}
