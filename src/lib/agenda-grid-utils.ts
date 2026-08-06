import {
  minutesToTime,
  timeToMinutes,
  type MinuteRange,
} from "@/lib/availability";

/** Resolução visual da grade — cards acompanham a duração real do serviço. */
export const AGENDA_LAYOUT_STEP_MINUTES = 5;

/** Passo da grade visual (divisor do intervalo de agendamento). */
export function agendaLayoutStepMinutes(slotStepMinutes: number): number {
  if (
    slotStepMinutes > 0 &&
    slotStepMinutes % AGENDA_LAYOUT_STEP_MINUTES === 0
  ) {
    return AGENDA_LAYOUT_STEP_MINUTES;
  }
  return Math.max(1, slotStepMinutes);
}

// Altura de cada linha do intervalo de agendamento (30 min ≈ 27 px).
export function rowHeightForStep(stepMinutes: number): number {
  return Math.max(10, Math.round((24 / 30) * stepMinutes) + 3);
}

/** Altura de cada linha da grade visual, mantendo a altura total do dia. */
export function rowHeightForLayoutStep(
  layoutStepMinutes: number,
  slotStepMinutes: number
): number {
  const slotHeight = rowHeightForStep(slotStepMinutes);
  const rowsPerSlot = Math.max(1, slotStepMinutes / layoutStepMinutes);
  return Math.max(4, Math.round(slotHeight / rowsPerSlot));
}

export function buildTimeSlots(
  gridStart: number,
  gridEnd: number,
  stepMinutes: number
): number[] {
  const slots: number[] = [];
  for (let m = gridStart; m < gridEnd; m += stepMinutes) {
    slots.push(m);
  }
  return slots;
}

/** Posição na grade conforme início/fim reais (sem arredondar pra um slot inteiro). */
export function appointmentGridRows(
  startTime: string,
  endTime: string,
  gridStart: number,
  gridEnd: number,
  stepMinutes: number
): { rowStart: number; rowEnd: number; rowSpan: number } | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (end <= gridStart || start >= gridEnd) return null;

  const clippedStart = Math.max(start, gridStart);
  const clippedEnd = Math.min(end, gridEnd);

  const rowStart = Math.floor((clippedStart - gridStart) / stepMinutes) + 2;
  const rowEnd = Math.max(
    rowStart + 1,
    Math.ceil((clippedEnd - gridStart) / stepMinutes) + 2
  );

  return {
    rowStart,
    rowEnd,
    rowSpan: rowEnd - rowStart,
  };
}

export function isMinuteInRanges(minute: number, ranges: MinuteRange[]): boolean {
  return ranges.some((r) => minute >= r.start && minute < r.end);
}

export function isSlotStartAvailable(
  minute: number,
  stepMinutes: number,
  ranges: MinuteRange[],
  busy: { start: number; end: number }[]
): boolean {
  if (!isMinuteInRanges(minute, ranges)) return false;
  const end = minute + stepMinutes;
  if (!ranges.some((r) => minute >= r.start && end <= r.end)) return false;
  return !busy.some((b) => minute < b.end && end > b.start);
}

export function shouldShowTimeLabel(minute: number, stepMinutes: number): boolean {
  if (stepMinutes >= 15) return true;
  return minute % 30 === 0;
}

/** Partes tipográficas do cabeçalho da agenda. */
export function formatAgendaHeaderParts(isoDate: string): {
  weekday: string;
  dayMonth: string;
} {
  const base = new Date(`${isoDate}T00:00:00`);
  const weekday = base.toLocaleDateString("pt-BR", { weekday: "long" });
  const dayMonth = base.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    dayMonth,
  };
}

export function timeLabel(minute: number): string {
  return minutesToTime(minute);
}

export type OverlapLayout = {
  columnIndex: number;
  columnCount: number;
};

/** Um card visual por serviço (mesmo agendamento pode virar vários cards). */
export type AgendaAppointmentCard = {
  id: string;
  appointment: AppointmentItemLike;
  startTime: string;
  endTime: string;
  serviceIndex: number;
  serviceName: string | null;
  serviceCount: number;
};

type AppointmentItemLike = {
  id: string;
  startTime: string;
  endTime: string;
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
};

export function expandAppointmentsToServiceCards<T extends AppointmentItemLike>(
  appointments: T[]
): (AgendaAppointmentCard & { appointment: T })[] {
  const cards: (AgendaAppointmentCard & { appointment: T })[] = [];

  for (const apt of appointments) {
    const services = apt.services;
    if (services.length <= 1) {
      cards.push({
        id: apt.id,
        appointment: apt,
        startTime: apt.startTime,
        endTime: apt.endTime,
        serviceIndex: 0,
        serviceName: services[0]?.name ?? null,
        serviceCount: Math.max(1, services.length),
      });
      continue;
    }

    let cursor = timeToMinutes(apt.startTime);
    const aptEnd = timeToMinutes(apt.endTime);

    services.forEach((service, index) => {
      const start = cursor;
      const isLast = index === services.length - 1;
      const proposedEnd = start + Math.max(1, service.durationMinutes);
      const end = isLast
        ? Math.max(proposedEnd, aptEnd)
        : Math.min(proposedEnd, aptEnd);
      const safeEnd = Math.max(start + 1, Math.min(end, aptEnd));

      cards.push({
        id: `${apt.id}#${index}`,
        appointment: apt,
        startTime: minutesToTime(start),
        endTime: minutesToTime(safeEnd),
        serviceIndex: index,
        serviceName: service.name,
        serviceCount: services.length,
      });
      cursor = start + Math.max(1, service.durationMinutes);
    });
  }

  return cards;
}

/**
 * Reparte linhas da grade entre serviços do mesmo agendamento, sem sobrepor
 * cards (serviços curtos caíam na mesma linha e pareciam um bloco só).
 */
export function distributePositiveIntegers(
  weights: number[],
  total: number
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = Math.max(total, n);
  const sum = weights.reduce((acc, w) => acc + Math.max(1, w), 0);
  const exact = weights.map((w) => (Math.max(1, w) / sum) * safeTotal);
  const shares = exact.map((value) => Math.floor(value));

  for (let i = 0; i < n; i++) {
    if (shares[i]! < 1) shares[i] = 1;
  }

  let allocated = shares.reduce((acc, value) => acc + value, 0);
  while (allocated > safeTotal) {
    let maxIdx = 0;
    for (let i = 1; i < n; i++) {
      if (shares[i]! > shares[maxIdx]!) maxIdx = i;
    }
    if (shares[maxIdx]! <= 1) break;
    shares[maxIdx]!--;
    allocated--;
  }

  const remainder = safeTotal - allocated;
  const byFraction = exact
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remainder; i++) {
    const target = byFraction[i % n];
    if (!target) break;
    shares[target.index]!++;
  }

  return shares;
}

export function packServiceCardsToGridRows<
  T extends {
    id: string;
    startTime: string;
    endTime: string;
    serviceIndex: number;
    appointment: { id: string; startTime: string; endTime: string };
  },
>(
  cards: T[],
  gridStart: number,
  gridEnd: number,
  stepMinutes: number
): Map<string, { rowStart: number; rowEnd: number; rowSpan: number }> {
  const result = new Map<
    string,
    { rowStart: number; rowEnd: number; rowSpan: number }
  >();
  const byAppointment = new Map<string, T[]>();

  for (const card of cards) {
    const list = byAppointment.get(card.appointment.id) ?? [];
    list.push(card);
    byAppointment.set(card.appointment.id, list);
  }

  for (const aptCards of byAppointment.values()) {
    aptCards.sort((a, b) => a.serviceIndex - b.serviceIndex);

    if (aptCards.length === 1) {
      const only = aptCards[0]!;
      const rows = appointmentGridRows(
        only.startTime,
        only.endTime,
        gridStart,
        gridEnd,
        stepMinutes
      );
      if (rows) result.set(only.id, rows);
      continue;
    }

    const appointment = aptCards[0]!.appointment;
    const full = appointmentGridRows(
      appointment.startTime,
      appointment.endTime,
      gridStart,
      gridEnd,
      stepMinutes
    );
    if (!full) continue;

    const weights = aptCards.map((card) =>
      Math.max(
        1,
        timeToMinutes(card.endTime) - timeToMinutes(card.startTime)
      )
    );
    // Reparte só dentro do horário do agendamento (sem esticar e empurrar o próximo).
    const shares = distributePositiveIntegers(weights, full.rowSpan);

    let cursor = full.rowStart;
    aptCards.forEach((card, index) => {
      const rowSpan = Math.max(1, shares[index] ?? 1);
      result.set(card.id, {
        rowStart: cursor,
        rowEnd: cursor + rowSpan,
        rowSpan,
      });
      cursor += rowSpan;
    });
  }

  return result;
}

/** Divide a coluna quando vários agendamentos se sobrepõem no tempo. */
export function computeOverlapLayouts<T extends { id: string; startTime: string; endTime: string }>(
  appointments: T[]
): Map<string, OverlapLayout> {
  const sorted = [...appointments].sort((a, b) => {
    const diff =
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (diff !== 0) return diff;
    return timeToMinutes(b.endTime) - timeToMinutes(a.endTime);
  });

  const columnEnds: number[] = [];
  const columnIndexById = new Map<string, number>();

  for (const apt of sorted) {
    const start = timeToMinutes(apt.startTime);
    const end = timeToMinutes(apt.endTime);

    let col = columnEnds.findIndex((colEnd) => colEnd <= start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[col] = end;
    }
    columnIndexById.set(apt.id, col);
  }

  const layouts = new Map<string, OverlapLayout>();

  for (const apt of sorted) {
    const start = timeToMinutes(apt.startTime);
    const end = timeToMinutes(apt.endTime);

    const overlapping = sorted.filter((other) => {
      const oStart = timeToMinutes(other.startTime);
      const oEnd = timeToMinutes(other.endTime);
      return start < oEnd && end > oStart;
    });

    const columnCount =
      Math.max(...overlapping.map((o) => columnIndexById.get(o.id)!)) + 1;

    layouts.set(apt.id, {
      columnIndex: columnIndexById.get(apt.id)!,
      columnCount,
    });
  }

  return layouts;
}
