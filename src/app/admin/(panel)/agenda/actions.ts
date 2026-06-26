"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminClient, systemUnavailable } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { minutesToTime, nowMinutesInTimezone, timeToMinutes, todayInTimezone } from "@/lib/availability";
import { formatTime } from "@/lib/format";
import {
  getAvailability,
  validateAdminAppointmentSlot,
} from "@/lib/get-availability";
import { requireAdmin, type AdminSession } from "@/lib/require-admin";
import type { ActionResult } from "@/lib/require-owner";
import { upsertCustomer } from "@/lib/upsert-customer";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
} from "@/lib/whatsapp";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from "@/lib/appointment-status";

const createSchema = z.object({
  professionalId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceIds: z.array(z.uuid()).min(1, "Escolha pelo menos um serviço."),
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  whatsapp: z
    .string()
    .regex(/^55\d{10,11}$/, WHATSAPP_INVALID_MESSAGE),
});

const OCCUPIED_SLOT_MESSAGE =
  "Esse horário já está ocupado. Use encaixe ou serviço extra na comanda.";

function rejectPastBookingForBarber(
  session: AdminSession,
  date: string,
  startTime: string
): ActionResult | null {
  if (session.isOwner) return null;

  const today = todayInTimezone();
  if (date < today) {
    return {
      ok: false,
      error: "Só o dono pode agendar em datas passadas.",
    };
  }

  if (date === today && timeToMinutes(startTime) < nowMinutesInTimezone()) {
    return {
      ok: false,
      error: "Só o dono pode agendar em horários que já passaram.",
    };
  }

  return null;
}

async function assertCanManageAppointment(
  appointmentId: string,
  session: Awaited<ReturnType<typeof requireAdmin>>,
  allowedStatuses: AppointmentStatus[] = [...ACTIVE_APPOINTMENT_STATUSES]
): Promise<ActionResult | { professionalId: string }> {
  if (!("userId" in session)) return session;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { data: appointment } = await admin
    .from("appointments")
    .select("professional_id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { ok: false, error: "Agendamento não encontrado." };
  }

  if (
    !session.isOwner &&
    appointment.professional_id !== session.professionalId
  ) {
    return { ok: false, error: "Você não pode alterar este agendamento." };
  }

  if (
    !allowedStatuses.includes(
      appointment.status as (typeof allowedStatuses)[number]
    )
  ) {
    if (appointment.status === "done") {
      return { ok: false, error: "Este agendamento já foi atendido." };
    }
    if (appointment.status === "cancelled") {
      return { ok: false, error: "Agendamento cancelado não pode ser alterado." };
    }
    return { ok: false, error: "Este agendamento não pode ser alterado agora." };
  }

  return { professionalId: appointment.professional_id };
}

async function assertOwnsAppointment(
  appointmentId: string,
  session: Awaited<ReturnType<typeof requireAdmin>>
): Promise<ActionResult | { professionalId: string; status: string; isSqueezeIn: boolean; date: string; startTime: string; serviceIds: string[] }> {
  if (!("userId" in session)) return session;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { data: appointment } = await admin
    .from("appointments")
    .select(
      `
      professional_id,
      status,
      is_squeeze_in,
      date,
      start_time,
      appointment_services ( service_id )
    `
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { ok: false, error: "Agendamento não encontrado." };
  }

  if (
    !session.isOwner &&
    appointment.professional_id !== session.professionalId
  ) {
    return { ok: false, error: "Você não pode alterar este agendamento." };
  }

  return {
    professionalId: appointment.professional_id,
    status: appointment.status,
    isSqueezeIn: appointment.is_squeeze_in,
    date: appointment.date,
    startTime: formatTime(appointment.start_time),
    serviceIds: (appointment.appointment_services ?? []).map(
      (row) => row.service_id
    ),
  };
}

async function insertAppointment(
  data: z.infer<typeof createSchema>,
  durationMinutes: number,
  isSqueezeIn: boolean
): Promise<ActionResult> {
  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const startMinutes = timeToMinutes(data.startTime);
  const endMinutes = startMinutes + durationMinutes;

  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error: "O horário de término passa da meia-noite. Escolha um início mais cedo.",
    };
  }

  const endTime = minutesToTime(endMinutes);

  const customer = await upsertCustomer({
    firstName: data.firstName,
    lastName: data.lastName,
    whatsapp: data.whatsapp,
  });

  if (!customer.ok) {
    return { ok: false, error: customer.error };
  }

  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      professional_id: data.professionalId,
      customer_id: customer.customerId,
      customer_first_name: customer.firstName,
      customer_last_name: customer.lastName,
      customer_whatsapp: data.whatsapp,
      date: data.date,
      start_time: data.startTime,
      end_time: endTime,
      status: "scheduled",
      is_squeeze_in: isSqueezeIn,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return {
        ok: false,
        error: "Esse horário já está ocupado.",
      };
    }
    return { ok: false, error: "Não foi possível criar o agendamento." };
  }

  const { error: linkError } = await admin.from("appointment_services").insert(
    data.serviceIds.map((serviceId) => ({
      appointment_id: appointment.id,
      service_id: serviceId,
    }))
  );

  if (linkError) {
    await admin.from("appointments").delete().eq("id", appointment.id);
    return { ok: false, error: "Não foi possível salvar os serviços." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

async function validateCreateInput(
  input: z.infer<typeof createSchema>,
  session: AdminSession
): Promise<ActionResult | { durationMinutes: number }> {
  if (
    !session.isOwner &&
    input.professionalId !== session.professionalId
  ) {
    return { ok: false, error: "Você só pode agendar na sua própria agenda." };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const [{ data: professional }, { data: foundServices }, { data: links }] =
    await Promise.all([
      admin
        .from("professionals")
        .select("id, active")
        .eq("id", input.professionalId)
        .maybeSingle(),
      admin
        .from("services")
        .select("id, active, duration_minutes")
        .in("id", input.serviceIds),
      admin
        .from("professional_services")
        .select("service_id")
        .eq("professional_id", input.professionalId)
        .in("service_id", input.serviceIds),
    ]);

  if (!professional?.active) {
    return { ok: false, error: "Profissional não encontrado." };
  }

  if (!foundServices || foundServices.length !== input.serviceIds.length) {
    return { ok: false, error: "Serviço não encontrado." };
  }

  if (foundServices.some((s) => !s.active)) {
    return { ok: false, error: "Serviço não encontrado." };
  }

  const linkedIds = new Set((links ?? []).map((l) => l.service_id));
  if (!input.serviceIds.every((id) => linkedIds.has(id))) {
    return {
      ok: false,
      error: "Esse profissional não faz um dos serviços escolhidos.",
    };
  }

  const durationMinutes = foundServices.reduce(
    (sum, s) => sum + s.duration_minutes,
    0
  );

  return { durationMinutes };
}

export async function createNormalAppointment(input: {
  professionalId: string;
  date: string;
  startTime: string;
  serviceIds: string[];
  firstName: string;
  lastName: string;
  whatsapp: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) {
    return { ok: false, error: WHATSAPP_INVALID_MESSAGE };
  }

  const parsed = createSchema.safeParse({
    ...input,
    whatsapp,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const validated = await validateCreateInput(parsed.data, session);
  if (!("durationMinutes" in validated)) return validated;

  const pastError = rejectPastBookingForBarber(
    session,
    parsed.data.date,
    parsed.data.startTime
  );
  if (pastError) return pastError;

  if (session.isOwner) {
    const slotCheck = await validateAdminAppointmentSlot(
      parsed.data.professionalId,
      parsed.data.date,
      parsed.data.startTime,
      validated.durationMinutes,
      "",
      { skipScheduleBlocks: true }
    );

    if (!slotCheck.ok) {
      return { ok: false, error: OCCUPIED_SLOT_MESSAGE };
    }

    return insertAppointment(parsed.data, validated.durationMinutes, false);
  }

  const availability = await getAvailability(
    parsed.data.professionalId,
    parsed.data.date,
    parsed.data.serviceIds
  );

  if (!availability.ok) {
    return { ok: false, error: availability.error };
  }

  if (!availability.slots.includes(parsed.data.startTime)) {
    return { ok: false, error: "Esse horário não está mais disponível." };
  }

  return insertAppointment(
    parsed.data,
    validated.durationMinutes,
    false
  );
}

// Encaixe manual: ignora horários livres e pode sobrepor outros agendamentos.
export async function createSqueezeInAppointment(input: {
  professionalId: string;
  date: string;
  startTime: string;
  serviceIds: string[];
  firstName: string;
  lastName: string;
  whatsapp: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) {
    return { ok: false, error: WHATSAPP_INVALID_MESSAGE };
  }

  const parsed = createSchema.safeParse({
    ...input,
    whatsapp,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const validated = await validateCreateInput(parsed.data, session);
  if (!("durationMinutes" in validated)) return validated;

  const pastError = rejectPastBookingForBarber(
    session,
    parsed.data.date,
    parsed.data.startTime
  );
  if (pastError) return pastError;

  return insertAppointment(parsed.data, validated.durationMinutes, true);
}

const updateSchema = z.object({
  appointmentId: z.uuid(),
  professionalId: z.uuid(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceIds: z.array(z.uuid()).min(1, "Escolha pelo menos um serviço."),
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  whatsapp: z
    .string()
    .regex(/^55\d{10,11}$/, WHATSAPP_INVALID_MESSAGE),
});

export async function updateAppointment(input: {
  appointmentId: string;
  professionalId: string;
  startTime: string;
  serviceIds: string[];
  firstName: string;
  lastName: string;
  whatsapp: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) {
    return { ok: false, error: WHATSAPP_INVALID_MESSAGE };
  }

  const parsed = updateSchema.safeParse({
    ...input,
    whatsapp,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const check = await assertCanManageAppointment(
    parsed.data.appointmentId,
    session,
    [...ACTIVE_APPOINTMENT_STATUSES, "done"]
  );
  if (!("professionalId" in check)) return check;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { data: existing } = await admin
    .from("appointments")
    .select("date, is_squeeze_in")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Agendamento não encontrado." };
  }

  const createInput = {
    professionalId: parsed.data.professionalId,
    date: existing.date,
    startTime: parsed.data.startTime,
    serviceIds: parsed.data.serviceIds,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    whatsapp: parsed.data.whatsapp,
  };

  const validated = await validateCreateInput(createInput, session);
  if (!("durationMinutes" in validated)) return validated;

  const pastError = rejectPastBookingForBarber(
    session,
    existing.date,
    parsed.data.startTime
  );
  if (pastError) return pastError;

  if (!existing.is_squeeze_in) {
    const slotCheck = await validateAdminAppointmentSlot(
      parsed.data.professionalId,
      existing.date,
      parsed.data.startTime,
      validated.durationMinutes,
      parsed.data.appointmentId,
      { skipScheduleBlocks: session.isOwner }
    );

    if (!slotCheck.ok) {
      return {
        ok: false,
        error: session.isOwner
          ? OCCUPIED_SLOT_MESSAGE
          : slotCheck.error,
      };
    }
  }

  const startMinutes = timeToMinutes(parsed.data.startTime);
  const endMinutes = startMinutes + validated.durationMinutes;

  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error: "O horário de término passa da meia-noite. Escolha um início mais cedo.",
    };
  }

  const endTime = minutesToTime(endMinutes);

  const customer = await upsertCustomer({
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    whatsapp: parsed.data.whatsapp,
  });

  if (!customer.ok) {
    return { ok: false, error: customer.error };
  }

  const { error } = await admin
    .from("appointments")
    .update({
      professional_id: parsed.data.professionalId,
      customer_id: customer.customerId,
      customer_first_name: customer.firstName,
      customer_last_name: customer.lastName,
      customer_whatsapp: parsed.data.whatsapp,
      start_time: parsed.data.startTime,
      end_time: endTime,
    })
    .eq("id", parsed.data.appointmentId);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Esse horário já está ocupado." };
    }
    return { ok: false, error: "Não foi possível atualizar o agendamento." };
  }

  const { error: deleteError } = await admin
    .from("appointment_services")
    .delete()
    .eq("appointment_id", parsed.data.appointmentId);

  if (deleteError) {
    return { ok: false, error: "Não foi possível atualizar os serviços." };
  }

  const { error: linkError } = await admin.from("appointment_services").insert(
    parsed.data.serviceIds.map((serviceId) => ({
      appointment_id: parsed.data.appointmentId,
      service_id: serviceId,
    }))
  );

  if (linkError) {
    return { ok: false, error: "Não foi possível salvar os serviços." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

const blockSchema = z.object({
  professionalId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  note: z.string().max(200).optional(),
});

export async function createScheduleBlock(input: {
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  if (
    !session.isOwner &&
    parsed.data.professionalId !== session.professionalId
  ) {
    return { ok: false, error: "Você só pode bloquear a sua própria agenda." };
  }

  if (timeToMinutes(parsed.data.startTime) >= timeToMinutes(parsed.data.endTime)) {
    return {
      ok: false,
      error: "O horário de fim precisa ser depois do início.",
    };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { data: professional } = await admin
    .from("professionals")
    .select("id, active")
    .eq("id", parsed.data.professionalId)
    .maybeSingle();

  if (!professional?.active) {
    return { ok: false, error: "Profissional não encontrado." };
  }

  const { error } = await admin.from("schedule_blocks").insert({
    professional_id: parsed.data.professionalId,
    date: parsed.data.date,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    note: parsed.data.note?.trim() ?? "",
  });

  if (error) {
    return { ok: false, error: "Não foi possível bloquear o horário." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteScheduleBlock(
  blockId: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { data: block } = await admin
    .from("schedule_blocks")
    .select("professional_id")
    .eq("id", blockId)
    .maybeSingle();

  if (!block) {
    return { ok: false, error: "Bloqueio não encontrado." };
  }

  if (!session.isOwner && block.professional_id !== session.professionalId) {
    return { ok: false, error: "Você não pode remover este bloqueio." };
  }

  const { error } = await admin.from("schedule_blocks").delete().eq("id", blockId);

  if (error) {
    return { ok: false, error: "Não foi possível remover o bloqueio." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

const cancelAppointmentSchema = z.object({
  appointmentId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Informe o motivo do cancelamento (mínimo 3 caracteres)."),
});

export async function cancelAppointment(input: {
  appointmentId: string;
  reason: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const parsed = cancelAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { appointmentId, reason } = parsed.data;

  const check = await assertCanManageAppointment(appointmentId, session, [
    ...ACTIVE_APPOINTMENT_STATUSES,
    "done",
  ]);
  if (!("professionalId" in check)) return check;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { data: link } = await admin
    .from("comanda_appointments")
    .select("comanda_id, comandas ( id, status )")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const comanda = Array.isArray(link?.comandas)
    ? link?.comandas[0]
    : link?.comandas;

  if (comanda?.status === "closed") {
    return {
      ok: false,
      error:
        "Esta comanda está fechada. Reabra a comanda antes de cancelar o horário.",
    };
  }

  const { data: items } = await admin
    .from("comanda_items")
    .select("squeeze_appointment_id")
    .eq("appointment_id", appointmentId);

  const squeezeIds = (items ?? [])
    .map((row) => row.squeeze_appointment_id)
    .filter((id): id is string => Boolean(id));

  const cancelledAt = new Date().toISOString();

  const { error } = await admin
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: cancelledAt,
    })
    .eq("id", appointmentId);

  if (error) {
    return { ok: false, error: "Não foi possível cancelar o agendamento." };
  }

  if (squeezeIds.length > 0) {
    await admin
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_at: cancelledAt,
      })
      .in("id", squeezeIds)
      .eq("is_squeeze_in", true);
  }

  await admin.from("comanda_items").delete().eq("appointment_id", appointmentId);
  await admin
    .from("comanda_appointments")
    .delete()
    .eq("appointment_id", appointmentId);

  if (comanda?.id) {
    const { data: remainingLinks } = await admin
      .from("comanda_appointments")
      .select("appointment_id")
      .eq("comanda_id", comanda.id);

    if (!remainingLinks?.length) {
      await admin.from("comandas").delete().eq("id", comanda.id).eq("status", "open");
    } else {
      const { data: remainingItems } = await admin
        .from("comanda_items")
        .select("charged_price_cents, professional_id")
        .eq("comanda_id", comanda.id);

      let totalCents = 0;
      let commissionCents = 0;
      const proIds = [
        ...new Set(
          (remainingItems ?? [])
            .map((item) => item.professional_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const { data: pros } = proIds.length
        ? await admin
            .from("professionals")
            .select("id, commission_percent")
            .in("id", proIds)
        : { data: [] };

      const commissionByPro = new Map(
        (pros ?? []).map((pro) => [pro.id, pro.commission_percent ?? 50])
      );

      for (const item of remainingItems ?? []) {
        totalCents += item.charged_price_cents;
        const pct = item.professional_id
          ? (commissionByPro.get(item.professional_id) ?? 50)
          : 50;
        commissionCents += Math.round(
          (item.charged_price_cents * pct) / 100
        );
      }

      await admin
        .from("comandas")
        .update({
          total_cents: totalCents,
          commission_cents: commissionCents,
          updated_at: cancelledAt,
        })
        .eq("id", comanda.id);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/agenda");
  return { ok: true };
}

export async function deleteAppointment(
  appointmentId: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  if (!session.isOwner) {
    return { ok: false, error: "Apenas o dono pode excluir agendamentos." };
  }

  const check = await assertOwnsAppointment(appointmentId, session);
  if (!("professionalId" in check)) return check;

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { data: link } = await admin
    .from("comanda_appointments")
    .select("comanda_id, comandas ( status )")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  const comanda = Array.isArray(link?.comandas)
    ? link?.comandas[0]
    : link?.comandas;

  if (comanda?.status === "closed") {
    return {
      ok: false,
      error:
        "Esta comanda está fechada. Reabra antes de excluir o agendamento.",
    };
  }

  const { data: items } = await admin
    .from("comanda_items")
    .select("squeeze_appointment_id")
    .eq("appointment_id", appointmentId);

  const squeezeIds = (items ?? [])
    .map((item) => item.squeeze_appointment_id)
    .filter((id): id is string => Boolean(id));

  await admin.from("comanda_items").delete().eq("appointment_id", appointmentId);
  await admin
    .from("comanda_appointments")
    .delete()
    .eq("appointment_id", appointmentId);

  if (squeezeIds.length > 0) {
    await admin.from("appointments").delete().in("id", squeezeIds);
  }

  const { error } = await admin
    .from("appointments")
    .delete()
    .eq("id", appointmentId);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o agendamento." };
  }

  revalidatePath("/admin");
  revalidatePath("/agenda");
  return { ok: true };
}

const moveDateSchema = z.object({
  appointmentId: z.uuid(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function moveAppointmentToDate(input: {
  appointmentId: string;
  newDate: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;
  if (!session.isOwner) {
    return { ok: false, error: "Apenas o dono pode mudar a data." };
  }

  const parsed = moveDateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;

  const { data: appointment } = await admin
    .from("appointments")
    .select("id, date")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { ok: false, error: "Agendamento não encontrado." };
  }

  if (appointment.date === parsed.data.newDate) {
    return { ok: true };
  }

  const { data: link } = await admin
    .from("comanda_appointments")
    .select("comandas ( status )")
    .eq("appointment_id", parsed.data.appointmentId)
    .maybeSingle();

  const comanda = Array.isArray(link?.comandas)
    ? link?.comandas[0]
    : link?.comandas;

  if (comanda?.status === "closed") {
    return {
      ok: false,
      error: "Comanda fechada. Reabra antes de mudar a data.",
    };
  }

  const { data: items } = await admin
    .from("comanda_items")
    .select("squeeze_appointment_id")
    .eq("appointment_id", parsed.data.appointmentId);

  const squeezeIds = (items ?? [])
    .map((item) => item.squeeze_appointment_id)
    .filter((id): id is string => Boolean(id));

  await admin.from("comanda_items").delete().eq("appointment_id", parsed.data.appointmentId);
  await admin
    .from("comanda_appointments")
    .delete()
    .eq("appointment_id", parsed.data.appointmentId);

  if (squeezeIds.length > 0) {
    await admin.from("appointments").delete().in("id", squeezeIds);
  }

  const { error } = await admin
    .from("appointments")
    .update({ date: parsed.data.newDate })
    .eq("id", parsed.data.appointmentId);

  if (error) {
    return { ok: false, error: "Não foi possível mudar a data do agendamento." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

const workflowStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "on_site",
  "cancelled",
  "done",
]);

async function ensureSlotForActiveStatus(
  check: {
    professionalId: string;
    date: string;
    startTime: string;
    serviceIds: string[];
    isSqueezeIn: boolean;
  },
  appointmentId: string,
  isOwner: boolean
): Promise<ActionResult | null> {
  if (check.isSqueezeIn || check.serviceIds.length === 0) {
    return null;
  }

  const availability = await getAvailability(
    check.professionalId,
    check.date,
    check.serviceIds,
    undefined,
    { adminEdit: true, ownerFreeSchedule: isOwner }
  );

  if (!availability.ok) {
    return { ok: false, error: availability.error };
  }

  if (
    !isOwner &&
    !availability.slots.includes(check.startTime)
  ) {
    return { ok: false, error: "Esse horário não está mais disponível." };
  }

  const slotCheck = await validateAdminAppointmentSlot(
    check.professionalId,
    check.date,
    check.startTime,
    availability.durationMinutes,
    appointmentId,
    { skipScheduleBlocks: isOwner }
  );

  if (!slotCheck.ok) {
    return {
      ok: false,
      error: isOwner ? OCCUPIED_SLOT_MESSAGE : slotCheck.error,
    };
  }

  return null;
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: z.infer<typeof workflowStatusSchema>
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!("userId" in session)) return session;

  const parsed = workflowStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: "Status inválido." };
  }

  const check = await assertOwnsAppointment(appointmentId, session);
  if (!("professionalId" in check)) return check;

  if (parsed.data === check.status) {
    return { ok: true };
  }

  const becomingActive = (
    ACTIVE_APPOINTMENT_STATUSES as readonly string[]
  ).includes(parsed.data);

  const wasInactive =
    check.status === "cancelled" || check.status === "done";

  if (becomingActive && wasInactive) {
    const slotError = await ensureSlotForActiveStatus(
      check,
      appointmentId,
      session.isOwner
    );
    if (slotError) return slotError;
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) return admin;
  const { error } = await admin
    .from("appointments")
    .update({ status: parsed.data })
    .eq("id", appointmentId);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Esse horário já está ocupado." };
    }
    if (error.code === "23514") {
      return {
        ok: false,
        error:
          "O banco ainda não foi atualizado. Rode npm run db:migrate e tente de novo.",
      };
    }
    return {
      ok: false,
      error: error.message || "Não foi possível atualizar o status.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/agenda");
  return { ok: true };
}

export async function getEditAvailabilitySlots(input: {
  professionalId: string;
  date: string;
  serviceIds: string[];
  excludeAppointmentId: string;
}): Promise<{ ok: true; slots: string[] } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (!("userId" in session)) {
    return session.ok === false
      ? { ok: false, error: session.error }
      : { ok: false, error: "Sessão inválida." };
  }

  if (
    !session.isOwner &&
    input.professionalId !== session.professionalId
  ) {
    return {
      ok: false,
      error: "Você só pode editar agendamentos na sua própria agenda.",
    };
  }

  const result = await getAvailability(
    input.professionalId,
    input.date,
    input.serviceIds,
    input.excludeAppointmentId,
    {
      adminEdit: true,
      ownerFreeSchedule: session.isOwner,
    }
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, slots: result.slots };
}
