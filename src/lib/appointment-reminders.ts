import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/appointment-status";
import {
  nowMinutesInTimezone,
  timeToMinutes,
  todayInTimezone,
} from "@/lib/availability";
import { BRAND_NAME } from "@/lib/brand";
import { formatShopAddress, formatTime } from "@/lib/format";
import {
  loadServicePricingContext,
  resolvePriceCentsOrFallback,
} from "@/lib/service-prices-for-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstOrSelf } from "@/lib/notifications/shared";
import { whatsappMatches } from "@/lib/whatsapp";

const LOG_PREFIX = "[appointment-reminder]";
export const REMINDER_TYPE_ONE_HOUR = "one_hour_before";
const REMINDER_LEAD_MS = 60 * 60 * 1000;
const PENDING_RESPONSE_WINDOW_MS = 4 * 60 * 60 * 1000;

export type AppointmentReminderStatus =
  | "pending"
  | "sent"
  | "confirmed"
  | "cancelled"
  | "failed"
  | "expired";

type RawReminderAppointmentRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_whatsapp: string;
  professionals:
    | { id: string; nickname: string; whatsapp: string }
    | { id: string; nickname: string; whatsapp: string }[]
    | null;
  appointment_services:
    | {
        services:
          | { id: string; name: string; price_cents: number }
          | { id: string; name: string; price_cents: number }[]
          | null;
      }[]
    | null;
};

export type AppointmentReminderPayload = {
  id: string;
  appointmentId: string;
  scheduledFor: string;
  appointment: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    totalPriceCents: number;
  };
  customer: {
    firstName: string;
    lastName: string;
    whatsapp: string;
  };
  professional: {
    id: string;
    name: string;
  };
  services: { id: string; name: string; priceCents: number }[];
  shop: {
    name: string;
    address: string;
  };
};

function isAppointmentInFuture(date: string, startTime: string): boolean {
  const today = todayInTimezone();
  const start = formatTime(startTime);
  if (date > today) return true;
  if (date < today) return false;
  return timeToMinutes(start) > nowMinutesInTimezone();
}

/** Converte data + horário da barbearia (America/Sao_Paulo) para instante UTC. */
export function appointmentInstantUtc(
  date: string,
  startTime: string
): Date {
  const time = formatTime(startTime);
  return new Date(`${date}T${time}:00-03:00`);
}

function computeScheduledFor(date: string, startTime: string): Date {
  const startUtc = appointmentInstantUtc(date, startTime);
  const now = new Date();
  const oneHourBefore = new Date(startUtc.getTime() - REMINDER_LEAD_MS);

  if (oneHourBefore < now && startUtc > now) {
    return now;
  }

  return oneHourBefore;
}

async function loadAppointmentForReminder(
  admin: SupabaseClient,
  appointmentId: string
): Promise<RawReminderAppointmentRow | null> {
  const { data, error } = await admin
    .from("appointments")
    .select(
      `
      id,
      date,
      start_time,
      end_time,
      status,
      customer_first_name,
      customer_last_name,
      customer_whatsapp,
      professionals ( id, nickname, whatsapp ),
      appointment_services (
        services ( id, name, price_cents )
      )
    `
    )
    .eq("id", appointmentId)
    .maybeSingle<RawReminderAppointmentRow>();

  if (error || !data) {
    console.warn(
      `${LOG_PREFIX} Agendamento ${appointmentId} não encontrado ao sincronizar lembrete.`
    );
    return null;
  }

  return data;
}

async function buildReminderPayload(
  admin: SupabaseClient,
  reminderId: string,
  scheduledFor: string,
  appointment: RawReminderAppointmentRow
): Promise<AppointmentReminderPayload | null> {
  const professional = firstOrSelf(appointment.professionals);
  if (!professional) return null;

  const rawServices = (appointment.appointment_services ?? [])
    .map((row) => firstOrSelf(row.services))
    .filter(
      (
        service
      ): service is { id: string; name: string; price_cents: number } =>
        service !== null
    );

  const [{ data: shopSettings }, pricingContext] = await Promise.all([
    admin
      .from("shop_settings")
      .select(
        "shop_name, cep, street, address_number, address_complement, neighborhood, city, state, address"
      )
      .eq("id", 1)
      .maybeSingle(),
    loadServicePricingContext(
      admin,
      appointment.date,
      rawServices.map((s) => s.id)
    ),
  ]);

  const services = rawServices.map((service) => ({
    id: service.id,
    name: service.name,
    priceCents: resolvePriceCentsOrFallback(service, pricingContext),
  }));

  const totalPriceCents = services.reduce((sum, s) => sum + s.priceCents, 0);

  const shopName = shopSettings?.shop_name?.trim() || BRAND_NAME;
  const shopAddress =
    formatShopAddress({
      street: shopSettings?.street ?? "",
      addressNumber: shopSettings?.address_number ?? "",
      addressComplement: shopSettings?.address_complement ?? "",
      neighborhood: shopSettings?.neighborhood ?? "",
      city: shopSettings?.city ?? "",
      state: shopSettings?.state ?? "",
    }) ||
    shopSettings?.address?.trim() ||
    "";

  return {
    id: reminderId,
    appointmentId: appointment.id,
    scheduledFor,
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: formatTime(appointment.start_time),
      endTime: formatTime(appointment.end_time),
      totalPriceCents,
    },
    customer: {
      firstName: appointment.customer_first_name,
      lastName: appointment.customer_last_name,
      whatsapp: appointment.customer_whatsapp,
    },
    professional: {
      id: professional.id,
      name: professional.nickname,
    },
    services,
    shop: {
      name: shopName,
      address: shopAddress,
    },
  };
}

function isActiveAppointmentStatus(status: string): boolean {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Garante que exista um lembrete pendente 1h antes do atendimento.
 * Chamar depois de criar ou alterar um agendamento ativo.
 */
export async function upsertAppointmentReminder(
  appointmentId: string
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(`${LOG_PREFIX} Supabase indisponível ao criar lembrete.`);
    return;
  }

  const appointment = await loadAppointmentForReminder(admin, appointmentId);
  if (!appointment) return;

  const startTime = formatTime(appointment.start_time);
  const inFuture = isAppointmentInFuture(appointment.date, startTime);
  const isActive = isActiveAppointmentStatus(appointment.status);

  if (!isActive || !inFuture) {
    await cancelAppointmentReminder(
      appointmentId,
      !isActive ? "appointment_inactive" : "appointment_past"
    );
    return;
  }

  const scheduledFor = computeScheduledFor(appointment.date, startTime);
  const now = new Date().toISOString();

  const { error } = await admin.from("appointment_reminders").upsert(
    {
      appointment_id: appointmentId,
      reminder_type: REMINDER_TYPE_ONE_HOUR,
      scheduled_for: scheduledFor.toISOString(),
      status: "pending",
      sent_at: null,
      confirmed_at: null,
      cancelled_at: null,
      failed_at: null,
      fail_reason: null,
      updated_at: now,
    },
    { onConflict: "appointment_id,reminder_type" }
  );

  if (error) {
    console.warn(
      `${LOG_PREFIX} Não foi possível gravar lembrete do agendamento ${appointmentId}: ${error.message}`
    );
    return;
  }

  console.log(`${LOG_PREFIX} lembrete sincronizado`, {
    appointmentId,
    scheduledFor: scheduledFor.toISOString(),
  });
}

/**
 * Cancela lembrete pendente ou já enviado (aguardando resposta do cliente).
 */
export async function cancelAppointmentReminder(
  appointmentId: string,
  reason: string
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(`${LOG_PREFIX} Supabase indisponível ao cancelar lembrete.`);
    return;
  }

  const now = new Date().toISOString();

  const { error } = await admin
    .from("appointment_reminders")
    .update({
      status: "cancelled",
      cancelled_at: now,
      fail_reason: reason,
      updated_at: now,
    })
    .eq("appointment_id", appointmentId)
    .eq("reminder_type", REMINDER_TYPE_ONE_HOUR)
    .in("status", ["pending", "sent"]);

  if (error) {
    console.warn(
      `${LOG_PREFIX} Não foi possível cancelar lembrete do agendamento ${appointmentId}: ${error.message}`
    );
    return;
  }

  console.log(`${LOG_PREFIX} lembrete cancelado`, { appointmentId, reason });
}

export async function listDueAppointmentReminders(options?: {
  limit?: number;
  now?: Date;
}): Promise<AppointmentReminderPayload[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const nowIso = (options?.now ?? new Date()).toISOString();

  const { data: rows, error } = await admin
    .from("appointment_reminders")
    .select("id, scheduled_for, appointment_id")
    .eq("status", "pending")
    .eq("reminder_type", REMINDER_TYPE_ONE_HOUR)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) return [];

  const results: AppointmentReminderPayload[] = [];

  for (const row of rows) {
    const appointment = await loadAppointmentForReminder(
      admin,
      row.appointment_id
    );
    if (!appointment) continue;

    const startTime = formatTime(appointment.start_time);
    if (
      !isActiveAppointmentStatus(appointment.status) ||
      !isAppointmentInFuture(appointment.date, startTime)
    ) {
      continue;
    }

    const payload = await buildReminderPayload(
      admin,
      row.id,
      row.scheduled_for,
      appointment
    );
    if (payload) results.push(payload);
  }

  return results;
}

export async function findPendingResponseReminder(
  whatsapp: string
): Promise<AppointmentReminderPayload | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const since = new Date(Date.now() - PENDING_RESPONSE_WINDOW_MS).toISOString();

  const { data: rows, error } = await admin
    .from("appointment_reminders")
    .select("id, scheduled_for, sent_at, appointment_id")
    .eq("status", "sent")
    .eq("reminder_type", REMINDER_TYPE_ONE_HOUR)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error || !rows?.length) return null;

  for (const row of rows) {
    const appointment = await loadAppointmentForReminder(
      admin,
      row.appointment_id
    );
    if (!appointment) continue;
    if (!whatsappMatches(appointment.customer_whatsapp, whatsapp)) continue;

    const startTime = formatTime(appointment.start_time);
    if (
      !isActiveAppointmentStatus(appointment.status) ||
      !isAppointmentInFuture(appointment.date, startTime)
    ) {
      continue;
    }

    return buildReminderPayload(
      admin,
      row.id,
      row.scheduled_for,
      appointment
    );
  }

  return null;
}

export async function markAppointmentReminderSent(
  reminderId: string,
  _providerMessageId?: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", status: 503 };
  }

  const { data: existing, error: fetchError } = await admin
    .from("appointment_reminders")
    .select("id, status")
    .eq("id", reminderId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: "Lembrete não encontrado.", status: 404 };
  }

  if (existing.status !== "pending") {
    return {
      ok: false,
      error: "Só é possível marcar como enviado um lembrete pendente.",
      status: 409,
    };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("appointment_reminders")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
    })
    .eq("id", reminderId)
    .eq("status", "pending");

  if (error) {
    return {
      ok: false,
      error: "Não foi possível marcar o lembrete como enviado.",
      status: 500,
    };
  }

  return { ok: true };
}

export async function confirmAppointmentReminder(
  reminderId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", status: 503 };
  }

  const { data: existing, error: fetchError } = await admin
    .from("appointment_reminders")
    .select("id, status, appointment_id")
    .eq("id", reminderId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: "Lembrete não encontrado.", status: 404 };
  }

  if (existing.status !== "sent") {
    return {
      ok: false,
      error: "Só é possível confirmar um lembrete que já foi enviado.",
      status: 409,
    };
  }

  const now = new Date().toISOString();

  const { error } = await admin
    .from("appointment_reminders")
    .update({
      status: "confirmed",
      confirmed_at: now,
      updated_at: now,
    })
    .eq("id", reminderId)
    .eq("status", "sent");

  if (error) {
    return {
      ok: false,
      error: "Não foi possível confirmar o lembrete.",
      status: 500,
    };
  }

  // Marca o agendamento como confirmado se ainda estiver só agendado.
  await admin
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", existing.appointment_id)
    .eq("status", "scheduled");

  return { ok: true };
}
