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

export function timeLabel(minute: number): string {
  return minutesToTime(minute);
}

export type OverlapLayout = {
  columnIndex: number;
  columnCount: number;
};

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
