// Busca os dados no banco e calcula os horários livres de um
// profissional numa data, pra um conjunto de serviços.
// Usado pela API pública, pelo site do cliente e pela agenda do admin.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BOOKING_LEAD_MINUTES,
  SLOT_STEP_MINUTES,
  computeSlots,
  minutesToTime,
  nowMinutesInTimezone,
  resolveDayRanges,
  timeToMinutes,
  todayInTimezone,
  weekdayOf,
  type DayException,
  type MinuteRange,
} from "@/lib/availability";

export type AvailabilityOk = {
  ok: true;
  professionalId: string;
  date: string;
  durationMinutes: number;
  totalPriceCents: number;
  slots: string[]; // horários de início: ["09:00", "09:15", ...]
};

export type AvailabilityError = { ok: false; error: string; status: number };

export type AvailabilityResult = AvailabilityOk | AvailabilityError;

const MAX_DAYS_AHEAD = 60;

export type GetAvailabilityOptions = {
  /** Edição no painel: ignora antecedência mínima e limite de data passada. */
  adminEdit?: boolean;
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

export async function getAvailability(
  professionalId: string,
  date: string,
  serviceIds: string[],
  excludeAppointmentId?: string,
  options: GetAvailabilityOptions = {}
): Promise<AvailabilityResult> {
  const { adminEdit = false } = options;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Data inválida. Use o formato AAAA-MM-DD.", status: 400 };
  }
  if (serviceIds.length === 0) {
    return { ok: false, error: "Escolha pelo menos um serviço.", status: 400 };
  }

  const today = todayInTimezone();
  if (!adminEdit && date < today) {
    return { ok: false, error: "Essa data já passou.", status: 400 };
  }

  if (!adminEdit) {
    const maxDate = new Date(`${today}T00:00:00Z`);
    maxDate.setUTCDate(maxDate.getUTCDate() + MAX_DAYS_AHEAD);
    if (date > maxDate.toISOString().slice(0, 10)) {
      return {
        ok: false,
        error: `Só é possível agendar até ${MAX_DAYS_AHEAD} dias pra frente.`,
        status: 400,
      };
    }
  }

  const weekday = weekdayOf(date);
  const admin = createAdminClient();

  const [
    { data: professional },
    { data: services },
    { data: links },
    { data: businessDay },
    { data: workingHours },
    { data: exceptions },
    { data: appointments },
    { data: scheduleBlocks },
    { data: settings },
  ] = await Promise.all([
    admin
      .from("professionals")
      .select("id, active")
      .eq("id", professionalId)
      .maybeSingle(),
    admin
      .from("services")
      .select("id, active, duration_minutes, price_cents")
      .in("id", serviceIds),
    admin
      .from("professional_services")
      .select("service_id")
      .eq("professional_id", professionalId)
      .in("service_id", serviceIds),
    admin
      .from("business_hours")
      .select("active, open_time, close_time")
      .eq("weekday", weekday)
      .maybeSingle(),
    admin
      .from("working_hours")
      .select("start_time, end_time")
      .eq("professional_id", professionalId)
      .eq("weekday", weekday),
    admin
      .from("schedule_exceptions")
      .select("professional_id, kind, start_time, end_time")
      .eq("date", date),
    admin
      .from("appointments")
      .select("id, start_time, end_time")
      .eq("professional_id", professionalId)
      .eq("date", date)
      .eq("status", "confirmed")
      .eq("is_squeeze_in", false),
    admin
      .from("schedule_blocks")
      .select("start_time, end_time")
      .eq("professional_id", professionalId)
      .eq("date", date),
    admin.from("shop_settings").select("slot_step_minutes").single(),
  ]);

  if (!professional || !professional.active) {
    return { ok: false, error: "Profissional não encontrado.", status: 404 };
  }

  const foundServices = services ?? [];
  if (
    foundServices.length !== serviceIds.length ||
    foundServices.some((s) => !s.active)
  ) {
    return { ok: false, error: "Serviço não encontrado.", status: 404 };
  }

  const linkedIds = new Set((links ?? []).map((l) => l.service_id));
  if (!serviceIds.every((id) => linkedIds.has(id))) {
    return {
      ok: false,
      error: "Esse profissional não faz um dos serviços escolhidos.",
      status: 400,
    };
  }

  const durationMinutes = foundServices.reduce(
    (sum, s) => sum + s.duration_minutes,
    0
  );
  const totalPriceCents = foundServices.reduce(
    (sum, s) => sum + s.price_cents,
    0
  );

  const shopException =
    (exceptions ?? []).find((e) => e.professional_id === null) ?? null;
  const professionalException =
    (exceptions ?? []).find((e) => e.professional_id === professionalId) ??
    null;

  const ranges = resolveDayRanges({
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
    weeklyRanges: (workingHours ?? []).map((w) => ({
      start: timeToMinutes(w.start_time),
      end: timeToMinutes(w.end_time),
    })),
    professionalException: professionalException
      ? toDayException(professionalException)
      : null,
  });

  const busy: MinuteRange[] = [
    ...(appointments ?? [])
      .filter((a) => a.id !== excludeAppointmentId)
      .map((a) => ({
        start: timeToMinutes(a.start_time),
        end: timeToMinutes(a.end_time),
      })),
    ...(scheduleBlocks ?? []).map((b) => ({
      start: timeToMinutes(b.start_time),
      end: timeToMinutes(b.end_time),
    })),
  ];

  const stepMinutes = settings?.slot_step_minutes ?? SLOT_STEP_MINUTES;

  // Reserva online: hoje só a partir de agora + antecedência mínima.
  let minStart: number | null = null;
  if (!adminEdit && date === today) {
    const earliest = nowMinutesInTimezone() + BOOKING_LEAD_MINUTES;
    minStart = Math.ceil(earliest / stepMinutes) * stepMinutes;
  }

  const slots = computeSlots({
    ranges,
    busy,
    durationMinutes,
    stepMinutes,
    minStart,
  });

  return {
    ok: true,
    professionalId,
    date,
    durationMinutes,
    totalPriceCents,
    slots: slots.map(minutesToTime),
  };
}

/** Valida horário na edição do painel: só conflito com outro agendamento ou bloqueio. */
export async function validateAdminAppointmentSlot(
  professionalId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  excludeAppointmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;

  if (end > 24 * 60) {
    return {
      ok: false,
      error:
        "O horário de término passa da meia-noite. Escolha um início mais cedo.",
    };
  }

  const admin = createAdminClient();

  const [{ data: appointments }, { data: scheduleBlocks }] = await Promise.all([
    admin
      .from("appointments")
      .select("id, start_time, end_time")
      .eq("professional_id", professionalId)
      .eq("date", date)
      .eq("status", "confirmed")
      .eq("is_squeeze_in", false),
    admin
      .from("schedule_blocks")
      .select("start_time, end_time")
      .eq("professional_id", professionalId)
      .eq("date", date),
  ]);

  for (const appointment of appointments ?? []) {
    if (appointment.id === excludeAppointmentId) continue;
    const aStart = timeToMinutes(appointment.start_time);
    const aEnd = timeToMinutes(appointment.end_time);
    if (start < aEnd && end > aStart) {
      return {
        ok: false,
        error: "Esse horário já está ocupado por outro agendamento.",
      };
    }
  }

  for (const block of scheduleBlocks ?? []) {
    const bStart = timeToMinutes(block.start_time);
    const bEnd = timeToMinutes(block.end_time);
    if (start < bEnd && end > bStart) {
      return {
        ok: false,
        error: "Esse horário está bloqueado na agenda desse barbeiro.",
      };
    }
  }

  return { ok: true };
}
