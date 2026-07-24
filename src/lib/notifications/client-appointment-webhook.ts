import { BRAND_NAME } from "@/lib/brand";
import { formatDateBR, formatPriceBRL, formatTime } from "@/lib/format";
import { sendClientAppointmentPush } from "@/lib/push-reminders";

const LOG_PREFIX = "[client-appointment-push]";

function formatWhen(date: string, startTime: string): string {
  return `${formatDateBR(date)} às ${formatTime(startTime)}`;
}

/**
 * Push no app do cliente quando o admin altera o horário.
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
 * Push no app do cliente quando o admin cancela o horário.
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

  try {
    await sendClientAppointmentPush({
      whatsapp,
      title: "Horário cancelado",
      body:
        `Seu horário ${when} com ${input.appointment.professionalName} na ${shopName} foi cancelado.` +
        (reason ? ` Motivo: ${reason}.` : ""),
      data: {
        type: "appointment_cancelled",
        appointmentId: input.appointment.id,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} falha ao enviar cancel`, error);
  }
}
