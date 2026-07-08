import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_NAME } from "@/lib/brand";
import {
  loadServicePricingContext,
  resolvePriceCentsOrFallback,
} from "@/lib/service-prices-for-date";

const EVENT_APPOINTMENT_CREATED = "appointment.created";

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

type RawAppointmentRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_whatsapp: string;
  professionals:
    | { id: string; nickname: string; whatsapp: string }
    | { id: string; nickname: string; whatsapp: string }[]
    | null;
  appointment_services:
    | { services: RawServiceRow | RawServiceRow[] | null }[]
    | null;
};

type RawServiceRow = { id: string; name: string; price_cents: number };

function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function buildPayload(
  admin: SupabaseClient,
  appointmentId: string,
  source: AppointmentCreatedSource
): Promise<AppointmentCreatedWebhookPayload | null> {
  const { data: appointment, error } = await admin
    .from("appointments")
    .select(
      `
      id,
      date,
      start_time,
      end_time,
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
    .maybeSingle<RawAppointmentRow>();

  if (error || !appointment) {
    console.warn(
      `[appointment-webhook] Agendamento ${appointmentId} não encontrado ao montar o payload.`
    );
    return null;
  }

  const professional = firstOrSelf(appointment.professionals);
  if (!professional) {
    console.warn(
      `[appointment-webhook] Profissional não encontrado para o agendamento ${appointmentId}.`
    );
    return null;
  }

  const rawServices = (appointment.appointment_services ?? [])
    .map((row) => firstOrSelf(row.services))
    .filter((service): service is RawServiceRow => service !== null);

  const [{ data: shopSettings }, pricingContext] = await Promise.all([
    admin.from("shop_settings").select("shop_name").eq("id", 1).maybeSingle(),
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
      name: shopSettings?.shop_name?.trim() || BRAND_NAME,
    },
  };
}

/**
 * Avisa o n8n (webhook) que um agendamento foi criado, para notificar o
 * barbeiro no WhatsApp. Chamar depois que o agendamento e os serviços já
 * foram salvos com sucesso no banco — de qualquer ponto de criação do
 * sistema (site público, painel admin, encaixe, serviço extra da comanda).
 *
 * Busca os dados completos pelo appointmentId (não depende de dados
 * parciais de quem chamou), então funciona igual não importa a origem.
 *
 * Nunca lança erro: qualquer falha aqui é só registrada em log, sem afetar
 * o fluxo de quem chamou (agendamento continua válido).
 */
export async function notifyAppointmentCreated(
  appointmentId: string,
  source: AppointmentCreatedSource
): Promise<void> {
  console.log("[appointment-webhook] appointment.created solicitado", {
    appointmentId,
    source,
  });

  const webhookUrl = process.env.N8N_APPOINTMENT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn(
      "[appointment-webhook] N8N_APPOINTMENT_WEBHOOK_URL não configurada"
    );
    return;
  }

  try {
    const admin = createAdminClient();
    if (!admin) {
      console.warn(
        `[appointment-webhook] Supabase indisponível ao notificar agendamento ${appointmentId} (${source}).`
      );
      return;
    }

    // Idempotência: só insere se ainda não existir um registro para esse
    // (appointment_id, event) — a constraint única da tabela garante isso
    // mesmo em caso de corrida (dois retries ao mesmo tempo, por exemplo).
    // Se o insert falhar por unique violation, é porque já foi enviado antes.
    const { error: dedupeError } = await admin
      .from("appointment_notifications")
      .insert({
        appointment_id: appointmentId,
        event: EVENT_APPOINTMENT_CREATED,
        source,
      });

    if (dedupeError) {
      // 23505 = unique_violation: já existe registro para esse agendamento+evento.
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

    const payload = await buildPayload(admin, appointmentId, source);
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
  } catch (error) {
    console.error("[appointment-webhook] erro ao enviar webhook", {
      appointmentId,
      source,
      error,
    });
  }
}
