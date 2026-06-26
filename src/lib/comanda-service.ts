import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTime } from "@/lib/format";
import {
  calculateComandaTotals,
  type ComandaDetail,
  type ComandaItem,
  type ComandaItemInput,
  type ComandaPayment,
  type ComandaPaymentInput,
  type PaymentMethod,
  PAYMENT_METHODS,
} from "@/lib/comanda-types";

type DbComandaRow = {
  id: string;
  appointment_id: string;
  professional_id: string;
  status: "open" | "closed";
  commission_percent_snapshot: number | null;
  total_cents: number;
  commission_cents: number;
  closed_at: string | null;
  professionals:
    | { nickname: string; commission_percent: number }
    | { nickname: string; commission_percent: number }[]
    | null;
  appointments:
    | {
        date: string;
        start_time: string;
        end_time: string;
        status: string;
        customer_first_name: string;
        customer_last_name: string;
        customer_whatsapp: string;
        is_squeeze_in: boolean;
      }
    | {
        date: string;
        start_time: string;
        end_time: string;
        status: string;
        customer_first_name: string;
        customer_last_name: string;
        customer_whatsapp: string;
        is_squeeze_in: boolean;
      }[]
    | null;
  comanda_items: {
    id: string;
    service_id: string | null;
    service_name: string;
    catalog_price_cents: number;
    charged_price_cents: number;
    sort_order: number;
  }[];
  comanda_payments: {
    id: string;
    payment_method: PaymentMethod;
    amount_cents: number;
  }[];
};

const COMANDA_SELECT = `
  id,
  appointment_id,
  professional_id,
  status,
  commission_percent_snapshot,
  total_cents,
  commission_cents,
  closed_at,
  professionals ( nickname, commission_percent ),
  appointments (
    date,
    start_time,
    end_time,
    status,
    customer_first_name,
    customer_last_name,
    customer_whatsapp,
    is_squeeze_in
  ),
  comanda_items (
    id,
    service_id,
    service_name,
    catalog_price_cents,
    charged_price_cents,
    sort_order
  ),
  comanda_payments (
    id,
    payment_method,
    amount_cents
  )
`;

function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapComanda(row: DbComandaRow): ComandaDetail {
  const apt = firstOrSelf(row.appointments);
  const pro = firstOrSelf(row.professionals);
  if (!apt) {
    throw new Error("Comanda sem agendamento vinculado.");
  }

  const items: ComandaItem[] = [...(row.comanda_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      id: item.id,
      serviceId: item.service_id,
      serviceName: item.service_name,
      catalogPriceCents: item.catalog_price_cents,
      chargedPriceCents: item.charged_price_cents,
      sortOrder: item.sort_order,
    }));

  const payments: ComandaPayment[] = (row.comanda_payments ?? []).map((p) => ({
    id: p.id,
    paymentMethod: p.payment_method,
    amountCents: p.amount_cents,
  }));

  return {
    id: row.id,
    appointmentId: row.appointment_id,
    professionalId: row.professional_id,
    professionalNickname: pro?.nickname ?? "—",
    status: row.status,
    commissionPercentSnapshot: row.commission_percent_snapshot,
    totalCents: row.total_cents,
    commissionCents: row.commission_cents,
    closedAt: row.closed_at,
    items,
    payments,
    appointment: {
      date: apt.date,
      startTime: formatTime(apt.start_time),
      endTime: formatTime(apt.end_time),
      status: apt.status,
      customerFirstName: apt.customer_first_name,
      customerLastName: apt.customer_last_name,
      customerWhatsapp: apt.customer_whatsapp,
      isSqueezeIn: apt.is_squeeze_in,
    },
  };
}

async function seedItemsFromAppointment(
  admin: SupabaseClient,
  comandaId: string,
  appointmentId: string
): Promise<void> {
  const { data: links } = await admin
    .from("appointment_services")
    .select("service_id, services ( name, price_cents )")
    .eq("appointment_id", appointmentId);

  if (!links?.length) return;

  const rows = links.map((link, index) => {
    const service = Array.isArray(link.services)
      ? link.services[0]
      : link.services;
    const price = service?.price_cents ?? 0;
    return {
      comanda_id: comandaId,
      service_id: link.service_id,
      service_name: service?.name ?? "Serviço",
      catalog_price_cents: price,
      charged_price_cents: price,
      sort_order: index,
    };
  });

  await admin.from("comanda_items").insert(rows);
}

export async function getOrCreateComandaForAppointment(
  admin: SupabaseClient,
  appointmentId: string
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const { data: existing } = await admin
    .from("comandas")
    .select(COMANDA_SELECT)
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existing) {
    const comanda = mapComanda(existing as DbComandaRow);
    if (comanda.items.length === 0 && comanda.status === "open") {
      await seedItemsFromAppointment(admin, comanda.id, appointmentId);
      return getComandaById(admin, comanda.id);
    }
    return { ok: true, comanda };
  }

  const { data: appointment } = await admin
    .from("appointments")
    .select("id, professional_id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { ok: false, error: "Agendamento não encontrado.", status: 404 };
  }

  if (appointment.status === "cancelled") {
    return {
      ok: false,
      error: "Agendamento cancelado não possui comanda.",
      status: 400,
    };
  }

  const { data: created, error } = await admin
    .from("comandas")
    .insert({
      appointment_id: appointmentId,
      professional_id: appointment.professional_id,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !created) {
    return {
      ok: false,
      error: "Não foi possível abrir a comanda.",
      status: 500,
    };
  }

  await seedItemsFromAppointment(admin, created.id, appointmentId);
  return getComandaById(admin, created.id);
}

export async function getComandaById(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const { data } = await admin
    .from("comandas")
    .select(COMANDA_SELECT)
    .eq("id", comandaId)
    .maybeSingle();

  if (!data) {
    return { ok: false, error: "Comanda não encontrada.", status: 404 };
  }

  return { ok: true, comanda: mapComanda(data as DbComandaRow) };
}

export async function listComandasByDate(
  admin: SupabaseClient,
  date: string,
  options: { professionalId?: string; status?: "open" | "closed" } = {}
): Promise<ComandaDetail[]> {
  const { data: appointmentIds } = await admin
    .from("appointments")
    .select("id")
    .eq("date", date);

  const ids = (appointmentIds ?? []).map((a) => a.id);
  if (ids.length === 0) return [];

  let query = admin
    .from("comandas")
    .select(COMANDA_SELECT)
    .in("appointment_id", ids);

  if (options.professionalId) {
    query = query.eq("professional_id", options.professionalId);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data } = await query.order("closed_at", { ascending: false });
  return (data ?? []).map((row) => mapComanda(row as DbComandaRow));
}

export async function updateComandaItems(
  admin: SupabaseClient,
  comandaId: string,
  items: ComandaItemInput[]
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const current = await getComandaById(admin, comandaId);
  if (!current.ok) return current;

  if (current.comanda.status !== "open") {
    return {
      ok: false,
      error: "Comanda fechada não pode ser editada. Reabra antes.",
      status: 409,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: "Informe ao menos um serviço na comanda.",
      status: 400,
    };
  }

  for (const item of items) {
    if (item.chargedPriceCents < 0) {
      return { ok: false, error: "Valor cobrado inválido.", status: 400 };
    }
  }

  const { data: professional } = await admin
    .from("professionals")
    .select("commission_percent")
    .eq("id", current.comanda.professionalId)
    .single();

  const commissionPercent = professional?.commission_percent ?? 50;
  const { totalCents, commissionCents } = calculateComandaTotals(
    items,
    commissionPercent
  );

  await admin.from("comanda_items").delete().eq("comanda_id", comandaId);

  const { error: insertError } = await admin.from("comanda_items").insert(
    items.map((item, index) => ({
      comanda_id: comandaId,
      service_id: item.serviceId,
      service_name: item.serviceName,
      catalog_price_cents: item.catalogPriceCents,
      charged_price_cents: item.chargedPriceCents,
      sort_order: index,
    }))
  );

  if (insertError) {
    return {
      ok: false,
      error: "Não foi possível atualizar os serviços.",
      status: 500,
    };
  }

  await admin
    .from("comandas")
    .update({
      total_cents: totalCents,
      commission_cents: commissionCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", comandaId);

  return getComandaById(admin, comandaId);
}

function validatePayments(
  payments: ComandaPaymentInput[],
  totalCents: number
): string | null {
  if (payments.length === 0) {
    return "Informe ao menos uma forma de pagamento.";
  }
  let sum = 0;
  for (const payment of payments) {
    if (!PAYMENT_METHODS.includes(payment.paymentMethod)) {
      return "Forma de pagamento inválida.";
    }
    if (payment.amountCents <= 0) {
      return "Valor de pagamento inválido.";
    }
    sum += payment.amountCents;
  }
  if (sum !== totalCents) {
    return "A soma dos pagamentos deve ser igual ao total da comanda.";
  }
  return null;
}

export async function closeComanda(
  admin: SupabaseClient,
  comandaId: string,
  payments: ComandaPaymentInput[],
  closedByUserId: string
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const current = await getComandaById(admin, comandaId);
  if (!current.ok) return current;

  const comanda = current.comanda;
  if (comanda.status === "closed") {
    return { ok: false, error: "Esta comanda já está fechada.", status: 409 };
  }

  if (comanda.appointment.status === "cancelled") {
    return {
      ok: false,
      error: "Agendamento cancelado não pode ser fechado.",
      status: 409,
    };
  }

  if (comanda.items.length === 0) {
    return {
      ok: false,
      error: "Adicione ao menos um serviço antes de fechar.",
      status: 400,
    };
  }

  const paymentError = validatePayments(payments, comanda.totalCents);
  if (paymentError) {
    return { ok: false, error: paymentError, status: 400 };
  }

  const { data: professional } = await admin
    .from("professionals")
    .select("commission_percent")
    .eq("id", comanda.professionalId)
    .single();

  const commissionPercent = professional?.commission_percent ?? 50;
  const { totalCents, commissionCents } = calculateComandaTotals(
    comanda.items,
    commissionPercent
  );

  const now = new Date().toISOString();
  const closedBy =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      closedByUserId
    )
      ? closedByUserId
      : null;

  const { error: payError } = await admin.from("comanda_payments").insert(
    payments.map((p) => ({
      comanda_id: comandaId,
      payment_method: p.paymentMethod,
      amount_cents: p.amountCents,
    }))
  );

  if (payError) {
    return {
      ok: false,
      error: "Não foi possível registrar os pagamentos.",
      status: 500,
    };
  }

  const { error: comandaError } = await admin
    .from("comandas")
    .update({
      status: "closed",
      commission_percent_snapshot: commissionPercent,
      total_cents: totalCents,
      commission_cents: commissionCents,
      closed_at: now,
      closed_by: closedBy,
      updated_at: now,
    })
    .eq("id", comandaId);

  if (comandaError) {
    await admin.from("comanda_payments").delete().eq("comanda_id", comandaId);
    return {
      ok: false,
      error: "Não foi possível fechar a comanda.",
      status: 500,
    };
  }

  await admin
    .from("appointments")
    .update({ status: "done" })
    .eq("id", comanda.appointmentId);

  return getComandaById(admin, comandaId);
}

export async function reopenComanda(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const current = await getComandaById(admin, comandaId);
  if (!current.ok) return current;

  const comanda = current.comanda;
  if (comanda.status !== "closed") {
    return {
      ok: false,
      error: "Só é possível reabrir comandas fechadas.",
      status: 409,
    };
  }

  await admin.from("comanda_payments").delete().eq("comanda_id", comandaId);

  const { data: professional } = await admin
    .from("professionals")
    .select("commission_percent")
    .eq("id", comanda.professionalId)
    .single();

  const commissionPercent = professional?.commission_percent ?? 50;
  const { totalCents, commissionCents } = calculateComandaTotals(
    comanda.items,
    commissionPercent
  );

  const now = new Date().toISOString();

  const { error } = await admin
    .from("comandas")
    .update({
      status: "open",
      commission_percent_snapshot: null,
      total_cents: totalCents,
      commission_cents: commissionCents,
      closed_at: null,
      closed_by: null,
      updated_at: now,
    })
    .eq("id", comandaId);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível reabrir a comanda.",
      status: 500,
    };
  }

  const { data: appointment } = await admin
    .from("appointments")
    .select(
      "status, date, start_time, is_squeeze_in, appointment_services ( service_id )"
    )
    .eq("id", comanda.appointmentId)
    .maybeSingle();

  if (appointment && appointment.status === "done") {
    const serviceIds = (appointment.appointment_services ?? []).map(
      (r) => r.service_id
    );

    if (!appointment.is_squeeze_in && serviceIds.length > 0) {
      const { getAvailability } = await import("@/lib/get-availability");
      const availability = await getAvailability(
        comanda.professionalId,
        appointment.date,
        serviceIds,
        undefined,
        { adminEdit: true }
      );
      if (!availability.ok) {
        await admin
          .from("comandas")
          .update({
            status: "closed",
            closed_at: comanda.closedAt,
            closed_by: null,
          })
          .eq("id", comandaId);
        return {
          ok: false,
          error: availability.error,
          status: 409,
        };
      }
      const startTime = formatTime(appointment.start_time);
      if (!availability.slots.includes(startTime)) {
        return {
          ok: false,
          error:
            "O horário não está mais disponível para reabrir. Ajuste a agenda antes.",
          status: 409,
        };
      }
    }

    await admin
      .from("appointments")
      .update({ status: "scheduled" })
      .eq("id", comanda.appointmentId);
  }

  return getComandaById(admin, comandaId);
}
