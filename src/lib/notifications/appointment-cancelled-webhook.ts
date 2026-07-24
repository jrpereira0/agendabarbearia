import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAppointmentWebhookBaseData } from "@/lib/notifications/shared";
import { cancelAppointmentReminder } from "@/lib/appointment-reminders";
import { notifyClientAppointmentCancelled } from "@/lib/notifications/client-appointment-webhook";

const EVENT_APPOINTMENT_CANCELLED = "appointment.cancelled";
const LOG_PREFIX = "[appointment-cancelled-webhook]";

/**
 * De onde veio o cancelamento — ajuda o workflow do n8n (e o debug pelos
 * logs) a diferenciar a origem sem precisar adivinhar.
 */
export type AppointmentCancelledSource =
  | "api_cancel"
  | "admin_cancel"
  | "admin_squeeze_cancel";

export type AppointmentCancelledWebhookPayload = {
  event: "appointment.cancelled";
  source: AppointmentCancelledSource;
  appointment: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: "cancelled";
    cancelReason: string | null;
  };
  customer: {
    firstName: string;
    lastName: string;
    whatsapp: string;
  };
  professional: {
    id: string;
    name: string;
    whatsapp: string;
  };
  services: { id: string; name: string; priceCents: number }[];
  shop: { name: string };
};

async function buildPayload(
  admin: SupabaseClient,
  appointmentId: string,
  source: AppointmentCancelledSource,
  cancelReason: string | null
): Promise<AppointmentCancelledWebhookPayload | null> {
  const base = await loadAppointmentWebhookBaseData(
    admin,
    appointmentId,
    LOG_PREFIX
  );
  if (!base) return null;

  const { appointment, professional, rawServices, shopName } = base;

  const services = rawServices.map((service) => ({
    id: service.id,
    name: service.name,
    priceCents: service.price_cents,
  }));

  return {
    event: EVENT_APPOINTMENT_CANCELLED,
    source,
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.start_time.slice(0, 5),
      endTime: appointment.end_time.slice(0, 5),
      status: "cancelled",
      cancelReason: cancelReason?.trim() || null,
    },
    customer: {
      firstName: appointment.customer_first_name,
      lastName: appointment.customer_last_name,
      whatsapp: appointment.customer_whatsapp,
    },
    professional: {
      id: professional.id,
      name: professional.nickname,
      whatsapp: professional.whatsapp,
    },
    services,
    shop: {
      name: shopName,
    },
  };
}

/**
 * Avisa o n8n (webhook) que um agendamento foi cancelado, para notificar o
 * barbeiro no WhatsApp. Também avisa o cliente. Chamar depois que o status
 * já foi salvo como "cancelled" no banco.
 *
 * Nunca lança erro: qualquer falha aqui é só registrada em log, sem afetar
 * o fluxo de quem chamou (cancelamento continua válido).
 */
export async function notifyAppointmentCancelled(
  appointmentId: string,
  source: AppointmentCancelledSource,
  cancelReason?: string | null
): Promise<void> {
  try {
    await cancelAppointmentReminder(appointmentId, "appointment_cancelled");
  } catch (error) {
    console.error("[appointment-reminder] erro ao cancelar lembrete", {
      appointmentId,
      error,
    });
  }

  console.log("[appointment-cancelled-webhook] solicitado", {
    appointmentId,
    source,
  });

  try {
    const admin = createAdminClient();
    if (!admin) {
      console.warn(
        `[appointment-cancelled-webhook] Supabase indisponível ao notificar cancelamento ${appointmentId} (${source}).`
      );
      return;
    }

    const payload = await buildPayload(
      admin,
      appointmentId,
      source,
      cancelReason ?? null
    );
    if (!payload) return;

    // Cliente — cancelamento pelo app/site ou pelo admin.
    try {
      await notifyClientAppointmentCancelled({
        whatsapp: payload.customer.whatsapp,
        shopName: payload.shop.name,
        appointment: {
          id: payload.appointment.id,
          date: payload.appointment.date,
          startTime: payload.appointment.startTime,
          professionalName: payload.professional.name,
          serviceNames: payload.services.map((s) => s.name),
          cancelReason: payload.appointment.cancelReason,
        },
      });
    } catch (error) {
      console.error("[client-appointment-webhook] erro após cancelamento", {
        appointmentId,
        error,
      });
    }

    const webhookUrl = process.env.N8N_APPOINTMENT_WEBHOOK_URL?.trim();
    console.log(
      "[appointment-cancelled-webhook] env url existe:",
      Boolean(webhookUrl)
    );

    if (!webhookUrl) {
      console.warn(
        "[appointment-cancelled-webhook] N8N_APPOINTMENT_WEBHOOK_URL não configurada"
      );
      return;
    }

    // Idempotência do aviso ao barbeiro.
    const { error: dedupeError } = await admin
      .from("appointment_notifications")
      .insert({
        appointment_id: appointmentId,
        event: EVENT_APPOINTMENT_CANCELLED,
        source,
      });

    if (dedupeError) {
      if (dedupeError.code === "23505") {
        console.warn(
          "[appointment-cancelled-webhook] notificação já enviada, ignorando",
          { appointmentId, source }
        );
        return;
      }
      console.warn(
        `[appointment-cancelled-webhook] Não foi possível registrar notificação do cancelamento ${appointmentId} (${dedupeError.code ?? "sem código"}): ${dedupeError.message}`
      );
    }

    if (!payload.professional.whatsapp.trim()) {
      console.warn(
        "[appointment-cancelled-webhook] profissional sem WhatsApp",
        payload.professional.id
      );
      return;
    }

    const secret = process.env.N8N_APPOINTMENT_WEBHOOK_SECRET?.trim();

    console.log("[appointment-cancelled-webhook] enviando para n8n", {
      appointmentId,
      source,
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-appointment-webhook-secret": secret } : {}),
      },
      body: JSON.stringify(payload),
    });

    console.log("[appointment-cancelled-webhook] status n8n", response.status);

    if (!response.ok) {
      const responseText = await response.text();
      console.warn(
        `[appointment-cancelled-webhook] n8n respondeu ${response.status} para o cancelamento ${appointmentId} (${source}): ${responseText}`
      );
    }
  } catch (error) {
    console.error("[appointment-cancelled-webhook] erro ao enviar webhook", {
      appointmentId,
      source,
      error,
    });
  }
}
