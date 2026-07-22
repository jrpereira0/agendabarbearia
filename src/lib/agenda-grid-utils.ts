import {
  minutesToTime,
  timeToMinutes,
  type MinuteRange,
} from "@/lib/availability";

// Altura de cada linha escala com o intervalo (30 min ≈ 27 px).
export function rowHeightForStep(stepMinutes: number): number {
  return Math.max(10, Math.round((24 / 30) * stepMinutes) + 3);
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

/** Posição na grade; garante ao menos 1 linha (ex.: serviço de 10 min em grade de 15 min). */
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

  const rowStart = Math.floor((start - gridStart) / stepMinutes) + 2;
  const rowEnd = Math.max(
    rowStart + 1,
    Math.ceil((end - gridStart) / stepMinutes) + 2
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

export function formatAgendaHeaderDate(isoDate: string): string {
  const formatted = new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
