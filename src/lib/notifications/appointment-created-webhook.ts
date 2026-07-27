import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadServicePricingContext,
  resolvePriceCentsOrFallback,
} from "@/lib/service-prices-for-date";
import { loadAppointmentWebhookBaseData } from "@/lib/notifications/shared";
import { upsertAppointmentReminder } from "@/lib/appointment-reminders";
import { notifyClientAppointmentCreated } from "@/lib/notifications/client-appointment-webhook";

const EVENT_APPOINTMENT_CREATED = "appointment.created";
const LOG_PREFIX = "[appointment-webhook]";

/**
 * De onde veio a criação do agendamento — ajuda o workflow do n8n (e o
 * debug pelos logs) a diferenciar a origem sem precisar adivinhar.
 */
export type AppointmentCreatedSource =
  | "public_api"
  | "admin_agenda"
  | "admin_squeeze_in"
  | "comanda_extra";

export type AppointmentCreatedWebhookPayload = {
  event: "appointment.created";
  source: AppointmentCreatedSource;
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
    whatsapp: string;
  };
  services: { id: string; name: string; priceCents: number }[];
  shop: { name: string };
};

async function buildPayload(
  admin: SupabaseClient,
  appointmentId: string,
  source: AppointmentCreatedSource
): Promise<AppointmentCreatedWebhookPayload | null> {
  const base = await loadAppointmentWebhookBaseData(
    admin,
    appointmentId,
    LOG_PREFIX
  );
  if (!base) return null;

  const { appointment, professional, rawServices, shopName } = base;

  const pricingContext = await loadServicePricingContext(
    admin,
    appointment.date,
    rawServices.map((s) => s.id)
  );

  const services = rawServices.map((service) => ({
    id: service.id,
    name: service.name,
    priceCents: resolvePriceCentsOrFallback(service, pricingContext),
  }));

  const totalPriceCents = services.reduce((sum, s) => sum + s.priceCents, 0);

  return {
    event: EVENT_APPOINTMENT_CREATED,
    source,
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.start_time.slice(0, 5),
      endTime: appointment.end_time.slice(0, 5),
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
      whatsapp: professional.whatsapp,
    },
    services,
    shop: {
      name: shopName,
    },
  };
}

/**
 * Agenda avisos (caixa do app, push, WhatsApp do barbeiro) **depois** da
 * resposta ao site/app. O horário já está salvo — o cliente não espera isso.
 * Usar nos pontos de criação em vez de `await notifyAppointmentCreated`.
 */
export function scheduleAppointmentCreatedNotify(
  appointmentId: string,
  source: AppointmentCreatedSource
): void {
  after(() => {
    void notifyAppointmentCreated(appointmentId, source);
  });
}

/**
 * Lembretes + caixa/push do cliente + webhook n8n (barbeiro).
 * Preferir `scheduleAppointmentCreatedNotify` no create para não atrasar
 * a confirmação no site/app. Nunca lança erro.
 */
export async function notifyAppointmentCreated(
  appointmentId: string,
  source: AppointmentCreatedSource
): Promise<void> {
  console.log("[appointment-webhook] appointment.created solicitado", {
    appointmentId,
    source,
  });

  try {
    const admin = createAdminClient();
    if (!admin) {
      console.warn(
        `[appointment-webhook] Supabase indisponível ao notificar agendamento ${appointmentId} (${source}).`
      );
      return;
    }

    const [, payload] = await Promise.all([
      upsertAppointmentReminder(appointmentId).catch((error) => {
        console.error(
          "[appointment-reminder] erro ao sincronizar lembrete após criação",
          { appointmentId, error }
        );
      }),
      buildPayload(admin, appointmentId, source),
    ]);

    await Promise.all([
      (async () => {
        if (!payload) return;
        try {
          await notifyClientAppointmentCreated({
            whatsapp: payload.customer.whatsapp,
            shopName: payload.shop.name,
            source,
            appointment: {
              id: payload.appointment.id,
              date: payload.appointment.date,
              startTime: payload.appointment.startTime,
              professionalName: payload.professional.name,
              serviceNames: payload.services.map((s) => s.name),
              totalPriceCents: payload.appointment.totalPriceCents,
            },
          });
        } catch (error) {
          console.error("[client-appointment-push] erro após criação", {
            appointmentId,
            error,
          });
        }
      })(),
      sendBarberCreatedWebhook(admin, appointmentId, source, payload),
    ]);
  } catch (error) {
    console.error("[appointment-webhook] erro ao enviar webhook", {
      appointmentId,
      source,
      error,
    });
  }
}

async function sendBarberCreatedWebhook(
  admin: SupabaseClient,
  appointmentId: string,
  source: AppointmentCreatedSource,
  payload: AppointmentCreatedWebhookPayload | null
): Promise<void> {
  const webhookUrl = process.env.N8N_APPOINTMENT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn(
      "[appointment-webhook] N8N_APPOINTMENT_WEBHOOK_URL não configurada"
    );
    return;
  }

  // Idempotência: constraint única (appointment_id, event).
  const { error: dedupeError } = await admin
    .from("appointment_notifications")
    .insert({
      appointment_id: appointmentId,
      event: EVENT_APPOINTMENT_CREATED,
      source,
    });

  if (dedupeError) {
    if (dedupeError.code === "23505") {
      console.warn("[appointment-webhook] notificação já enviada, ignorando", {
        appointmentId,
        source,
      });
      return;
    }
    console.warn(
      `[appointment-webhook] Não foi possível registrar notificação do agendamento ${appointmentId} (${dedupeError.code ?? "sem código"}): ${dedupeError.message}`
    );
  }

  if (!payload) return;

  if (!payload.professional.whatsapp.trim()) {
    console.warn(
      "[appointment-webhook] profissional sem WhatsApp, não enviando",
      payload.professional.id
    );
    return;
  }

  const secret = process.env.N8N_APPOINTMENT_WEBHOOK_SECRET?.trim();

  console.log("[appointment-webhook] enviando para n8n", {
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

  console.log("[appointment-webhook] status n8n", response.status);

  if (!response.ok) {
    const responseText = await response.text();
    console.warn(
      `[appointment-webhook] n8n respondeu ${response.status} para o agendamento ${appointmentId} (${source}): ${responseText}`
    );
  }
}
