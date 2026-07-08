import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAND_NAME } from "@/lib/brand";

export type RawServiceRow = { id: string; name: string; price_cents: number };

export type RawAppointmentRow = {
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

export function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type AppointmentWebhookBaseData = {
  appointment: RawAppointmentRow;
  professional: { id: string; nickname: string; whatsapp: string };
  rawServices: RawServiceRow[];
  shopName: string;
};

/**
 * Busca os dados brutos (agendamento, profissional, serviços e nome da
 * loja) usados tanto pelo webhook de criação quanto pelo de cancelamento.
 * Sempre pelo appointmentId, sem depender de dados parciais de quem chamou.
 */
export async function loadAppointmentWebhookBaseData(
  admin: SupabaseClient,
  appointmentId: string,
  logPrefix: string
): Promise<AppointmentWebhookBaseData | null> {
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
      `${logPrefix} Agendamento ${appointmentId} não encontrado ao montar o payload.`
    );
    return null;
  }

  const professional = firstOrSelf(appointment.professionals);
  if (!professional) {
    console.warn(
      `${logPrefix} Profissional não encontrado para o agendamento ${appointmentId}.`
    );
    return null;
  }

  const rawServices = (appointment.appointment_services ?? [])
    .map((row) => firstOrSelf(row.services))
    .filter((service): service is RawServiceRow => service !== null);

  const { data: shopSettings } = await admin
    .from("shop_settings")
    .select("shop_name")
    .eq("id", 1)
    .maybeSingle();

  return {
    appointment,
    professional,
    rawServices,
    shopName: shopSettings?.shop_name?.trim() || BRAND_NAME,
  };
}
