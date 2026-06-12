import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  minutesToTime,
  nowMinutesInTimezone,
  timeToMinutes,
  todayInTimezone,
} from "@/lib/availability";
import { formatTime } from "@/lib/format";
import { getAvailability } from "@/lib/get-availability";

const whatsappSchema = z
  .string()
  .regex(/^\d{10,13}$/, "WhatsApp deve ter de 10 a 13 números.");

const updateSchema = z.object({
  whatsapp: whatsappSchema,
  professionalId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceIds: z.array(z.uuid()).min(1, "Escolha pelo menos um serviço."),
});

export type PublicAppointmentItem = {
  id: string;
  professionalId: string;
  professionalName: string;
  professionalPhotoUrl: string | null;
  date: string;
  startTime: string;
  serviceIds: string[];
  serviceNames: string[];
  totalMinutes: number;
  totalPriceCents: number;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function isUpcoming(date: string, startTime: string): boolean {
  const today = todayInTimezone();
  if (date > today) return true;
  if (date < today) return false;
  return timeToMinutes(startTime) > nowMinutesInTimezone();
}

async function loadOwnedAppointment(
  appointmentId: string,
  whatsapp: string
): Promise<
  | {
      id: string;
      professional_id: string;
      date: string;
      start_time: string;
      status: string;
      is_squeeze_in: boolean;
      customer_whatsapp: string;
    }
  | null
> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("appointments")
    .select(
      "id, professional_id, date, start_time, status, is_squeeze_in, customer_whatsapp"
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!data) return null;
  if (data.customer_whatsapp !== whatsapp) return null;
  if (data.status !== "confirmed") return null;
  if (data.is_squeeze_in) return null;

  return data;
}

export async function listPublicAppointmentsByWhatsapp(
  whatsapp: string
): Promise<Result<PublicAppointmentItem[]>> {
  const parsed = whatsappSchema.safeParse(whatsapp);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, status: 400 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", status: 503 };
  }

  const today = todayInTimezone();

  const { data: rows, error } = await admin
    .from("appointments")
    .select(
      `
      id,
      professional_id,
      date,
      start_time,
      status,
      is_squeeze_in,
      professionals (nickname, photo_url),
      appointment_services (
        service_id,
        services (name, duration_minutes, price_cents)
      )
    `
    )
    .eq("customer_whatsapp", parsed.data)
    .eq("status", "confirmed")
    .eq("is_squeeze_in", false)
    .gte("date", today)
    .order("date")
    .order("start_time");

  if (error) {
    return {
      ok: false,
      error: "Não foi possível buscar seus agendamentos.",
      status: 500,
    };
  }

  const appointments = (rows ?? [])
    .map((row) => {
      const startTime = formatTime(row.start_time);
      if (!isUpcoming(row.date, startTime)) return null;

      const pro = row.professionals as
        | { nickname: string; photo_url: string | null }
        | { nickname: string; photo_url: string | null }[]
        | null;
      const professional = Array.isArray(pro) ? pro[0] : pro;

      const links = row.appointment_services ?? [];
      const serviceIds: string[] = [];
      const serviceNames: string[] = [];
      let totalMinutes = 0;
      let totalPriceCents = 0;

      for (const link of links) {
        serviceIds.push(link.service_id);
        const svc = link.services as
          | { name: string; duration_minutes: number; price_cents: number }
          | { name: string; duration_minutes: number; price_cents: number }[]
          | null;
        const service = Array.isArray(svc) ? svc[0] : svc;
        if (!service) continue;
        serviceNames.push(service.name);
        totalMinutes += service.duration_minutes;
        totalPriceCents += service.price_cents;
      }

      return {
        id: row.id,
        professionalId: row.professional_id,
        professionalName: professional?.nickname ?? "Barbeiro",
        professionalPhotoUrl: professional?.photo_url ?? null,
        date: row.date,
        startTime,
        serviceIds,
        serviceNames,
        totalMinutes,
        totalPriceCents,
      };
    })
    .filter((item): item is PublicAppointmentItem => item !== null);

  return { ok: true, data: appointments };
}

export async function cancelPublicAppointment(
  appointmentId: string,
  whatsapp: string
): Promise<Result<{ id: string }>> {
  const parsed = whatsappSchema.safeParse(whatsapp);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, status: 400 };
  }

  const existing = await loadOwnedAppointment(appointmentId, parsed.data);
  if (!existing) {
    return {
      ok: false,
      error: "Agendamento não encontrado ou não pode ser cancelado.",
      status: 404,
    };
  }

  if (!isUpcoming(existing.date, formatTime(existing.start_time))) {
    return {
      ok: false,
      error: "Esse horário já passou e não pode mais ser cancelado.",
      status: 409,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", status: 503 };
  }

  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível cancelar o agendamento.",
      status: 500,
    };
  }

  return { ok: true, data: { id: appointmentId } };
}

export type UpdatePublicAppointmentInput = z.infer<typeof updateSchema>;

export async function updatePublicAppointment(
  appointmentId: string,
  input: UpdatePublicAppointmentInput
): Promise<Result<{ id: string }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, status: 400 };
  }

  const existing = await loadOwnedAppointment(appointmentId, parsed.data.whatsapp);
  if (!existing) {
    return {
      ok: false,
      error: "Agendamento não encontrado ou não pode ser alterado.",
      status: 404,
    };
  }

  const availability = await getAvailability(
    parsed.data.professionalId,
    parsed.data.date,
    parsed.data.serviceIds,
    appointmentId
  );

  if (!availability.ok) {
    return {
      ok: false,
      error: availability.error,
      status: availability.status,
    };
  }

  if (!availability.slots.includes(parsed.data.startTime)) {
    return {
      ok: false,
      error: "Esse horário não está mais disponível. Escolha outro.",
      status: 409,
    };
  }

  const startMinutes = timeToMinutes(parsed.data.startTime);
  const endMinutes = startMinutes + availability.durationMinutes;

  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error:
        "O horário de término passa da meia-noite. Escolha um início mais cedo.",
      status: 400,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", status: 503 };
  }

  const endTime = minutesToTime(endMinutes);

  const { error } = await admin
    .from("appointments")
    .update({
      professional_id: parsed.data.professionalId,
      date: parsed.data.date,
      start_time: parsed.data.startTime,
      end_time: endTime,
    })
    .eq("id", appointmentId);

  if (error) {
    if (error.code === "23P01") {
      return {
        ok: false,
        error: "Esse horário acabou de ser ocupado. Escolha outro.",
        status: 409,
      };
    }
    return {
      ok: false,
      error: "Não foi possível atualizar o agendamento.",
      status: 500,
    };
  }

  const { error: deleteError } = await admin
    .from("appointment_services")
    .delete()
    .eq("appointment_id", appointmentId);

  if (deleteError) {
    return {
      ok: false,
      error: "Não foi possível atualizar os serviços.",
      status: 500,
    };
  }

  const { error: linkError } = await admin.from("appointment_services").insert(
    parsed.data.serviceIds.map((serviceId) => ({
      appointment_id: appointmentId,
      service_id: serviceId,
    }))
  );

  if (linkError) {
    return {
      ok: false,
      error: "Não foi possível salvar os serviços.",
      status: 500,
    };
  }

  return { ok: true, data: { id: appointmentId } };
}
