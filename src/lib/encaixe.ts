import { buildTimeSlots } from "@/lib/agenda-grid-utils";
import { timeToMinutes, type MinuteRange } from "@/lib/availability";

export const ENCAIXE_DAY_START = 0; // 00:00
export const ENCAIXE_DAY_END = 24 * 60; // 24:00 (fim exclusivo)

export function encaixeTimeSlots(slotStepMinutes: number): string[] {
  return buildTimeSlots(ENCAIXE_DAY_START, ENCAIXE_DAY_END, slotStepMinutes).map(
    (m) => {
      const h = String(Math.floor(m / 60)).padStart(2, "0");
      const min = String(m % 60).padStart(2, "0");
      return `${h}:${min}`;
    }
  );
}

export type ConflictAppointment = {
  id?: string;
  customerFirstName: string;
  customerLastName: string;
  startTime: string;
  endTime: string;
  professionalId: string;
  status: string;
};

export function findAppointmentConflicts(
  professionalId: string,
  startTime: string,
  durationMinutes: number,
  appointments: ConflictAppointment[],
  excludeAppointmentId?: string
): ConflictAppointment[] {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;

  return appointments.filter((a) => {
    if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
    if (a.professionalId !== professionalId || a.status !== "confirmed") {
      return false;
    }
    const aStart = timeToMinutes(a.startTime);
    const aEnd = timeToMinutes(a.endTime);
    return start < aEnd && end > aStart;
  });
}

export function isOutsideProfessionalSchedule(
  startTime: string,
  durationMinutes: number,
  availableRanges: MinuteRange[]
): boolean {
  if (availableRanges.length === 0) return true;

  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;

  return !availableRanges.some(
    (r) => start >= r.start && end <= r.end
  );
}
