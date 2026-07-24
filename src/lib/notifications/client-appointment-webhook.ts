import { BRAND_NAME } from "@/lib/brand";
import { formatDateBR, formatPriceBRL, formatTime } from "@/lib/format";
import { sendClientAppointmentPush } from "@/lib/push-reminders";

const LOG_PREFIX = "[client-appointment-push]";

function formatWhen(date: string, startTime: string): string {
  return `${formatDateBR(date)} às ${formatTime(startTime)}`;
}

/**
 * Push / caixa do app quando o cliente ou o admin cria um horário.
 */
export async function notifyClientAppointmentCreated(input: {
  whatsapp: string;
  shopName?: string;
  source: "public_api" | "admin_agenda" | "admin_squeeze_in" | "comanda_extra";
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
  if (!whatsapp) return;

  const shopName = input.shopName?.trim() || BRAND_NAME;
  const when = formatWhen(input.appointment.date, input.appointment.startTime);
  const byAdmin =
    input.source === "admin_agenda" ||
    input.source === "admin_squeeze_in" ||
    input.source === "comanda_extra";

  const title = byAdmin ? "Horário marcado pra você" : "Agendamento confirmado";
  const lead = byAdmin
    ? `A barbearia marcou um horário pra você na ${shopName}.`
    : `Seu horário na ${shopName} foi confirmado.`;

  try {
    await sendClientAppointmentPush({
      whatsapp,
      title,
      body:
        `${lead} ${when} com ${input.appointment.professionalName}. ` +
        `Serviços: ${input.appointment.serviceNames.join(", ") || "—"}. ` +
        `Total: ${formatPriceBRL(input.appointment.totalPriceCents)}.`,
      data: {
        type: "appointment_created",
        appointmentId: input.appointment.id,
        source: input.source,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} falha ao enviar create`, error);
  }
}

/**
 * Push no app do cliente quando o horário é alterado (cliente ou admin).
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
  const summary = input.changes.slice(0, 2).join(" · ");

  try {
    await sendClientAppointmentPush({
      whatsapp,
      title: "Horário atualizado",
      body: `${summary}. Agora: ${when} com ${input.appointment.professionalName} · ${formatPriceBRL(input.appointment.totalPriceCents)} (${shopName}).`,
      data: {
        type: "appointment_updated",
        appointmentId: input.appointment.id,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} falha ao enviar update`, error);
  }
}

/**
 * Push no app do cliente quando o horário é cancelado (cliente ou admin).
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
    cancelReason?: string | null;
  };
}): Promise<void> {
  const whatsapp = input.whatsapp.trim();
  if (!whatsapp) return;

  const shopName = input.shopName?.trim() || BRAND_NAME;
  const when = formatWhen(input.appointment.date, input.appointment.startTime);

  try {
    await sendClientAppointmentPush({
      whatsapp,
      title: "Horário cancelado",
      body: `Seu horário ${when} com ${input.appointment.professionalName} na ${shopName} foi cancelado.`,
      data: {
        type: "appointment_cancelled",
        appointmentId: input.appointment.id,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} falha ao enviar cancel`, error);
  }
}
