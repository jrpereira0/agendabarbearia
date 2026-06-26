import { timeToMinutes } from "@/lib/availability";

export type TimeOfDayPeriod = "madrugada" | "manha" | "tarde" | "noite";

export const TIME_PERIOD_LABELS: Record<TimeOfDayPeriod, string> = {
  madrugada: "Madrugada",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const TIME_PERIOD_ORDER: TimeOfDayPeriod[] = [
  "madrugada",
  "manha",
  "tarde",
  "noite",
];

export function timeSlotPeriod(slot: string): TimeOfDayPeriod {
  const hour = Math.floor(timeToMinutes(slot) / 60);
  if (hour < 6) return "madrugada";
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

export type TimeSlotPeriodGroup = {
  period: TimeOfDayPeriod;
  label: string;
  slots: string[];
};

export function groupTimeSlotsByPeriod(slots: string[]): TimeSlotPeriodGroup[] {
  const buckets = new Map<TimeOfDayPeriod, string[]>();

  for (const slot of slots) {
    const period = timeSlotPeriod(slot);
    const list = buckets.get(period) ?? [];
    list.push(slot);
    buckets.set(period, list);
  }

  return TIME_PERIOD_ORDER.filter((period) => buckets.has(period)).map(
    (period) => ({
      period,
      label: TIME_PERIOD_LABELS[period],
      slots: buckets.get(period)!,
    })
  );
}
