import { createAdminClient } from "@/lib/supabase/admin";
import { formatTime } from "@/lib/format";
import {
  resolveDayRanges,
  SLOT_STEP_MINUTES,
  timeToMinutes,
  weekdayOf,
  type DayException,
  type MinuteRange,
} from "@/lib/availability";
import { ENCAIXE_DAY_END, ENCAIXE_DAY_START } from "@/lib/encaixe";

export type AgendaProfessionalColumn = {
  id: string;
  nickname: string;
  photoUrl: string | null;
  serviceIds: string[];
  availableRanges: MinuteRange[];
  blockRanges: MinuteRange[];
};

export type ScheduleBlockItem = {
  id: string;
  professionalId: string;
  professionalNickname: string;
  startTime: string;
  endTime: string;
  note: string;
};

export type AgendaDayContext = {
  gridStart: number;
  gridEnd: number;
  slotStepMinutes: number;
  shopClosed: boolean;
  scheduleBlocks: ScheduleBlockItem[];
  professionals: AgendaProfessionalColumn[];
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

function roundDown(minutes: number, step: number): number {
  return Math.floor(minutes / step) * step;
}

function roundUp(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

export async function getAgendaDayContext(
  date: string,
  professionalIds: string[]
): Promise<AgendaDayContext> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      gridStart: ENCAIXE_DAY_START,
      gridEnd: ENCAIXE_DAY_END,
      slotStepMinutes: SLOT_STEP_MINUTES,
      shopClosed: false,
      scheduleBlocks: [],
      professionals: [],
    };
  }

  const { data: settings } = await admin
    .from("shop_settings")
    .select("slot_step_minutes")
    .single();

  const slotStepMinutes = settings?.slot_step_minutes ?? SLOT_STEP_MINUTES;

  if (professionalIds.length === 0) {
    return {
      gridStart: ENCAIXE_DAY_START,
      gridEnd: ENCAIXE_DAY_END,
      slotStepMinutes,
      shopClosed: false,
      scheduleBlocks: [],
      professionals: [],
    };
  }

  const weekday = weekdayOf(date);

  const [
    { data: businessDay },
    { data: exceptions },
    { data: workingHours },
    { data: professionals },
    { data: rawBlocks },
  ] = await Promise.all([
    admin
      .from("business_hours")
      .select("active, open_time, close_time")
      .eq("weekday", weekday)
      .maybeSingle(),
    admin
      .from("schedule_exceptions")
      .select("professional_id, kind, start_time, end_time")
      .eq("date", date),
    admin
      .from("working_hours")
      .select("professional_id, start_time, end_time")
      .eq("weekday", weekday),
    admin
      .from("professionals")
      .select("id, nickname, photo_url, professional_services(service_id)")
      .in("id", professionalIds)
      .order("nickname"),
    admin
      .from("schedule_blocks")
      .select(
        "id, professional_id, start_time, end_time, note, professionals ( nickname )"
      )
      .eq("date", date)
      .in("professional_id", professionalIds)
      .order("start_time"),
  ]);

  const scheduleBlocks: ScheduleBlockItem[] = (rawBlocks ?? []).map((b) => {
    const rawPro = b.professionals as
      | { nickname: string }
      | { nickname: string }[]
      | null;
    const nickname = Array.isArray(rawPro)
      ? rawPro[0]?.nickname
      : rawPro?.nickname;

    return {
    id: b.id,
    professionalId: b.professional_id,
    professionalNickname: nickname ?? "—",
    startTime: formatTime(b.start_time),
    endTime: formatTime(b.end_time),
    note: b.note,
  };
  });

  const blocksByProfessional = new Map<string, MinuteRange[]>();
  for (const block of rawBlocks ?? []) {
    const ranges = blocksByProfessional.get(block.professional_id) ?? [];
    ranges.push({
      start: timeToMinutes(block.start_time),
      end: timeToMinutes(block.end_time),
    });
    blocksByProfessional.set(block.professional_id, ranges);
  }

  const shopException =
    (exceptions ?? []).find((e) => e.professional_id === null) ?? null;

  const shopWindow: MinuteRange | null = shopException
    ? shopException.kind === "closed"
      ? null
      : shopException.start_time && shopException.end_time
        ? {
            start: timeToMinutes(shopException.start_time),
            end: timeToMinutes(shopException.end_time),
          }
        : null
    : businessDay?.active
      ? {
          start: timeToMinutes(businessDay.open_time),
          end: timeToMinutes(businessDay.close_time),
        }
      : null;

  const shopClosed = !shopWindow;

  const columns: AgendaProfessionalColumn[] = (professionals ?? []).map((pro) => {
    const proException =
      (exceptions ?? []).find((e) => e.professional_id === pro.id) ?? null;

    const weeklyRanges = (workingHours ?? [])
      .filter((wh) => wh.professional_id === pro.id)
      .map((wh) => ({
        start: timeToMinutes(wh.start_time),
        end: timeToMinutes(wh.end_time),
      }));

    const availableRanges = resolveDayRanges({
      businessDay: businessDay
        ? {
            active: businessDay.active,
            range: {
              start: timeToMinutes(businessDay.open_time),
              end: timeToMinutes(businessDay.close_time),
            },
          }
        : null,
      shopException: shopException ? toDayException(shopException) : null,
      weeklyRanges,
      professionalException: proException ? toDayException(proException) : null,
    });

    return {
      id: pro.id,
      nickname: pro.nickname,
      photoUrl: pro.photo_url,
      serviceIds: (pro.professional_services ?? []).map((ps) => ps.service_id),
      availableRanges,
      blockRanges: blocksByProfessional.get(pro.id) ?? [],
    };
  });

  let gridStart = ENCAIXE_DAY_START;
  let gridEnd = ENCAIXE_DAY_END;

  gridStart = roundDown(gridStart, slotStepMinutes);
  gridEnd = roundUp(gridEnd, slotStepMinutes);

  if (gridEnd <= gridStart) {
    gridStart = ENCAIXE_DAY_START;
    gridEnd = ENCAIXE_DAY_END;
  }

  return {
    gridStart,
    gridEnd,
    slotStepMinutes,
    shopClosed,
    scheduleBlocks,
    professionals: columns,
  };
}

export function blockedRanges(
  window: MinuteRange,
  available: MinuteRange[]
): MinuteRange[] {
  if (available.length === 0) return [window];

  const sorted = [...available].sort((a, b) => a.start - b.start);
  const blocked: MinuteRange[] = [];
  let cursor = window.start;

  for (const slot of sorted) {
    if (slot.start > cursor) {
      blocked.push({
        start: cursor,
        end: Math.min(slot.start, window.end),
      });
    }
    cursor = Math.max(cursor, slot.end);
  }

  if (cursor < window.end) {
    blocked.push({ start: cursor, end: window.end });
  }

  return blocked.filter((r) => r.start < r.end);
}

export function appointmentOverlapsMinute(
  startTime: string,
  endTime: string,
  minute: number
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return minute >= start && minute < end;
}
