// Motor de cálculo de horários disponíveis.
// Funções puras: recebem dados prontos e devolvem os horários livres,
// sem tocar no banco. Quem busca os dados é o get-availability.ts.

export const SLOT_STEP_MINUTES = 15;
export const BOOKING_LEAD_MINUTES = 10; // antecedência mínima pra agendar hoje
export const TIMEZONE = "America/Sao_Paulo";

export type MinuteRange = { start: number; end: number };

// "09:30" ou "09:30:00" -> 570
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// 570 -> "09:30"
export function minutesToTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function intersectRanges(
  a: MinuteRange,
  b: MinuteRange
): MinuteRange | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

export type DayException = {
  kind: "closed" | "custom";
  range: MinuteRange | null; // preenchido quando kind = custom
};

type ResolveParams = {
  businessDay: { active: boolean; range: MinuteRange } | null;
  shopException: DayException | null;
  weeklyRanges: MinuteRange[];
  professionalException: DayException | null;
};

// Resolve as faixas reais de atendimento do profissional num dia:
// (horário da barbearia ∩ grade do barbeiro), com exceções vencendo.
export function resolveDayRanges({
  businessDay,
  shopException,
  weeklyRanges,
  professionalException,
}: ResolveParams): MinuteRange[] {
  let shopWindow: MinuteRange | null;
  if (shopException) {
    shopWindow = shopException.kind === "closed" ? null : shopException.range;
  } else {
    shopWindow = businessDay?.active ? businessDay.range : null;
  }
  if (!shopWindow) return [];

  let professionalRanges: MinuteRange[];
  if (professionalException) {
    professionalRanges =
      professionalException.kind === "closed" || !professionalException.range
        ? []
        : [professionalException.range];
  } else {
    professionalRanges = weeklyRanges;
  }

  return professionalRanges
    .map((r) => intersectRanges(r, shopWindow))
    .filter((r): r is MinuteRange => r !== null);
}

type ComputeParams = {
  ranges: MinuteRange[];
  busy: MinuteRange[];
  durationMinutes: number;
  stepMinutes?: number;
  minStart?: number | null; // pra hoje: não oferecer horário que já passou
};

// Gera os horários de início possíveis (em minutos desde 00:00).
export function computeSlots({
  ranges,
  busy,
  durationMinutes,
  stepMinutes = SLOT_STEP_MINUTES,
  minStart = null,
}: ComputeParams): number[] {
  const slots: number[] = [];

  for (const range of ranges) {
    for (
      let start = range.start;
      start + durationMinutes <= range.end;
      start += stepMinutes
    ) {
      if (minStart !== null && start < minStart) continue;

      const end = start + durationMinutes;
      const conflict = busy.some((b) => start < b.end && end > b.start);
      if (!conflict) slots.push(start);
    }
  }

  return slots.sort((a, b) => a - b);
}

// Data de hoje (YYYY-MM-DD) no fuso da barbearia
export function todayInTimezone(timeZone = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Minutos desde 00:00 de agora, no fuso da barbearia
export function nowMinutesInTimezone(timeZone = TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return timeToMinutes(parts);
}

// Dia da semana (0 = domingo) de uma data YYYY-MM-DD
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
