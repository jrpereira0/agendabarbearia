import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { minutesToTime, timeToMinutes } from "@/lib/availability";
import { getAvailability } from "@/lib/get-availability";
import { upsertCustomer } from "@/lib/upsert-customer";
import { notifyAppointmentCreated } from "@/lib/notifications/appointment-created-webhook";
import {
  normalizeWhatsapp,
  WHATSAPP_INVALID_MESSAGE,
  whatsappSchema,
} from "@/lib/whatsapp";

const createSchema = z.object({
  professionalId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceIds: z.array(z.uuid()).min(1, "Escolha pelo menos um serviço."),
  firstName: z.string().trim().min(1, "Informe o nome."),
  lastName: z.string().trim().min(1, "Informe o sobrenome."),
  whatsapp: whatsappSchema,
});

export type CreatePublicAppointmentInput = z.infer<typeof createSchema>;

export type CreatePublicAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string; status: number };

export async function createPublicAppointment(
  input: CreatePublicAppointmentInput
): Promise<CreatePublicAppointmentResult> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) {
    return {
      ok: false,
      error: WHATSAPP_INVALID_MESSAGE,
      status: 400,
    };
  }

  const parsed = createSchema.safeParse({ ...input, whatsapp });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0].message,
      status: 400,
    };
  }

  const data = parsed.data;

  const availability = await getAvailability(
    data.professionalId,
    data.date,
    data.serviceIds
  );

  if (!availability.ok) {
    return {
      ok: false,
      error: availability.error,
      status: availability.status,
    };
  }

  if (!availability.slots.includes(data.startTime)) {
    return {
      ok: false,
      error: "Esse horário não está mais disponível. Escolha outro.",
      status: 409,
    };
  }

  const startMinutes = timeToMinutes(data.startTime);
  const endMinutes = startMinutes + availability.durationMinutes;

  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error:
        "O horário de término passa da meia-noite. Escolha um início mais cedo.",
      status: 400,
    };
  }

  const customer = await upsertCustomer({
    firstName: data.firstName,
    lastName: data.lastName,
    whatsapp: data.whatsapp,
  });

  if (!customer.ok) {
    return { ok: false, error: customer.error, status: 500 };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Sistema indisponível no momento.", status: 503 };
  }

  const endTime = minutesToTime(endMinutes);

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
      is_squeeze_in: false,
    })
    .select("id")
    .single();

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
      error: "Não foi possível confirmar o agendamento.",
      status: 500,
    };
  }

  const { error: linkError } = await admin.from("appointment_services").insert(
    data.serviceIds.map((serviceId) => ({
      appointment_id: appointment.id,
      service_id: serviceId,
    }))
  );

  if (linkError) {
    await admin.from("appointments").delete().eq("id", appointment.id);
    return {
      ok: false,
      error: "Não foi possível salvar os serviços.",
      status: 500,
    };
  }

  // Agendamento e serviços já estão salvos — a partir daqui, uma falha ao
  // notificar o barbeiro não pode reverter o agendamento nem virar erro
  // para o cliente. A função abaixo nunca lança exceção.
  await notifyAppointmentCreated(appointment.id, "public_api");

  return { ok: true, appointmentId: appointment.id };
}
