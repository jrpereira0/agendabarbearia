import { BRAND_NAME } from "@/lib/brand";
import { formatDateBR, formatPriceBRL, formatTime } from "@/lib/format";

const LOG_PREFIX = "[client-appointment-webhook]";

export type ClientAppointmentUpdatedPayload = {
  event: "client.appointment.updated";
  whatsapp: string;
  message: string;
  shop: { name: string };
  changes: string[];
  appointment: {
    id: string;
    date: string;
    startTime: string;
    professionalName: string;
    serviceNames: string[];
    totalPriceCents: number;
  };
};

export type ClientAppointmentCancelledPayload = {
  event: "client.appointment.cancelled";
  whatsapp: string;
  message: string;
  shop: { name: string };
  appointment: {
    id: string;
    date: string;
    startTime: string;
    professionalName: string;
    serviceNames: string[];
    cancelReason: string | null;
  };
};

type ClientAppointmentWebhookPayload =
  | ClientAppointmentUpdatedPayload
  | ClientAppointmentCancelledPayload;

function resolveWebhookConfig(): {
  url: string;
  secret: string | undefined;
} | null {
  const dedicatedUrl = process.env.N8N_CLIENT_APPOINTMENT_WEBHOOK_URL?.trim();
  const otpUrl = process.env.N8N_CLIENT_OTP_WEBHOOK_URL?.trim();
  const url = dedicatedUrl || otpUrl;
  if (!url) return null;

  const secret =
    process.env.N8N_CLIENT_APPOINTMENT_WEBHOOK_SECRET?.trim() ||
    process.env.N8N_CLIENT_OTP_WEBHOOK_SECRET?.trim() ||
    undefined;

  return { url, secret };
}

async function postClientAppointmentWebhook(
  payload: ClientAppointmentWebhookPayload
): Promise<void> {
  const config = resolveWebhookConfig();
  if (!config) {
    console.warn(`${LOG_PREFIX} webhook do cliente não configurado`, {
      event: payload.event,
      whatsapp: payload.whatsapp,
    });
    if (process.env.NODE_ENV !== "production") {
      console.info(`${LOG_PREFIX} [dev] mensagem`, {
        event: payload.event,
        whatsapp: payload.whatsapp,
        message: payload.message,
      });
    }
    return;
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.secret
          ? { "x-client-otp-webhook-secret": config.secret }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`${LOG_PREFIX} n8n respondeu ${response.status}`, {
        event: payload.event,
        whatsapp: payload.whatsapp,
        body: body.slice(0, 500),
      });
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} erro ao enviar webhook`, {
      event: payload.event,
      whatsapp: payload.whatsapp,
      error,
    });
  }
}

function formatWhen(date: string, startTime: string): string {
  return `${formatDateBR(date)} às ${formatTime(startTime)}`;
}

/**
 * Avisa o cliente no WhatsApp (via n8n) que o horário foi alterado.
 * Nunca lança erro.
 */
export async function notifyClientAppointmentUpdated(input: {
  whatsapp: string;
  shopName?: string;
  changes: string[];
  appointment: {
    id: string;
    date: string;
    startTime: string;
    professionalName: string;
    serviceNames: string[];
    totalPriceCents: number;
  };
}): Promise<void> {
  const whatsapp = input.whatsapp.trim();
  if (!whatsapp || input.changes.length === 0) return;

  const shopName = input.shopName?.trim() || BRAND_NAME;
  const when = formatWhen(input.appointment.date, input.appointment.startTime);
  const changesText = input.changes.map((c) => `• ${c}`).join("\n");

  const message =
    `Oi! Seu horário na ${shopName} foi atualizado.\n\n` +
    `${changesText}\n\n` +
    `Agora: ${when} com ${input.appointment.professionalName}.\n` +
    `Serviços: ${input.appointment.serviceNames.join(", ") || "—"}.\n` +
    `Total: ${formatPriceBRL(input.appointment.totalPriceCents)}.`;

  await postClientAppointmentWebhook({
    event: "client.appointment.updated",
    whatsapp,
    message,
    shop: { name: shopName },
    changes: input.changes,
    appointment: input.appointment,
  });
}

/**
 * Avisa o cliente no WhatsApp (via n8n) que o horário foi cancelado.
 * Nunca lança erro.
 */
export async function notifyClientAppointmentCancelled(input: {
  whatsapp: string;
  shopName?: string;
  appointment: {
    id: string;
    date: string;
    startTime: string;
    professionalName: string;
    serviceNames: string[];
    cancelReason: string | null;
  };
}): Promise<void> {
  const whatsapp = input.whatsapp.trim();
  if (!whatsapp) return;

  const shopName = input.shopName?.trim() || BRAND_NAME;
  const when = formatWhen(input.appointment.date, input.appointment.startTime);
  const reason = input.appointment.cancelReason?.trim();

  const message =
    `Oi! Seu horário na ${shopName} foi cancelado.\n\n` +
    `Era: ${when} com ${input.appointment.professionalName}.\n` +
    `Serviços: ${input.appointment.serviceNames.join(", ") || "—"}.` +
    (reason ? `\nMotivo: ${reason}.` : "") +
    `\n\nSe quiser remarcar, use o app ou o site da agenda.`;

  await postClientAppointmentWebhook({
    event: "client.appointment.cancelled",
    whatsapp,
    message,
    shop: { name: shopName },
    appointment: input.appointment,
  });
}
