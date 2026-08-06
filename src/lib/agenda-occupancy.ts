import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clippedMinutesInRanges,
  resolveDayRanges,
  subtractRanges,
  sumRangeMinutes,
  timeToMinutes,
  weekdayOf,
  type DayException,
  type MinuteRange,
} from "@/lib/availability";
import { inclusiveDayCount, shiftDate } from "@/lib/date-range";

export type OccupancyByProfessionalRow = {
  professionalId: string;
  professionalNickname: string;
  availableMinutes: number;
  occupiedMinutes: number;
  ratePercent: number;
};

export type OccupancyByDayRow = {
  date: string;
  availableMinutes: number;
  occupiedMinutes: number;
  ratePercent: number;
};

export type AgendaOccupancyReport = {
  from: string;
  to: string;
  availableMinutes: number;
  occupiedMinutes: number;
  ratePercent: number;
  previousRatePercent: number | null;
  /** Variação em pontos percentuais vs. o período anterior equivalente. */
  ratePointsChange: number | null;
  byProfessional: OccupancyByProfessionalRow[];
  byDay: OccupancyByDayRow[];
};

type BusinessHourRow = {
  weekday: number;
  active: boolean;
  open_time: string;
  close_time: string;
};

type WorkingHourRow = {
  professional_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type ExceptionRow = {
  date: string;
  professional_id: string | null;
  kind: string;
  start_time: string | null;
  end_time: string | null;
};

type BlockRow = {
  date: string;
  professional_id: string;
  start_time: string;
  end_time: string;
};

type AppointmentRow = {
  date: string;
  professional_id: string;
  start_time: string;
  end_time: string;
  status: string;
  is_squeeze_in: boolean | null;
};

function toDayException(e: {
  kind: string;
  start_time: string | null;
  end_time: string | null;
}): DayException {
  return {
    kind: e.kind as "closed" | "custom",
    range:
      e.kind === "custom" && e.start_time && e.end_time
        ? {
            start: timeToMinutes(e.start_time),
            end: timeToMinutes(e.end_time),
          }
        : null,
  };
}

function ratePercentOf(occupied: number, available: number): number {
  if (available <= 0) return 0;
  return Math.round((occupied / available) * 100);
}

function listDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return dates;
}

function formatHoursLabel(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`.replace(".", ",");
}

/** Ex.: 150 → "2,5h" para UI. */
export function formatOccupancyHours(minutes: number): string {
  return formatHoursLabel(minutes);
}

async function buildOccupancyForRange(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<{
  availableMinutes: number;
  occupiedMinutes: number;
  ratePercent: number;
  byProfessional: OccupancyByProfessionalRow[];
  byDay: OccupancyByDayRow[];
}> {
  const { data: professionals } = await admin
    .from("professionals")
    .select("id, nickname")
    .eq("active", true)
    .order("nickname");

  const pros = professionals ?? [];
  if (pros.length === 0) {
    return {
      availableMinutes: 0,
      occupiedMinutes: 0,
      ratePercent: 0,
      byProfessional: [],
      byDay: [],
    };
  }

  const professionalIds = pros.map((pro) => pro.id);
  const nicknameById = new Map(pros.map((pro) => [pro.id, pro.nickname]));

  const [
    { data: businessHours },
    { data: workingHours },
    { data: exceptions },
    { data: blocks },
    { data: appointments },
  ] = await Promise.all([
    admin
      .from("business_hours")
      .select("weekday, active, open_time, close_time"),
    admin
      .from("working_hours")
      .select("professional_id, weekday, start_time, end_time")
      .in("professional_id", professionalIds),
    admin
      .from("schedule_exceptions")
      .select("date, professional_id, kind, start_time, end_time")
      .gte("date", from)
      .lte("date", to),
    admin
      .from("schedule_blocks")
      .select("date, professional_id, start_time, end_time")
      .gte("date", from)
      .lte("date", to)
      .in("professional_id", professionalIds),
    admin
      .from("appointments")
      .select(
        "date, professional_id, start_time, end_time, status, is_squeeze_in"
      )
      .gte("date", from)
      .lte("date", to)
      .in("professional_id", professionalIds)
      .in("status", ["scheduled", "confirmed", "done"])
      .eq("is_squeeze_in", false),
  ]);

  const businessByWeekday = new Map<number, BusinessHourRow>();
  for (const row of (businessHours ?? []) as BusinessHourRow[]) {
    businessByWeekday.set(row.weekday, row);
  }

  const weeklyByProWeekday = new Map<string, MinuteRange[]>();
  for (const row of (workingHours ?? []) as WorkingHourRow[]) {
    const key = `${row.professional_id}:${row.weekday}`;
    const ranges = weeklyByProWeekday.get(key) ?? [];
    ranges.push({
      start: timeToMinutes(row.start_time),
      end: timeToMinutes(row.end_time),
    });
    weeklyByProWeekday.set(key, ranges);
  }

  const shopExceptionByDate = new Map<string, ExceptionRow>();
  const proExceptionByKey = new Map<string, ExceptionRow>();
  for (const row of (exceptions ?? []) as ExceptionRow[]) {
    if (row.professional_id === null) {
      shopExceptionByDate.set(row.date, row);
    } else {
      proExceptionByKey.set(`${row.professional_id}:${row.date}`, row);
    }
  }

  const blocksByKey = new Map<string, MinuteRange[]>();
  for (const row of (blocks ?? []) as BlockRow[]) {
    const key = `${row.professional_id}:${row.date}`;
    const ranges = blocksByKey.get(key) ?? [];
    ranges.push({
      start: timeToMinutes(row.start_time),
      end: timeToMinutes(row.end_time),
    });
    blocksByKey.set(key, ranges);
  }

  const appointmentsByKey = new Map<string, MinuteRange[]>();
  for (const row of (appointments ?? []) as AppointmentRow[]) {
    const key = `${row.professional_id}:${row.date}`;
    const ranges = appointmentsByKey.get(key) ?? [];
    ranges.push({
      start: timeToMinutes(row.start_time),
      end: timeToMinutes(row.end_time),
    });
    appointmentsByKey.set(key, ranges);
  }

  const proTotals = new Map<
    string,
    { availableMinutes: number; occupiedMinutes: number }
  >();
  for (const pro of pros) {
    proTotals.set(pro.id, { availableMinutes: 0, occupiedMinutes: 0 });
  }

  const dayTotals = new Map<
    string,
    { availableMinutes: number; occupiedMinutes: number }
  >();

  let availableMinutes = 0;
  let occupiedMinutes = 0;

  for (const date of listDatesInRange(from, to)) {
    const weekday = weekdayOf(date);
    const businessDay = businessByWeekday.get(weekday) ?? null;
    const shopExceptionRow = shopExceptionByDate.get(date) ?? null;
    const shopException = shopExceptionRow
      ? toDayException(shopExceptionRow)
      : null;

    let dayAvailable = 0;
    let dayOccupied = 0;

    for (const pro of pros) {
      const weeklyRanges =
        weeklyByProWeekday.get(`${pro.id}:${weekday}`) ?? [];
      const proExceptionRow = proExceptionByKey.get(`${pro.id}:${date}`) ?? null;
      const capacity = resolveDayRanges({
        businessDay: businessDay
          ? {
              active: businessDay.active,
              range: {
                start: timeToMinutes(businessDay.open_time),
                end: timeToMinutes(businessDay.close_time),
              },
            }
          : null,
        shopException,
        weeklyRanges,
        professionalException: proExceptionRow
          ? toDayException(proExceptionRow)
          : null,
      });

      const bookable = subtractRanges(
        capacity,
        blocksByKey.get(`${pro.id}:${date}`) ?? []
      );
      const available = sumRangeMinutes(bookable);
      let occupied = 0;
      for (const apt of appointmentsByKey.get(`${pro.id}:${date}`) ?? []) {
        occupied += clippedMinutesInRanges(apt, bookable);
      }

      availableMinutes += available;
      occupiedMinutes += occupied;
      dayAvailable += available;
      dayOccupied += occupied;

      const proEntry = proTotals.get(pro.id)!;
      proEntry.availableMinutes += available;
      proEntry.occupiedMinutes += occupied;
    }

    dayTotals.set(date, {
      availableMinutes: dayAvailable,
      occupiedMinutes: dayOccupied,
    });
  }

  const byProfessional: OccupancyByProfessionalRow[] = [...proTotals.entries()]
    .map(([professionalId, entry]) => ({
      professionalId,
      professionalNickname: nicknameById.get(professionalId) ?? "—",
      availableMinutes: entry.availableMinutes,
      occupiedMinutes: entry.occupiedMinutes,
      ratePercent: ratePercentOf(
        entry.occupiedMinutes,
        entry.availableMinutes
      ),
    }))
    .filter((row) => row.availableMinutes > 0)
    .sort((a, b) => b.ratePercent - a.ratePercent);

  const byDay: OccupancyByDayRow[] = [...dayTotals.entries()]
    .map(([date, entry]) => ({
      date,
      availableMinutes: entry.availableMinutes,
      occupiedMinutes: entry.occupiedMinutes,
      ratePercent: ratePercentOf(
        entry.occupiedMinutes,
        entry.availableMinutes
      ),
    }))
    .filter((row) => row.availableMinutes > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    availableMinutes,
    occupiedMinutes,
    ratePercent: ratePercentOf(occupiedMinutes, availableMinutes),
    byProfessional,
    byDay,
  };
}

/** % da grade preenchida no período (minutos ocupados ÷ minutos disponíveis). */
export async function getAgendaOccupancyReport(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<AgendaOccupancyReport> {
  const current = await buildOccupancyForRange(admin, from, to);

  let previousRatePercent: number | null = null;
  let ratePointsChange: number | null = null;
  const periodDayCount = inclusiveDayCount(from, to);
  const previousTo = shiftDate(from, -1);
  const previousFrom = shiftDate(previousTo, -(periodDayCount - 1));

  if (previousFrom <= previousTo) {
    const previous = await buildOccupancyForRange(
      admin,
      previousFrom,
      previousTo
    );
    if (previous.availableMinutes > 0) {
      previousRatePercent = previous.ratePercent;
      ratePointsChange = current.ratePercent - previous.ratePercent;
    }
  }

  return {
    from,
    to,
    availableMinutes: current.availableMinutes,
    occupiedMinutes: current.occupiedMinutes,
    ratePercent: current.ratePercent,
    previousRatePercent,
    ratePointsChange,
    byProfessional: current.byProfessional,
    byDay: current.byDay,
  };
}
