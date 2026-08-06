import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPriceBRL } from "@/lib/format";
import {
  loadServicePricingContext,
  resolvePriceCentsOrFallback,
} from "@/lib/service-prices-for-date";
import {
  loadAppointmentWebhookBaseData,
  type RawServiceRow,
} from "@/lib/notifications/shared";
import { upsertAppointmentReminder } from "@/lib/appointment-reminders";
import { notifyClientAppointmentUpdated } from "@/lib/notifications/client-appointment-webhook";

const EVENT_APPOINTMENT_UPDATED = "appointment.updated";
const LOG_PREFIX = "[appointment-updated-webhook]";

export type AppointmentUpdatedSource =
  | "api_update"
  | "admin_update"
  | "admin_squeeze_update";

/** Estado do agendamento antes da alteração — capturar antes do update no banco. */
export type AppointmentUpdateSnapshot = {
  appointmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  professionalId: string;
  professionalName: string;
  professionalWhatsapp: string;
  customer: {
    firstName: string;
    lastName: string;
    whatsapp: string;
  };
  services: { id: string; name: string; priceCents: number }[];
  totalPriceCents: number;
};

export type AppointmentUpdatedWebhookPayload = {
  event: "appointment.updated";
  source: AppointmentUpdatedSource;
  appointment: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    totalPriceCents: number;
  };
  previousAppointment: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
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
  previousProfessional: {
    id: string;
    name: string;
    whatsapp: string;
  };
  services: { id: string; name: string; priceCents: number }[];
  previousServices: { id: string; name: string; priceCents: number }[];
  changes: string[];
  shop: { name: string };
};

function formatDateShort(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatTimeShort(time: string): string {
  const [hour, minute] = time.slice(0, 5).split(":");
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

function servicesKey(services: { id: string }[]): string {
  return services
    .map((s) => s.id)
    .sort()
    .join(",");
}

function servicesLabel(services: { name: string }[]): string {
  return services.map((s) => s.name).join(", ");
}

async function resolveServicesWithPricing(
  admin: SupabaseClient,
  date: string,
  rawServices: RawServiceRow[]
): Promise<{ id: string; name: string; priceCents: number }[]> {
  const pricingContext = await loadServicePricingContext(
    admin,
    date,
    rawServices.map((s) => s.id)
  );

  return rawServices.map((service) => ({
    id: service.id,
    name: service.name,
    priceCents: resolvePriceCentsOrFallback(service, pricingContext),
  }));
}

/**
 * Captura o estado atual do agendamento antes de uma alteração.
 * Chamar antes do update no banco.
 */
export async function captureAppointmentUpdateSnapshot(
  admin: SupabaseClient,
  appointmentId: string
): Promise<AppointmentUpdateSnapshot | null> {
  const base = await loadAppointmentWebhookBaseData(
    admin,
    appointmentId,
    LOG_PREFIX
  );
  if (!base) return null;

  const { appointment, professional, rawServices } = base;
  const services = await resolveServicesWithPricing(
    admin,
    appointment.date,
    rawServices
  );

  return {
    appointmentId: appointment.id,
    date: appointment.date,
    startTime: appointment.start_time.slice(0, 5),
    endTime: appointment.end_time.slice(0, 5),
    status: appointment.status,
    professionalId: professional.id,
    professionalName: professional.nickname,
    professionalWhatsapp: professional.whatsapp,
    customer: {
      firstName: appointment.customer_first_name,
      lastName: appointment.customer_last_name,
      whatsapp: appointment.customer_whatsapp ?? "",
    },
    services,
    totalPriceCents: services.reduce((sum, s) => sum + s.priceCents, 0),
  };
}

function buildChanges(
  previous: AppointmentUpdateSnapshot,
  current: AppointmentUpdateSnapshot
): string[] {
  const changes: string[] = [];

  if (previous.date !== current.date) {
    changes.push(
      `Data alterada de ${formatDateShort(previous.date)} para ${formatDateShort(current.date)}`
    );
  }

  if (previous.startTime !== current.startTime) {
    changes.push(
      `Horário alterado de ${formatTimeShort(previous.startTime)} para ${formatTimeShort(current.startTime)}`
    );
  } else if (previous.endTime !== current.endTime) {
    changes.push(
      `Término alterado de ${formatTimeShort(previous.endTime)} para ${formatTimeShort(current.endTime)}`
    );
  }

  if (previous.professionalId !== current.professionalId) {
    changes.push(
      `Profissional alterado de ${previous.professionalName} para ${current.professionalName}`
    );
  }

  if (servicesKey(previous.services) !== servicesKey(current.services)) {
    changes.push(
      `Serviço alterado de ${servicesLabel(previous.services)} para ${servicesLabel(current.services)}`
    );
  }

  if (previous.totalPriceCents !== current.totalPriceCents) {
    changes.push(
      `Valor alterado de ${formatPriceBRL(previous.totalPriceCents)} para ${formatPriceBRL(current.totalPriceCents)}`
    );
  }

  return changes;
}

function hasRelevantChanges(changes: string[]): boolean {
  return changes.length > 0;
}

async function buildPayload(
  admin: SupabaseClient,
  source: AppointmentUpdatedSource,
  previous: AppointmentUpdateSnapshot,
  current: AppointmentUpdateSnapshot,
  changes: string[]
): Promise<AppointmentUpdatedWebhookPayload | null> {
  const base = await loadAppointmentWebhookBaseData(
    admin,
    current.appointmentId,
    LOG_PREFIX
  );
  if (!base) return null;

  return {
    event: EVENT_APPOINTMENT_UPDATED,
    source,
    appointment: {
      id: current.appointmentId,
      date: current.date,
      startTime: current.startTime,
      endTime: current.endTime,
      status: current.status,
      totalPriceCents: current.totalPriceCents,
    },
    previousAppointment: {
      id: previous.appointmentId,
      date: previous.date,
      startTime: previous.startTime,
      endTime: previous.endTime,
      status: previous.status,
      totalPriceCents: previous.totalPriceCents,
    },
    customer: current.customer,
    professional: {
      id: current.professionalId,
      name: current.professionalName,
      whatsapp: current.professionalWhatsapp,
    },
    previousProfessional: {
      id: previous.professionalId,
      name: previous.professionalName,
      whatsapp: previous.professionalWhatsapp,
    },
    services: current.services,
    previousServices: previous.services,
    changes,
    shop: {
      name: base.shopName,
    },
  };
}

/**
 * Agenda aviso de alteração em segundo plano (igual à criação).
 * Preferir isto no painel pra não segurar o "salvo" na tela.
 */
export function scheduleAppointmentUpdatedNotify(
  appointmentId: string,
  source: AppointmentUpdatedSource,
  previousSnapshot: AppointmentUpdateSnapshot
): void {
  after(() => {
    void notifyAppointmentUpdated(appointmentId, source, previousSnapshot);
  });
}

/**
 * Avisa o n8n (webhook) que um agendamento foi alterado, para notificar o(s)
 * barbeiro(s) no WhatsApp. Chamar depois que o update e os serviços já
 * foram salvos com sucesso no banco.
 *
 * O previousSnapshot deve ter sido capturado ANTES da alteração.
 * Não usa idempotência bloqueante — o mesmo agendamento pode ser editado
 * várias vezes e cada alteração relevante dispara um novo aviso.
 *
 * Nunca lança erro: qualquer falha aqui é só registrada em log.
 */
export async function notifyAppointmentUpdated(
  appointmentId: string,
  source: AppointmentUpdatedSource,
  previousSnapshot: AppointmentUpdateSnapshot
): Promise<void> {
  console.log("[appointment-updated-webhook] solicitado", {
    appointmentId,
    source,
  });

  try {
    const admin = createAdminClient();
    if (!admin) {
      console.warn(
        `[appointment-updated-webhook] Supabase indisponível ao notificar alteração ${appointmentId} (${source}).`
      );
      return;
    }

    const currentSnapshot = await captureAppointmentUpdateSnapshot(
      admin,
      appointmentId
    );
    if (!currentSnapshot) return;

    const changes = buildChanges(previousSnapshot, currentSnapshot);
    if (!hasRelevantChanges(changes)) {
      console.log(
        "[appointment-updated-webhook] nenhuma mudança relevante, ignorando",
        { appointmentId, source }
      );
      return;
    }

    // Lembretes 1h / 30min — independente do webhook do barbeiro.
    try {
      await upsertAppointmentReminder(appointmentId);
    } catch (error) {
      console.error(
        "[appointment-reminder] erro ao sincronizar lembrete após alteração",
        { appointmentId, error }
      );
    }

    // Cliente — remarcação pelo app/site ou alteração pelo admin.
    try {
      await notifyClientAppointmentUpdated({
        whatsapp: currentSnapshot.customer.whatsapp,
        shopName: (
          await loadAppointmentWebhookBaseData(
            admin,
            appointmentId,
            LOG_PREFIX
          )
        )?.shopName,
        changes,
        appointment: {
          id: currentSnapshot.appointmentId,
          date: currentSnapshot.date,
          startTime: currentSnapshot.startTime,
          professionalName: currentSnapshot.professionalName,
          serviceNames: currentSnapshot.services.map((s) => s.name),
          totalPriceCents: currentSnapshot.totalPriceCents,
        },
      });
    } catch (error) {
      console.error("[client-appointment-webhook] erro após alteração", {
        appointmentId,
        error,
      });
    }

    const webhookUrl = process.env.N8N_APPOINTMENT_WEBHOOK_URL?.trim();
    console.log(
      "[appointment-updated-webhook] env url existe:",
      Boolean(webhookUrl)
    );

    if (!webhookUrl) {
      console.warn(
        "[appointment-updated-webhook] N8N_APPOINTMENT_WEBHOOK_URL não configurada"
      );
      return;
    }

    const payload = await buildPayload(
      admin,
      source,
      previousSnapshot,
      currentSnapshot,
      changes
    );
    if (!payload) return;

    const hasAnyWhatsapp =
      payload.professional.whatsapp.trim() ||
      payload.previousProfessional.whatsapp.trim();

    if (!hasAnyWhatsapp) {
      console.warn(
        "[appointment-updated-webhook] profissional sem WhatsApp",
        payload.professional.id
      );
      return;
    }

    const secret = process.env.N8N_APPOINTMENT_WEBHOOK_SECRET?.trim();

    console.log("[appointment-updated-webhook] enviando para n8n", {
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

    console.log("[appointment-updated-webhook] status n8n", response.status);

    if (!response.ok) {
      const responseText = await response.text();
      console.warn(
        `[appointment-updated-webhook] n8n respondeu ${response.status} para a alteração ${appointmentId} (${source}): ${responseText}`
      );
    }
  } catch (error) {
    console.error("[appointment-updated-webhook] erro ao enviar webhook", {
      appointmentId,
      source,
      error,
    });
  }
}
