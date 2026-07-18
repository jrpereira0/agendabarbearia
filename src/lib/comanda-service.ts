import type { SupabaseClient } from "@supabase/supabase-js";
import { minutesToTime, timeToMinutes } from "@/lib/availability";
import { formatTime } from "@/lib/format";
import {
  calculateComandaTotalsByProfessional,
  type CashInflowPaymentMethod,
  type ComandaDetail,
  type ComandaItem,
  type ComandaItemInput,
  type ComandaLinkedAppointment,
  type ComandaPayment,
  type ComandaPaymentInput,
  type PaymentMethod,
  PAYMENT_METHODS,
} from "@/lib/comanda-types";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/appointment-status";
import { notifyAppointmentCreated } from "@/lib/notifications/appointment-created-webhook";
import { assertComandaClosableInOpenCashRegister } from "@/lib/cash-register-service";
import {
  addCustomerCredit,
  canReverseComandaCreditTransactions,
  deductCustomerCredit,
  getCustomerCreditBalanceByWhatsapp,
  resolveCustomerIdByWhatsapp,
  reverseComandaCreditTransactions,
} from "@/lib/customer-credit-service";
import {
  loadServicePricingContext,
  resolvePriceCentsOrFallback,
} from "@/lib/service-prices-for-date";

type DbComandaRow = {
  id: string;
  appointment_id: string | null;
  professional_id: string;
  customer_whatsapp: string;
  service_date: string;
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
    product_id: string | null;
    service_name: string;
    catalog_price_cents: number;
    charged_price_cents: number;
    quantity: number;
    commission_percent_snapshot: number | null;
    sort_order: number;
    squeeze_appointment_id: string | null;
    appointment_id: string | null;
    professional_id: string | null;
    is_tip: boolean;
    professionals:
      | { nickname: string }
      | { nickname: string }[]
      | null;
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
  customer_whatsapp,
  service_date,
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
    product_id,
    service_name,
    catalog_price_cents,
    charged_price_cents,
    quantity,
    commission_percent_snapshot,
    sort_order,
    squeeze_appointment_id,
    appointment_id,
    professional_id,
    is_tip,
    professionals ( nickname )
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

function mapComandaRow(
  row: DbComandaRow,
  linkedAppointments: ComandaLinkedAppointment[],
  validAppointmentIds: Set<string>,
  customerFromAppointment: {
    customerFirstName: string;
    customerLastName: string;
    customerWhatsapp: string;
    validSqueezeAppointmentIds?: Set<string>;
  }
): ComandaDetail {
  const apt = firstOrSelf(row.appointments);
  const pro = firstOrSelf(row.professionals);
  const primary = linkedAppointments.find((linked) => !linked.isSqueezeIn);
  const validSqueezeAppointmentIds =
    customerFromAppointment.validSqueezeAppointmentIds ?? new Set<string>();

  const items: ComandaItem[] = [...(row.comanda_items ?? [])]
    .filter((item) => {
      if (row.status === "closed") return true;
      if (item.product_id) return true;
      if (item.squeeze_appointment_id) {
        return validSqueezeAppointmentIds.has(item.squeeze_appointment_id);
      }
      return (
        !item.appointment_id || validAppointmentIds.has(item.appointment_id)
      );
    })
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      const itemPro = firstOrSelf(item.professionals);
      return {
        id: item.id,
        serviceId: item.service_id,
        productId: item.product_id,
        serviceName: item.service_name,
        catalogPriceCents: item.catalog_price_cents,
        chargedPriceCents: item.charged_price_cents,
        quantity: item.quantity ?? 1,
        commissionPercentSnapshot: item.commission_percent_snapshot,
        sortOrder: item.sort_order,
        squeezeAppointmentId: item.squeeze_appointment_id,
        appointmentId: item.appointment_id,
        professionalId: item.professional_id,
        professionalNickname: itemPro?.nickname ?? "—",
        isTip: item.is_tip,
      };
    });

  const payments: ComandaPayment[] = (row.comanda_payments ?? []).map((p) => ({
    id: p.id,
    paymentMethod: p.payment_method,
    amountCents: p.amount_cents,
  }));

  const customerFirstName =
    apt?.customer_first_name ?? customerFromAppointment.customerFirstName;
  const customerLastName =
    apt?.customer_last_name ?? customerFromAppointment.customerLastName;
  const customerWhatsapp = row.customer_whatsapp;

  return {
    id: row.id,
    appointmentId: row.appointment_id ?? primary?.id ?? "",
    professionalId: row.professional_id,
    professionalNickname: pro?.nickname ?? primary?.professionalNickname ?? "—",
    status: row.status,
    commissionPercentSnapshot: row.commission_percent_snapshot,
    totalCents: row.total_cents,
    commissionCents: row.commission_cents,
    closedAt: row.closed_at,
    items,
    payments,
    linkedAppointments,
    customerFirstName,
    customerLastName,
    customerWhatsapp,
    serviceDate: row.service_date,
    appointment: {
      date: row.service_date,
      startTime: primary?.startTime ?? (apt ? formatTime(apt.start_time) : "—"),
      endTime: primary?.endTime ?? (apt ? formatTime(apt.end_time) : "—"),
      status: primary?.status ?? apt?.status ?? "scheduled",
      customerFirstName,
      customerLastName,
      customerWhatsapp,
      isSqueezeIn: primary?.isSqueezeIn ?? apt?.is_squeeze_in ?? false,
    },
  };
}

async function loadCustomerDayEncaixes(
  admin: SupabaseClient,
  customerWhatsapp: string,
  serviceDate: string,
  options: { includeDone?: boolean } = {}
): Promise<ComandaLinkedAppointment[]> {
  const statuses = options.includeDone
    ? [...ACTIVE_APPOINTMENT_STATUSES, "done"]
    : [...ACTIVE_APPOINTMENT_STATUSES];

  const { data } = await admin
    .from("appointments")
    .select(
      `
      id,
      date,
      professional_id,
      start_time,
      end_time,
      status,
      is_squeeze_in,
      is_comanda_extra,
      professionals ( nickname )
    `
    )
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("date", serviceDate)
    .eq("is_squeeze_in", true)
    .in("status", statuses);

  return (data ?? [])
    .map((apt) => {
      const pro = firstOrSelf(apt.professionals);
      return {
        id: apt.id,
        professionalId: apt.professional_id,
        professionalNickname: pro?.nickname ?? "—",
        startTime: formatTime(apt.start_time),
        endTime: formatTime(apt.end_time),
        status: apt.status,
        isSqueezeIn: true,
        isComandaExtra: apt.is_comanda_extra ?? false,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime, "pt-BR"));
}

async function findExplicitComandaIdForAppointment(
  admin: SupabaseClient,
  appointmentId: string
): Promise<string | null> {
  const [bySqueezeItem, byAptItem, byLink] = await Promise.all([
    admin
      .from("comanda_items")
      .select("comanda_id")
      .eq("squeeze_appointment_id", appointmentId)
      .limit(1)
      .maybeSingle(),
    admin
      .from("comanda_items")
      .select("comanda_id")
      .eq("appointment_id", appointmentId)
      .limit(1)
      .maybeSingle(),
    admin
      .from("comanda_appointments")
      .select("comanda_id")
      .eq("appointment_id", appointmentId)
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    bySqueezeItem.data?.comanda_id ??
    byAptItem.data?.comanda_id ??
    byLink.data?.comanda_id ??
    null
  );
}

async function findOpenComandaIdForCustomerDay(
  admin: SupabaseClient,
  customerWhatsapp: string,
  serviceDate: string
): Promise<string | null> {
  const { data } = await admin
    .from("comandas")
    .select("id")
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("service_date", serviceDate)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

export async function getComandaForAppointment(
  admin: SupabaseClient,
  appointmentId: string
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const { data: trigger } = await admin
    .from("appointments")
    .select(
      "id, professional_id, status, customer_whatsapp, date, customer_first_name, customer_last_name"
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (!trigger) {
    return { ok: false, error: "Agendamento não encontrado.", status: 404 };
  }

  if (trigger.status === "cancelled") {
    return {
      ok: false,
      error: "Agendamento cancelado não possui comanda.",
      status: 400,
    };
  }

  // Atendimento já finalizado: só reabre a comanda em que ele foi fechado.
  if (trigger.status === "done") {
    const comandaId = await findExplicitComandaIdForAppointment(
      admin,
      appointmentId
    );
    if (!comandaId) {
      return {
        ok: false,
        error: "Comanda não encontrada para este atendimento.",
        status: 404,
      };
    }

    const existing = await getComandaById(admin, comandaId, { sync: false });
    if (!existing.ok) return existing;
    return existing;
  }

  // Atendimento em aberto: une todos os horários ativos do cliente no dia
  // numa única comanda aberta (ou cria uma nova se a anterior já foi fechada).
  return getOrCreateComandaForAppointment(admin, appointmentId, trigger);
}

async function pruneStaleEncaixeComandaItems(
  admin: SupabaseClient,
  comandaId: string,
  customerWhatsapp: string,
  serviceDate: string
): Promise<void> {
  const { data: activeSqueeze } = await admin
    .from("appointments")
    .select("id")
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("date", serviceDate)
    .eq("is_squeeze_in", true)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES]);

  const validIds = new Set((activeSqueeze ?? []).map((row) => row.id));

  const { data: items } = await admin
    .from("comanda_items")
    .select("id, squeeze_appointment_id")
    .eq("comanda_id", comandaId)
    .not("squeeze_appointment_id", "is", null);

  const staleIds = (items ?? [])
    .filter(
      (item) =>
        item.squeeze_appointment_id &&
        !validIds.has(item.squeeze_appointment_id)
    )
    .map((item) => item.id);

  if (staleIds.length > 0) {
    await deleteComandaItemsSafely(admin, staleIds);
  }
}

/** Remove itens de encaixe excluído/cancelado e recalcula comandas abertas. */
export async function detachEncaixeFromOpenComandas(
  admin: SupabaseClient,
  squeezeAppointmentId: string
): Promise<void> {
  const { data: items } = await admin
    .from("comanda_items")
    .select("comanda_id")
    .eq("squeeze_appointment_id", squeezeAppointmentId);

  const comandaIds = [
    ...new Set((items ?? []).map((item) => item.comanda_id)),
  ];

  if (items?.length) {
    await admin
      .from("comanda_items")
      .delete()
      .eq("squeeze_appointment_id", squeezeAppointmentId);
  }

  const now = new Date().toISOString();
  for (const comandaId of comandaIds) {
    const totals = await recalculateComandaTotals(admin, comandaId);
    await admin
      .from("comandas")
      .update({
        total_cents: totals.totalCents,
        commission_cents: totals.commissionCents,
        updated_at: now,
      })
      .eq("id", comandaId)
      .eq("status", "open");
  }
}

async function syncManualEncaixeItemsToComanda(
  admin: SupabaseClient,
  comandaId: string,
  customerWhatsapp: string,
  serviceDate: string
): Promise<void> {
  await pruneStaleEncaixeComandaItems(
    admin,
    comandaId,
    customerWhatsapp,
    serviceDate
  );

  const { data: squeezeApts } = await admin
    .from("appointments")
    .select("id, professional_id")
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("date", serviceDate)
    .eq("is_squeeze_in", true)
    .eq("is_comanda_extra", false)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES]);

  if (!squeezeApts?.length) return;

  const { data: existingItems } = await admin
    .from("comanda_items")
    .select("squeeze_appointment_id, appointment_id, service_id")
    .eq("comanda_id", comandaId);

  const coveredKeys = new Set<string>();
  for (const item of existingItems ?? []) {
    if (item.squeeze_appointment_id && item.service_id) {
      coveredKeys.add(`${item.squeeze_appointment_id}:${item.service_id}`);
    }
    if (item.appointment_id && item.service_id) {
      coveredKeys.add(`apt:${item.appointment_id}:${item.service_id}`);
    }
  }

  let sortOrder =
    (existingItems ?? []).length > 0
      ? Math.max(
          ...(await admin
            .from("comanda_items")
            .select("sort_order")
            .eq("comanda_id", comandaId)
            .then((r) => (r.data ?? []).map((i) => i.sort_order)))
        ) + 1
      : 0;

  const pricing = await loadServicePricingContext(admin, serviceDate);

  for (const apt of squeezeApts) {
    const { data: services } = await admin
      .from("appointment_services")
      .select("service_id, services ( id, name, price_cents )")
      .eq("appointment_id", apt.id);

    for (const link of services ?? []) {
      const squeezeKey = `${apt.id}:${link.service_id}`;
      const aptKey = `apt:${apt.id}:${link.service_id}`;
      if (coveredKeys.has(squeezeKey) || coveredKeys.has(aptKey)) continue;

      const service = Array.isArray(link.services)
        ? link.services[0]
        : link.services;
      const price = resolvePriceCentsOrFallback(
        {
          id: link.service_id,
          name: service?.name ?? "Serviço",
          price_cents: service?.price_cents ?? 0,
        },
        pricing
      );

      await admin.from("comanda_items").insert({
        comanda_id: comandaId,
        service_id: link.service_id,
        service_name: service?.name ?? "Serviço",
        catalog_price_cents: price,
        charged_price_cents: price,
        sort_order: sortOrder,
        squeeze_appointment_id: apt.id,
        appointment_id: null,
        professional_id: apt.professional_id,
      });
      coveredKeys.add(squeezeKey);
      sortOrder += 1;
    }
  }
}

async function loadLinkedAppointments(
  admin: SupabaseClient,
  comandaId: string,
  serviceDate: string
): Promise<ComandaLinkedAppointment[]> {
  const { data } = await admin
    .from("comanda_appointments")
    .select(
      `
      appointment_id,
      appointments (
        id,
        date,
        professional_id,
        start_time,
        end_time,
        status,
        is_squeeze_in,
        professionals ( nickname )
      )
    `
    )
    .eq("comanda_id", comandaId);

  return (data ?? [])
    .map((row) => {
      const apt = firstOrSelf(
        row.appointments as
          | {
              id: string;
              date: string;
              professional_id: string;
              start_time: string;
              end_time: string;
              status: string;
              is_squeeze_in: boolean;
              professionals:
                | { nickname: string }
                | { nickname: string }[]
                | null;
            }
          | {
              id: string;
              date: string;
              professional_id: string;
              start_time: string;
              end_time: string;
              status: string;
              is_squeeze_in: boolean;
              professionals:
                | { nickname: string }
                | { nickname: string }[]
                | null;
            }[]
          | null
      );
      if (!apt || apt.date !== serviceDate || apt.is_squeeze_in) return null;
      const pro = firstOrSelf(apt.professionals);
      return {
        id: apt.id,
        professionalId: apt.professional_id,
        professionalNickname: pro?.nickname ?? "—",
        startTime: formatTime(apt.start_time),
        endTime: formatTime(apt.end_time),
        status: apt.status,
        isSqueezeIn: false,
      };
    })
    .filter((apt): apt is ComandaLinkedAppointment => apt !== null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime, "pt-BR"));
}

async function loadProfessionalCommissions(
  admin: SupabaseClient,
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (professionalIds.length === 0) return new Map();
  const { data } = await admin
    .from("professionals")
    .select("id, commission_percent")
    .in("id", professionalIds);
  return new Map(
    (data ?? []).map((row) => [row.id, row.commission_percent ?? 50])
  );
}

async function resolveComandaDetail(
  admin: SupabaseClient,
  row: DbComandaRow
): Promise<ComandaDetail> {
  const includeDone = row.status === "closed";
  const [linkedFromJunction, dayEncaixes] = await Promise.all([
    loadLinkedAppointments(admin, row.id, row.service_date),
    loadCustomerDayEncaixes(admin, row.customer_whatsapp, row.service_date, {
      includeDone,
    }),
  ]);

  const linkedById = new Map(
    linkedFromJunction.map((apt) => [apt.id, apt] as const)
  );
  for (const encaixe of dayEncaixes) {
    if (!linkedById.has(encaixe.id)) {
      linkedById.set(encaixe.id, encaixe);
    }
  }

  const linkedAppointments = [...linkedById.values()].sort((a, b) =>
    a.startTime.localeCompare(b.startTime, "pt-BR")
  );

  const validAppointmentIds = new Set(
    linkedAppointments.filter((apt) => !apt.isSqueezeIn).map((apt) => apt.id)
  );
  const validSqueezeAppointmentIds = new Set(
    linkedAppointments.filter((apt) => apt.isSqueezeIn).map((apt) => apt.id)
  );
  const apt = firstOrSelf(row.appointments);
  const mapped = mapComandaRow(row, linkedAppointments, validAppointmentIds, {
    customerFirstName: apt?.customer_first_name ?? "",
    customerLastName: apt?.customer_last_name ?? "",
    customerWhatsapp: row.customer_whatsapp,
    validSqueezeAppointmentIds,
  });

  // Em comanda aberta, o total da linha pode ficar defasado se sobrou item
  // de horário cancelado. Alinha o total ao que a tela realmente exibe.
  if (row.status === "open") {
    const commissions = await loadProfessionalCommissions(
      admin,
      [
        ...new Set(
          mapped.items
            .map((item) => item.professionalId)
            .filter((id): id is string => Boolean(id))
        ),
      ]
    );
    const live = calculateComandaTotalsByProfessional(
      mapped.items.map((item) => ({
        chargedPriceCents: item.chargedPriceCents,
        professionalId: item.professionalId,
        isTip: item.isTip,
        productId: item.productId,
        commissionPercentSnapshot: item.commissionPercentSnapshot,
      })),
      commissions
    );
    return {
      ...mapped,
      totalCents: live.totalCents,
      commissionCents: live.commissionCents,
    };
  }

  return mapped;
}

async function seedItemsFromAppointment(
  admin: SupabaseClient,
  comandaId: string,
  appointmentId: string,
  sortOrderStart = 0
): Promise<number> {
  const { data: appointment } = await admin
    .from("appointments")
    .select("professional_id, date")
    .eq("id", appointmentId)
    .maybeSingle();

  const { data: links } = await admin
    .from("appointment_services")
    .select("service_id, services ( id, name, price_cents )")
    .eq("appointment_id", appointmentId);

  if (!links?.length || !appointment) return sortOrderStart;

  const serviceRows = links.map((link) => {
    const service = Array.isArray(link.services)
      ? link.services[0]
      : link.services;
    return {
      id: link.service_id,
      name: service?.name ?? "Serviço",
      price_cents: service?.price_cents ?? 0,
    };
  });
  const pricing = await loadServicePricingContext(
    admin,
    appointment.date,
    serviceRows.map((service) => service.id)
  );

  const rows = links.map((link, index) => {
    const service = Array.isArray(link.services)
      ? link.services[0]
      : link.services;
    const price = resolvePriceCentsOrFallback(
      {
        id: link.service_id,
        name: service?.name ?? "Serviço",
        price_cents: service?.price_cents ?? 0,
      },
      pricing
    );
    return {
      comanda_id: comandaId,
      service_id: link.service_id,
      service_name: service?.name ?? "Serviço",
      catalog_price_cents: price,
      charged_price_cents: price,
      sort_order: sortOrderStart + index,
      appointment_id: appointmentId,
      professional_id: appointment.professional_id,
    };
  });

  await admin.from("comanda_items").insert(rows);
  return sortOrderStart + rows.length;
}

/** Remove vínculos e itens de agendamentos que não são do dia / não estão ativos. */
async function pruneComandaToDayScope(
  admin: SupabaseClient,
  comandaId: string,
  validAppointmentIds: Set<string>
): Promise<void> {
  const { data: links } = await admin
    .from("comanda_appointments")
    .select("appointment_id")
    .eq("comanda_id", comandaId);

  const staleLinkIds = (links ?? [])
    .map((row) => row.appointment_id)
    .filter((id) => !validAppointmentIds.has(id));

  if (staleLinkIds.length > 0) {
    await admin
      .from("comanda_appointments")
      .delete()
      .eq("comanda_id", comandaId)
      .in("appointment_id", staleLinkIds);
    await admin
      .from("comanda_items")
      .delete()
      .eq("comanda_id", comandaId)
      .in("appointment_id", staleLinkIds);
  }

  const { data: items } = await admin
    .from("comanda_items")
    .select("id, appointment_id")
    .eq("comanda_id", comandaId);

  const itemAppointmentIds = [
    ...new Set(
      (items ?? [])
        .map((item) => item.appointment_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const inactiveAppointmentIds = new Set<string>();
  if (itemAppointmentIds.length > 0) {
    const { data: appointments } = await admin
      .from("appointments")
      .select("id, status")
      .in("id", itemAppointmentIds);

    for (const apt of appointments ?? []) {
      if (
        !(ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
      ) {
        inactiveAppointmentIds.add(apt.id);
      }
    }
  }

  const staleItemIds = (items ?? [])
    .filter((item) => {
      if (!item.appointment_id) return false;
      if (!validAppointmentIds.has(item.appointment_id)) return true;
      return inactiveAppointmentIds.has(item.appointment_id);
    })
    .map((item) => item.id);

  if (staleItemIds.length > 0) {
    await deleteComandaItemsSafely(admin, staleItemIds);
  }

  const totals = await recalculateComandaTotals(admin, comandaId);
  await admin
    .from("comandas")
    .update({
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", comandaId)
    .eq("status", "open");
}

/**
 * Se a comanda aberta não tem mais serviços de agendamentos ativos do dia,
 * remove gorjeta e produtos órfãos (restos de horário cancelado).
 */
async function purgeOrphanTipsAndProducts(
  admin: SupabaseClient,
  comandaId: string,
  validAppointmentIds: Set<string>
): Promise<void> {
  const { data: items } = await admin
    .from("comanda_items")
    .select("id, appointment_id, is_tip, product_id, squeeze_appointment_id")
    .eq("comanda_id", comandaId);

  if (!items?.length) return;

  const hasActiveService = items.some((item) => {
    if (item.is_tip || item.product_id) return false;
    if (item.appointment_id && validAppointmentIds.has(item.appointment_id)) {
      return true;
    }
    return Boolean(item.squeeze_appointment_id);
  });

  if (hasActiveService) return;

  const orphanIds = items
    .filter((item) => item.is_tip || Boolean(item.product_id))
    .map((item) => item.id);

  if (orphanIds.length > 0) {
    await deleteComandaItemsSafely(admin, orphanIds);
  }
}

/**
 * Remove da comanda aberta itens/vínculos de horário cancelado ou inexistente.
 * Evita total “fantasma” na finalização (UI esconde o item, DB ainda soma).
 */
async function scrubInactiveAppointmentItemsFromOpenComanda(
  admin: SupabaseClient,
  comandaId: string
): Promise<void> {
  const { data: links } = await admin
    .from("comanda_appointments")
    .select(
      `
      appointment_id,
      appointments ( id, status, is_squeeze_in )
    `
    )
    .eq("comanda_id", comandaId);

  const staleLinkIds: string[] = [];
  for (const row of links ?? []) {
    const apt = firstOrSelf(
      row.appointments as
        | { id: string; status: string; is_squeeze_in: boolean }
        | { id: string; status: string; is_squeeze_in: boolean }[]
        | null
    );
    if (
      !apt ||
      !(ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
    ) {
      staleLinkIds.push(row.appointment_id);
    }
  }

  if (staleLinkIds.length > 0) {
    await admin
      .from("comanda_appointments")
      .delete()
      .eq("comanda_id", comandaId)
      .in("appointment_id", staleLinkIds);

    const { data: staleLinkItems } = await admin
      .from("comanda_items")
      .select("id")
      .eq("comanda_id", comandaId)
      .in("appointment_id", staleLinkIds);
    await deleteComandaItemsSafely(
      admin,
      (staleLinkItems ?? []).map((item) => item.id)
    );
  }

  const { data: items } = await admin
    .from("comanda_items")
    .select("id, appointment_id, squeeze_appointment_id")
    .eq("comanda_id", comandaId);

  const relatedIds = [
    ...new Set(
      (items ?? []).flatMap((item) => {
        const ids: string[] = [];
        if (item.appointment_id) ids.push(item.appointment_id);
        if (item.squeeze_appointment_id) ids.push(item.squeeze_appointment_id);
        return ids;
      })
    ),
  ];

  if (relatedIds.length === 0) return;

  const { data: appointments } = await admin
    .from("appointments")
    .select("id, status")
    .in("id", relatedIds);

  const activeIds = new Set(
    (appointments ?? [])
      .filter((apt) =>
        (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
      )
      .map((apt) => apt.id)
  );
  const knownIds = new Set((appointments ?? []).map((apt) => apt.id));

  const staleItemIds = (items ?? [])
    .filter((item) => {
      if (item.appointment_id) {
        if (!knownIds.has(item.appointment_id)) return true;
        if (!activeIds.has(item.appointment_id)) return true;
      }
      if (item.squeeze_appointment_id) {
        if (!knownIds.has(item.squeeze_appointment_id)) return true;
        if (!activeIds.has(item.squeeze_appointment_id)) return true;
      }
      return false;
    })
    .map((item) => item.id);

  if (staleItemIds.length > 0) {
    await deleteComandaItemsSafely(admin, staleItemIds);
  }
}

/**
 * Depois de desvincular/cancelar um horário: se não sobrou atendimento ativo,
 * apaga a comanda aberta (incluindo gorjeta/produto órfãos). Caso contrário,
 * só recalcula o total.
 */
export async function finalizeOpenComandaAfterAppointmentRemoved(
  admin: SupabaseClient,
  comandaId: string
): Promise<void> {
  await scrubInactiveAppointmentItemsFromOpenComanda(admin, comandaId);

  const { data: links } = await admin
    .from("comanda_appointments")
    .select(
      `
      appointment_id,
      appointments ( id, status, is_squeeze_in )
    `
    )
    .eq("comanda_id", comandaId);

  let hasActiveMain = false;
  for (const row of links ?? []) {
    const apt = firstOrSelf(
      row.appointments as
        | { id: string; status: string; is_squeeze_in: boolean }
        | { id: string; status: string; is_squeeze_in: boolean }[]
        | null
    );
    if (
      apt &&
      !apt.is_squeeze_in &&
      (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
    ) {
      hasActiveMain = true;
      break;
    }
  }

  const { data: squeezeItems } = await admin
    .from("comanda_items")
    .select("squeeze_appointment_id")
    .eq("comanda_id", comandaId)
    .not("squeeze_appointment_id", "is", null);

  let hasActiveSqueeze = false;
  for (const item of squeezeItems ?? []) {
    if (!item.squeeze_appointment_id) continue;
    const { data: squeezeApt } = await admin
      .from("appointments")
      .select("status")
      .eq("id", item.squeeze_appointment_id)
      .maybeSingle();

    if (
      squeezeApt &&
      (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(
        squeezeApt.status
      )
    ) {
      hasActiveSqueeze = true;
    } else {
      await detachEncaixeFromOpenComandas(admin, item.squeeze_appointment_id);
    }
  }

  if (hasActiveMain || hasActiveSqueeze) {
    const totals = await recalculateComandaTotals(admin, comandaId);
    await admin
      .from("comandas")
      .update({
        total_cents: totals.totalCents,
        commission_cents: totals.commissionCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", comandaId)
      .eq("status", "open");
    return;
  }

  // Comanda sem atendimento ativo: apaga o que der.
  // Itens já no repasse de comissão ficam (FK); aí só zera o total.
  const { data: remainingItems } = await admin
    .from("comanda_items")
    .select("id")
    .eq("comanda_id", comandaId);

  await deleteComandaItemsSafely(
    admin,
    (remainingItems ?? []).map((item) => item.id)
  );

  const { data: leftovers } = await admin
    .from("comanda_items")
    .select("id")
    .eq("comanda_id", comandaId)
    .limit(1);

  if (leftovers && leftovers.length > 0) {
    await admin
      .from("comandas")
      .update({
        total_cents: 0,
        commission_cents: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", comandaId)
      .eq("status", "open");
    return;
  }

  await admin.from("comanda_appointments").delete().eq("comanda_id", comandaId);
  await admin.from("comandas").delete().eq("id", comandaId).eq("status", "open");
}

async function unlinkSqueezeAppointmentsFromComanda(
  admin: SupabaseClient,
  comandaId: string
): Promise<void> {
  const { data: links } = await admin
    .from("comanda_appointments")
    .select(
      `
      appointment_id,
      appointments ( is_squeeze_in )
    `
    )
    .eq("comanda_id", comandaId);

  const squeezeIds = (links ?? [])
    .filter((row) => {
      const apt = firstOrSelf(
        row.appointments as { is_squeeze_in: boolean } | { is_squeeze_in: boolean }[] | null
      );
      return apt?.is_squeeze_in === true;
    })
    .map((row) => row.appointment_id);

  if (squeezeIds.length === 0) return;

  await admin
    .from("comanda_appointments")
    .delete()
    .eq("comanda_id", comandaId)
    .in("appointment_id", squeezeIds);
  await admin
    .from("comanda_items")
    .delete()
    .eq("comanda_id", comandaId)
    .in("appointment_id", squeezeIds);
}

async function linkAppointmentToComanda(
  admin: SupabaseClient,
  comandaId: string,
  appointmentId: string
): Promise<void> {
  await admin.from("comanda_appointments").upsert(
    { comanda_id: comandaId, appointment_id: appointmentId },
    { onConflict: "appointment_id" }
  );
}

async function syncItemsFromLinkedAppointments(
  admin: SupabaseClient,
  comandaId: string,
  validAppointmentIds: Set<string>
): Promise<void> {
  const { data: comanda } = await admin
    .from("comandas")
    .select("service_date")
    .eq("id", comandaId)
    .maybeSingle();
  if (!comanda) return;

  const pricing = await loadServicePricingContext(admin, comanda.service_date);

  const { data: links } = await admin
    .from("comanda_appointments")
    .select("appointment_id")
    .eq("comanda_id", comandaId);

  const appointmentIds = (links ?? [])
    .map((row) => row.appointment_id)
    .filter((id) => validAppointmentIds.has(id));
  if (appointmentIds.length === 0) return;

  const { data: existingItems } = await admin
    .from("comanda_items")
    .select("appointment_id, service_id")
    .eq("comanda_id", comandaId);

  const existingKeys = new Set(
    (existingItems ?? []).map(
      (item) => `${item.appointment_id ?? ""}:${item.service_id ?? ""}`
    )
  );

  let sortOrder =
    (existingItems ?? []).length > 0
      ? Math.max(
          ...(await admin
            .from("comanda_items")
            .select("sort_order")
            .eq("comanda_id", comandaId)
            .then((r) => (r.data ?? []).map((i) => i.sort_order)))
        ) + 1
      : 0;

  for (const appointmentId of appointmentIds) {
    const { data: appointment } = await admin
      .from("appointments")
      .select("professional_id, is_squeeze_in")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appointment || appointment.is_squeeze_in) continue;

    const { data: services } = await admin
      .from("appointment_services")
      .select("service_id, services ( id, name, price_cents )")
      .eq("appointment_id", appointmentId);

    for (const link of services ?? []) {
      const key = `${appointmentId}:${link.service_id}`;
      if (existingKeys.has(key)) continue;

      const service = Array.isArray(link.services)
        ? link.services[0]
        : link.services;
      const price = resolvePriceCentsOrFallback(
        {
          id: link.service_id,
          name: service?.name ?? "Serviço",
          price_cents: service?.price_cents ?? 0,
        },
        pricing
      );

      await admin.from("comanda_items").insert({
        comanda_id: comandaId,
        service_id: link.service_id,
        service_name: service?.name ?? "Serviço",
        catalog_price_cents: price,
        charged_price_cents: price,
        sort_order: sortOrder,
        appointment_id: appointmentId,
        professional_id: appointment.professional_id,
      });
      existingKeys.add(key);
      sortOrder += 1;
    }
  }
}

async function refreshLinkedAppointmentItemPrices(
  admin: SupabaseClient,
  comandaId: string,
  serviceDate: string
): Promise<void> {
  const pricing = await loadServicePricingContext(admin, serviceDate);

  const { data: items } = await admin
    .from("comanda_items")
    .select(
      "id, service_id, catalog_price_cents, charged_price_cents, services ( name, price_cents )"
    )
    .eq("comanda_id", comandaId)
    .not("appointment_id", "is", null)
    .eq("is_tip", false);

  for (const item of items ?? []) {
    if (!item.service_id) continue;
    if (item.charged_price_cents !== item.catalog_price_cents) continue;

    const service = Array.isArray(item.services)
      ? item.services[0]
      : item.services;
    if (!service) continue;

    const resolved = resolvePriceCentsOrFallback(
      {
        id: item.service_id,
        name: service.name,
        price_cents: service.price_cents,
      },
      pricing
    );

    if (resolved === item.charged_price_cents) continue;

    await admin
      .from("comanda_items")
      .update({
        catalog_price_cents: resolved,
        charged_price_cents: resolved,
      })
      .eq("id", item.id);
  }
}

async function mergeDuplicateOpenComandas(
  admin: SupabaseClient,
  customerWhatsapp: string,
  serviceDate: string
): Promise<string | null> {
  const { data: openComandas } = await admin
    .from("comandas")
    .select("id, created_at")
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("service_date", serviceDate)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (!openComandas || openComandas.length <= 1) {
    return openComandas?.[0]?.id ?? null;
  }

  const primaryId = openComandas[0].id;
  for (const duplicate of openComandas.slice(1)) {
    const { data: dupLinks } = await admin
      .from("comanda_appointments")
      .select("appointment_id")
      .eq("comanda_id", duplicate.id);

    for (const link of dupLinks ?? []) {
      await linkAppointmentToComanda(admin, primaryId, link.appointment_id);
    }

    const { data: dupItems } = await admin
      .from("comanda_items")
      .select("id")
      .eq("comanda_id", duplicate.id);

    if (dupItems?.length) {
      await admin
        .from("comanda_items")
        .update({ comanda_id: primaryId })
        .eq("comanda_id", duplicate.id);
    }

    await admin.from("comandas").delete().eq("id", duplicate.id);
  }

  return primaryId;
}

type AppointmentTriggerRow = {
  id: string;
  professional_id: string;
  status: string;
  customer_whatsapp: string;
  date: string;
  customer_first_name: string;
  customer_last_name: string;
};

/**
 * Verifica se a comanda aberta já está alinhada com os horários do dia.
 * Se sim, dá para abrir sem o sync completo (muito mais rápido).
 */
async function isOpenComandaReadyToShow(
  admin: SupabaseClient,
  comandaId: string,
  dayIds: string[],
  triggerAppointmentId: string,
  customerWhatsapp: string,
  serviceDate: string
): Promise<boolean> {
  const [{ data: links }, { data: items }, { data: squeezeApts }] =
    await Promise.all([
      admin
        .from("comanda_appointments")
        .select("appointment_id")
        .eq("comanda_id", comandaId),
      admin
        .from("comanda_items")
        .select("appointment_id, squeeze_appointment_id")
        .eq("comanda_id", comandaId),
      admin
        .from("appointments")
        .select("id")
        .eq("customer_whatsapp", customerWhatsapp)
        .eq("date", serviceDate)
        .eq("is_squeeze_in", true)
        .eq("is_comanda_extra", false)
        .in("status", [...ACTIVE_APPOINTMENT_STATUSES]),
    ]);

  const linkedIds = new Set((links ?? []).map((row) => row.appointment_id));
  const daySet = new Set(dayIds);

  for (const id of daySet) {
    if (!linkedIds.has(id)) return false;
  }
  for (const id of linkedIds) {
    if (!daySet.has(id)) return false;
  }

  for (const id of daySet) {
    const hasItem = (items ?? []).some((item) => item.appointment_id === id);
    if (!hasItem) return false;
  }

  if (
    !(items ?? []).some((item) => item.appointment_id === triggerAppointmentId)
  ) {
    return false;
  }

  for (const squeeze of squeezeApts ?? []) {
    const hasItem = (items ?? []).some(
      (item) =>
        item.squeeze_appointment_id === squeeze.id ||
        item.appointment_id === squeeze.id
    );
    if (!hasItem) return false;
  }

  return true;
}

async function syncOpenComandaForCustomerDay(
  admin: SupabaseClient,
  comandaId: string,
  dayIds: string[],
  validDayAppointmentIds: Set<string>,
  customerWhatsapp: string,
  serviceDate: string
): Promise<void> {
  await pruneComandaToDayScope(admin, comandaId, validDayAppointmentIds);

  // Impede gorjeta/produto de horário cancelado de voltar num agendamento novo.
  await purgeOrphanTipsAndProducts(
    admin,
    comandaId,
    validDayAppointmentIds
  );

  if (dayIds.length > 0) {
    await admin.from("comanda_appointments").upsert(
      dayIds.map((appointmentId) => ({
        comanda_id: comandaId,
        appointment_id: appointmentId,
      })),
      { onConflict: "appointment_id" }
    );
  }

  await syncItemsFromLinkedAppointments(
    admin,
    comandaId,
    validDayAppointmentIds
  );

  await refreshLinkedAppointmentItemPrices(admin, comandaId, serviceDate);

  await unlinkSqueezeAppointmentsFromComanda(admin, comandaId);

  await syncManualEncaixeItemsToComanda(
    admin,
    comandaId,
    customerWhatsapp,
    serviceDate
  );

  const totals = await recalculateComandaTotals(admin, comandaId);
  await admin
    .from("comandas")
    .update({
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", comandaId);
}

export async function getOrCreateComandaForAppointment(
  admin: SupabaseClient,
  appointmentId: string,
  knownTrigger?: AppointmentTriggerRow
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const trigger =
    knownTrigger ??
    (
      await admin
        .from("appointments")
        .select(
          "id, professional_id, status, customer_whatsapp, date, customer_first_name, customer_last_name"
        )
        .eq("id", appointmentId)
        .maybeSingle()
    ).data;

  if (!trigger) {
    return { ok: false, error: "Agendamento não encontrado.", status: 404 };
  }

  if (trigger.status === "cancelled") {
    return {
      ok: false,
      error: "Agendamento cancelado não possui comanda.",
      status: 400,
    };
  }

  const { data: dayAppointments } = await admin
    .from("appointments")
    .select("id")
    .eq("customer_whatsapp", trigger.customer_whatsapp)
    .eq("date", trigger.date)
    .eq("is_squeeze_in", false)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES]);

  const dayIds = (dayAppointments ?? []).map((row) => row.id);
  const validDayAppointmentIds = new Set(dayIds);

  let comandaId = await mergeDuplicateOpenComandas(
    admin,
    trigger.customer_whatsapp,
    trigger.date
  );

  if (!comandaId) {
    comandaId = await findOpenComandaIdForCustomerDay(
      admin,
      trigger.customer_whatsapp,
      trigger.date
    );
  }

  if (!comandaId) {
    const { data: byAppointment } = await admin
      .from("comandas")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("service_date", trigger.date)
      .eq("status", "open")
      .maybeSingle();

    comandaId = byAppointment?.id ?? null;
  }

  let justCreated = false;

  if (!comandaId) {
    const { data: created, error } = await admin
      .from("comandas")
      .insert({
        appointment_id: appointmentId,
        professional_id: trigger.professional_id,
        customer_whatsapp: trigger.customer_whatsapp,
        service_date: trigger.date,
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
    comandaId = created.id;
    justCreated = true;
    await seedItemsFromAppointment(admin, created.id, appointmentId);
  }

  if (!comandaId) {
    return {
      ok: false,
      error: "Não foi possível abrir a comanda.",
      status: 500,
    };
  }

  const resolvedComandaId = comandaId;

  // Caminho rápido: comanda já existe e está consistente → só lê.
  if (
    !justCreated &&
    (await isOpenComandaReadyToShow(
      admin,
      resolvedComandaId,
      dayIds,
      appointmentId,
      trigger.customer_whatsapp,
      trigger.date
    ))
  ) {
    return getComandaById(admin, resolvedComandaId, { sync: false });
  }

  await syncOpenComandaForCustomerDay(
    admin,
    resolvedComandaId,
    dayIds,
    validDayAppointmentIds,
    trigger.customer_whatsapp,
    trigger.date
  );

  return getComandaById(admin, resolvedComandaId, { sync: false });
}

/** Itens já vinculados a repasse de comissão não podem ser apagados (FK restrict). */
async function loadPayoutProtectedItemIds(
  admin: SupabaseClient,
  itemIds: string[]
): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const { data } = await admin
    .from("commission_payout_items")
    .select("comanda_item_id")
    .in("comanda_item_id", itemIds);
  return new Set((data ?? []).map((row) => row.comanda_item_id));
}

/** Apaga itens liberados; mantém os que já entraram em repasse de comissão. */
async function deleteComandaItemsSafely(
  admin: SupabaseClient,
  itemIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (itemIds.length === 0) return { ok: true };

  const protectedIds = await loadPayoutProtectedItemIds(admin, itemIds);
  const removableIds = itemIds.filter((id) => !protectedIds.has(id));
  if (removableIds.length === 0) return { ok: true };

  const { error } = await admin
    .from("comanda_items")
    .delete()
    .in("id", removableIds);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível atualizar os itens da comanda.",
    };
  }
  return { ok: true };
}

async function recalculateComandaTotals(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ totalCents: number; commissionCents: number }> {
  const { data: items } = await admin
    .from("comanda_items")
    .select(
      "charged_price_cents, professional_id, is_tip, product_id, commission_percent_snapshot, appointment_id, squeeze_appointment_id"
    )
    .eq("comanda_id", comandaId);

  const relatedIds = [
    ...new Set(
      (items ?? []).flatMap((item) => {
        const ids: string[] = [];
        if (item.appointment_id) ids.push(item.appointment_id);
        if (item.squeeze_appointment_id) ids.push(item.squeeze_appointment_id);
        return ids;
      })
    ),
  ];

  const activeAppointmentIds = new Set<string>();
  if (relatedIds.length > 0) {
    const { data: appointments } = await admin
      .from("appointments")
      .select("id, status")
      .in("id", relatedIds);

    for (const apt of appointments ?? []) {
      if (
        (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
      ) {
        activeAppointmentIds.add(apt.id);
      }
    }
  }

  // Ignora serviço de horário cancelado que não pôde ser apagado (ex.: já teve repasse).
  const billableItems = (items ?? []).filter((item) => {
    if (item.is_tip || item.product_id) return true;
    if (
      item.appointment_id &&
      !activeAppointmentIds.has(item.appointment_id)
    ) {
      return false;
    }
    if (
      item.squeeze_appointment_id &&
      !activeAppointmentIds.has(item.squeeze_appointment_id)
    ) {
      return false;
    }
    return true;
  });

  const professionalIds = [
    ...new Set(
      billableItems
        .map((item) => item.professional_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const commissions = await loadProfessionalCommissions(admin, professionalIds);

  return calculateComandaTotalsByProfessional(
    billableItems.map((item) => ({
      chargedPriceCents: item.charged_price_cents,
      professionalId: item.professional_id,
      isTip: item.is_tip,
      productId: item.product_id,
      commissionPercentSnapshot: item.commission_percent_snapshot,
    })),
    commissions
  );
}

export type ComandaLoadOptions = {
  /** Sincroniza encaixes e recalcula totais (lento). Só use ao criar ou salvar. */
  sync?: boolean;
};

export async function getComandaById(
  admin: SupabaseClient,
  comandaId: string,
  options: ComandaLoadOptions = {}
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const { data } = await admin
    .from("comandas")
    .select(COMANDA_SELECT)
    .eq("id", comandaId)
    .maybeSingle();

  if (!data) {
    return { ok: false, error: "Comanda não encontrada.", status: 404 };
  }

  if (data.status === "open" && options.sync) {
    await syncManualEncaixeItemsToComanda(
      admin,
      comandaId,
      data.customer_whatsapp,
      data.service_date
    );
    await refreshLinkedAppointmentItemPrices(
      admin,
      comandaId,
      data.service_date
    );
    const totals = await recalculateComandaTotals(admin, comandaId);
    await admin
      .from("comandas")
      .update({
        total_cents: totals.totalCents,
        commission_cents: totals.commissionCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", comandaId);

    const { data: refreshed } = await admin
      .from("comandas")
      .select(COMANDA_SELECT)
      .eq("id", comandaId)
      .maybeSingle();

    if (!refreshed) {
      return { ok: false, error: "Comanda não encontrada.", status: 404 };
    }

    const comanda = await resolveComandaDetail(admin, refreshed as DbComandaRow);
    return { ok: true, comanda };
  }

  const comanda = await resolveComandaDetail(admin, data as DbComandaRow);
  return { ok: true, comanda };
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
  const comandas: ComandaDetail[] = [];
  for (const row of data ?? []) {
    comandas.push(await resolveComandaDetail(admin, row as DbComandaRow));
  }
  return comandas;
}

/** Serviços além dos do agendamento principal viram encaixe na agenda. */
export function flagComandaItemsNeedingSqueeze(
  items: Pick<ComandaItemInput, "serviceId">[],
  mainServiceIds: string[]
): boolean[] {
  const pool = new Map<string, number>();
  for (const serviceId of mainServiceIds) {
    pool.set(serviceId, (pool.get(serviceId) ?? 0) + 1);
  }

  return items.map((item) => {
    if (!item.serviceId) return true;
    const remaining = pool.get(item.serviceId) ?? 0;
    if (remaining > 0) {
      pool.set(item.serviceId, remaining - 1);
      return false;
    }
    return true;
  });
}

async function loadServiceDurationsForSync(
  admin: SupabaseClient,
  items: Pick<ComandaItemInput, "serviceId" | "professionalId">[],
  fallbackProfessionalId: string,
  serviceDate: string
): Promise<
  | {
      ok: true;
      durations: Map<string, number>;
      catalogPrices: Map<string, number>;
    }
  | { ok: false; error: string; status: number }
> {
  const uniqueIds = [
    ...new Set(
      items
        .map((item) => item.serviceId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (uniqueIds.length === 0) {
    return {
      ok: true,
      durations: new Map<string, number>(),
      catalogPrices: new Map<string, number>(),
    };
  }
  const { data: foundServices } = await admin
    .from("services")
    .select("id, name, duration_minutes, price_cents, active")
    .in("id", uniqueIds);

  if (!foundServices || foundServices.length !== uniqueIds.length) {
    return {
      ok: false,
      error: "Serviço não encontrado no catálogo.",
      status: 400,
    };
  }

  if (foundServices.some((service) => !service.active)) {
    return {
      ok: false,
      error: "Serviço inativo não pode ir para a agenda.",
      status: 400,
    };
  }

  const checksByProfessional = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.serviceId) continue;
    const proId = item.professionalId ?? fallbackProfessionalId;
    const set = checksByProfessional.get(proId) ?? new Set<string>();
    set.add(item.serviceId);
    checksByProfessional.set(proId, set);
  }

  for (const [professionalId, serviceIds] of checksByProfessional) {
    const { data: links } = await admin
      .from("professional_services")
      .select("service_id")
      .eq("professional_id", professionalId)
      .in("service_id", [...serviceIds]);

    const linkedIds = new Set((links ?? []).map((link) => link.service_id));
    if (![...serviceIds].every((id) => linkedIds.has(id))) {
      return {
        ok: false,
        error: "Esse profissional não faz um dos serviços da comanda.",
        status: 400,
      };
    }
  }

  const pricing = await loadServicePricingContext(
    admin,
    serviceDate,
    foundServices.map((service) => service.id)
  );

  return {
    ok: true,
    durations: new Map(
      foundServices.map((service) => [service.id, service.duration_minutes])
    ),
    catalogPrices: new Map(
      foundServices.map((service) => [
        service.id,
        resolvePriceCentsOrFallback(service, pricing),
      ])
    ),
  };
}

type MainAppointmentRow = {
  id: string;
  date: string;
  start_time: string;
  status: string;
  customer_id: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_whatsapp: string;
  professional_id: string;
};

function squeezeStatusFromMain(mainStatus: string): string {
  if (mainStatus === "cancelled" || mainStatus === "done") {
    return mainStatus;
  }
  if (
    mainStatus === "scheduled" ||
    mainStatus === "confirmed" ||
    mainStatus === "on_site"
  ) {
    return mainStatus;
  }
  return "scheduled";
}

async function upsertSqueezeAppointment(
  admin: SupabaseClient,
  main: MainAppointmentRow,
  professionalId: string,
  serviceId: string,
  durationMinutes: number,
  existingSqueezeId: string | null,
  options: {
    startTime?: string;
    isComandaExtra?: boolean;
  } = {}
): Promise<
  { ok: true; appointmentId: string } | { ok: false; error: string; status: number }
> {
  const startTime = options.startTime ?? formatTime(main.start_time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error:
        "O serviço extra passa da meia-noite. Escolha um horário mais cedo.",
      status: 400,
    };
  }
  const endTime = minutesToTime(endMinutes);
  const status = squeezeStatusFromMain(main.status);
  const startTimeDb = minutesToTime(startMinutes);
  const isComandaExtra = options.isComandaExtra ?? false;

  if (existingSqueezeId) {
    const updateRow: {
      professional_id: string;
      date: string;
      start_time: string;
      end_time: string;
      status: string;
      is_comanda_extra?: boolean;
    } = {
      professional_id: professionalId,
      date: main.date,
      start_time: startTimeDb,
      end_time: endTime,
      status,
    };
    if (options.isComandaExtra !== undefined) {
      updateRow.is_comanda_extra = options.isComandaExtra;
    }

    const { error: updateError } = await admin
      .from("appointments")
      .update(updateRow)
      .eq("id", existingSqueezeId)
      .eq("is_squeeze_in", true);

    if (updateError) {
      return {
        ok: false,
        error: "Não foi possível atualizar o encaixe na agenda.",
        status: 500,
      };
    }

    await admin
      .from("appointment_services")
      .delete()
      .eq("appointment_id", existingSqueezeId);
    const { error: linkError } = await admin
      .from("appointment_services")
      .insert({
        appointment_id: existingSqueezeId,
        service_id: serviceId,
      });

    if (linkError) {
      return {
        ok: false,
        error: "Não foi possível atualizar o serviço do encaixe.",
        status: 500,
      };
    }

    return { ok: true, appointmentId: existingSqueezeId };
  }

  const { data: created, error: createError } = await admin
    .from("appointments")
    .insert({
      professional_id: professionalId,
      customer_id: main.customer_id,
      customer_first_name: main.customer_first_name,
      customer_last_name: main.customer_last_name,
      customer_whatsapp: main.customer_whatsapp,
      date: main.date,
      start_time: startTimeDb,
      end_time: endTime,
      status,
      is_squeeze_in: true,
      is_comanda_extra: isComandaExtra,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return {
      ok: false,
      error: "Não foi possível criar o encaixe na agenda.",
      status: 500,
    };
  }

  const { error: linkError } = await admin.from("appointment_services").insert({
    appointment_id: created.id,
    service_id: serviceId,
  });

  if (linkError) {
    await admin.from("appointments").delete().eq("id", created.id);
    return {
      ok: false,
      error: "Não foi possível vincular o serviço ao encaixe.",
      status: 500,
    };
  }

  // Serviço extra novo na agenda (não é atualização de um encaixe existente)
  // — avisa o barbeiro. Nunca lança exceção.
  await notifyAppointmentCreated(created.id, "comanda_extra");

  return { ok: true, appointmentId: created.id };
}

async function removeSqueezeAppointments(
  admin: SupabaseClient,
  appointmentIds: string[]
): Promise<void> {
  if (appointmentIds.length === 0) return;
  await admin
    .from("appointment_services")
    .delete()
    .in("appointment_id", appointmentIds);
  await admin
    .from("appointments")
    .delete()
    .in("id", appointmentIds)
    .eq("is_squeeze_in", true);
}

function resolvePreviousComandaItem(
  item: ComandaItemInput,
  itemIndex: number,
  previousItems: ComandaItem[],
  previousById: Map<string, ComandaItem>
): ComandaItem | undefined {
  if (item.id) {
    const byId = previousById.get(item.id);
    if (byId) return byId;
  }

  const atIndex = previousItems[itemIndex];
  if (atIndex && atIndex.serviceId === item.serviceId) {
    return atIndex;
  }

  return previousItems.find((prev) => prev.serviceId === item.serviceId);
}

async function resolveMainForComandaItem(
  admin: SupabaseClient,
  item: ComandaItemInput
): Promise<MainAppointmentRow | null> {
  if (!item.appointmentId && !item.professionalId) return null;

  const selectFields =
    "id, date, start_time, status, customer_id, customer_first_name, customer_last_name, customer_whatsapp, professional_id";

  if (item.appointmentId) {
    const { data: byId } = await admin
      .from("appointments")
      .select(selectFields)
      .eq("id", item.appointmentId)
      .eq("is_squeeze_in", false)
      .maybeSingle();

    if (
      byId &&
      (!item.professionalId || byId.professional_id === item.professionalId)
    ) {
      return byId as MainAppointmentRow;
    }

    if (byId && item.professionalId) {
      const { data: byPro } = await admin
        .from("appointments")
        .select(selectFields)
        .eq("professional_id", item.professionalId)
        .eq("customer_whatsapp", byId.customer_whatsapp)
        .eq("date", byId.date)
        .eq("is_squeeze_in", false)
        .in("status", [...ACTIVE_APPOINTMENT_STATUSES])
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (byPro) return byPro as MainAppointmentRow;
    }

    if (byId) return byId as MainAppointmentRow;
  }

  return null;
}

async function recalculateAppointmentEndTime(
  admin: SupabaseClient,
  appointmentId: string
): Promise<void> {
  const { data: apt } = await admin
    .from("appointments")
    .select("start_time")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!apt) return;

  const { data: links } = await admin
    .from("appointment_services")
    .select("services ( duration_minutes )")
    .eq("appointment_id", appointmentId);

  const totalMinutes = (links ?? []).reduce((sum, link) => {
    const service = Array.isArray(link.services)
      ? link.services[0]
      : link.services;
    return sum + (service?.duration_minutes ?? 0);
  }, 0);

  const endTime = minutesToTime(
    timeToMinutes(formatTime(apt.start_time)) + totalMinutes
  );

  await admin
    .from("appointments")
    .update({ end_time: endTime })
    .eq("id", appointmentId);
}

async function syncComandaItemAgendaMoves(
  admin: SupabaseClient,
  comandaId: string,
  items: ComandaItemInput[],
  previousItems: ComandaItem[],
  durations: Map<string, number>
): Promise<
  | { ok: true; appointmentIdsForItems: (string | null)[] }
  | { ok: false; error: string; status: number }
> {
  const appointmentIdsForItems: (string | null)[] = items.map(
    (item) => item.appointmentId ?? null
  );
  const previousById = new Map(previousItems.map((item) => [item.id, item]));

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    if (!item.serviceId) continue;
    const previous = resolvePreviousComandaItem(
      item,
      itemIndex,
      previousItems,
      previousById
    );

    if (!previous?.appointmentId || !item.professionalId) {
      continue;
    }

    const professionalChanged =
      previous.professionalId !== item.professionalId;
    const appointmentChanged =
      Boolean(item.appointmentId) &&
      previous.appointmentId !== item.appointmentId;

    if (!professionalChanged && !appointmentChanged) {
      continue;
    }

    const oldAptId = previous.appointmentId;
    const targetMain = await resolveMainForComandaItem(admin, item);
    if (!targetMain) {
      return {
        ok: false,
        error: "Não foi possível localizar o atendimento do barbeiro escolhido.",
        status: 400,
      };
    }

    const { data: oldApt } = await admin
      .from("appointments")
      .select(
        "id, date, start_time, is_squeeze_in, status, customer_id, customer_first_name, customer_last_name, customer_whatsapp"
      )
      .eq("id", oldAptId)
      .maybeSingle();

    if (!oldApt || oldApt.is_squeeze_in || oldApt.status === "cancelled") {
      continue;
    }

    const { data: oldServiceLinks } = await admin
      .from("appointment_services")
      .select("service_id")
      .eq("appointment_id", oldAptId);

    const oldServiceIds = (oldServiceLinks ?? []).map((link) => link.service_id);
    if (!oldServiceIds.includes(item.serviceId)) {
      continue;
    }

    const durationMinutes = durations.get(item.serviceId) ?? 30;
    const targetStartTime = formatTime(targetMain.start_time);
    const endTime = minutesToTime(
      timeToMinutes(targetStartTime) + durationMinutes
    );

    const onlyServiceOnOld =
      oldServiceIds.length === 1 && oldServiceIds[0] === item.serviceId;

    if (onlyServiceOnOld) {
      const joinExistingSlot = oldAptId !== targetMain.id;
      const { error } = await admin
        .from("appointments")
        .update({
          professional_id: item.professionalId,
          start_time: targetMain.start_time,
          end_time: endTime,
          is_squeeze_in: joinExistingSlot,
        })
        .eq("id", oldAptId);

      if (error) {
        if (error.code === "23P01") {
          return {
            ok: false,
            error: "Esse horário já está ocupado para o barbeiro escolhido.",
            status: 400,
          };
        }
        return {
          ok: false,
          error: "Não foi possível mover o agendamento na agenda.",
          status: 500,
        };
      }

      appointmentIdsForItems[itemIndex] = oldAptId;
      continue;
    }

    await admin
      .from("appointment_services")
      .delete()
      .eq("appointment_id", oldAptId)
      .eq("service_id", item.serviceId);

    const { count } = await admin
      .from("appointment_services")
      .select("service_id", { count: "exact", head: true })
      .eq("appointment_id", oldAptId);

    if (count) {
      await recalculateAppointmentEndTime(admin, oldAptId);
    } else {
      await admin
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", oldAptId);
      await admin
        .from("comanda_appointments")
        .delete()
        .eq("appointment_id", oldAptId);
    }

    const { data: created, error: createError } = await admin
      .from("appointments")
      .insert({
        professional_id: item.professionalId,
        customer_id: oldApt.customer_id,
        customer_first_name: oldApt.customer_first_name,
        customer_last_name: oldApt.customer_last_name,
        customer_whatsapp: oldApt.customer_whatsapp,
        date: oldApt.date,
        start_time: targetMain.start_time,
        end_time: endTime,
        status: targetMain.status,
        is_squeeze_in: false,
      })
      .select("id")
      .single();

    if (createError || !created) {
      if (createError?.code === "23P01") {
        return {
          ok: false,
          error: "Esse horário já está ocupado para o barbeiro escolhido.",
          status: 400,
        };
      }
      return {
        ok: false,
        error: "Não foi possível mover o serviço na agenda.",
        status: 500,
      };
    }

    await admin.from("appointment_services").insert({
      appointment_id: created.id,
      service_id: item.serviceId,
    });

    await linkAppointmentToComanda(admin, comandaId, created.id);

    appointmentIdsForItems[itemIndex] = created.id;
  }

  return { ok: true, appointmentIdsForItems };
}

async function listComandaSqueezeAppointmentIds(
  admin: SupabaseClient,
  comandaId: string
): Promise<string[]> {
  const { data } = await admin
    .from("comanda_items")
    .select("squeeze_appointment_id")
    .eq("comanda_id", comandaId)
    .not("squeeze_appointment_id", "is", null);

  return (data ?? [])
    .map((row) => row.squeeze_appointment_id)
    .filter((id): id is string => Boolean(id));
}

async function syncComandaAddonAppointments(
  admin: SupabaseClient,
  items: ComandaItemInput[],
  previousItems: ComandaItem[],
  durations: Map<string, number>
): Promise<
  | {
      ok: true;
      squeezeIdsForItems: (string | null)[];
      appointmentIdsForItems: (string | null)[];
    }
  | { ok: false; error: string; status: number }
> {
  const squeezeIdsForItems: (string | null)[] = new Array(items.length).fill(
    null
  );
  const appointmentIdsForItems: (string | null)[] = new Array(items.length).fill(
    null
  );
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const keptSqueezeIds = new Set<string>();
  const createdSqueezeIds: string[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    if (!item.serviceId) continue;
    const previous = resolvePreviousComandaItem(
      item,
      itemIndex,
      previousItems,
      previousById
    );

    if (previous?.squeezeAppointmentId && !item.appointmentId) {
      squeezeIdsForItems[itemIndex] = previous.squeezeAppointmentId;
      keptSqueezeIds.add(previous.squeezeAppointmentId);
      continue;
    }

    const isExplicitExtra = Boolean(item.isComandaExtra && item.startTime);

    const main = await resolveMainForComandaItem(admin, item);
    if (!main || main.status === "cancelled") continue;

    const { data: mainLinks } = await admin
      .from("appointment_services")
      .select("service_id")
      .eq("appointment_id", main.id);

    const mainServiceIds = (mainLinks ?? []).map((link) => link.service_id);
    const needsSqueeze =
      isExplicitExtra ||
      Boolean(previous?.squeezeAppointmentId) ||
      flagComandaItemsNeedingSqueeze([item], mainServiceIds)[0];

    if (!needsSqueeze) {
      if (previous?.squeezeAppointmentId) {
        await removeSqueezeAppointments(admin, [previous.squeezeAppointmentId]);
      }
      continue;
    }

    const professionalChanged =
      Boolean(previous?.professionalId) &&
      Boolean(item.professionalId) &&
      previous!.professionalId !== item.professionalId;
    const appointmentChanged =
      Boolean(previous?.appointmentId) &&
      Boolean(item.appointmentId) &&
      previous!.appointmentId !== item.appointmentId;

    let existingSqueezeId = previous?.squeezeAppointmentId ?? null;

    if (professionalChanged || appointmentChanged) {
      if (previous?.squeezeAppointmentId) {
        await removeSqueezeAppointments(admin, [previous.squeezeAppointmentId]);
      }
      existingSqueezeId = null;
    }

    const upsert = await upsertSqueezeAppointment(
      admin,
      main,
      item.professionalId ?? main.professional_id,
      item.serviceId,
      durations.get(item.serviceId) ?? 0,
      existingSqueezeId,
      {
        startTime: item.startTime,
        isComandaExtra: isExplicitExtra ? true : undefined,
      }
    );

    if (!upsert.ok) {
      await removeSqueezeAppointments(admin, createdSqueezeIds);
      return upsert;
    }

    if (!existingSqueezeId) {
      createdSqueezeIds.push(upsert.appointmentId);
    }
    keptSqueezeIds.add(upsert.appointmentId);
    squeezeIdsForItems[itemIndex] = upsert.appointmentId;
    appointmentIdsForItems[itemIndex] = main.id;
  }

  const toRemove = previousItems
    .map((item) => item.squeezeAppointmentId)
    .filter((id): id is string => id != null && !keptSqueezeIds.has(id));

  await removeSqueezeAppointments(admin, toRemove);

  return { ok: true, squeezeIdsForItems, appointmentIdsForItems };
}

async function restoreComandaItems(
  admin: SupabaseClient,
  comandaId: string,
  items: ComandaItem[]
): Promise<void> {
  const { data: existing } = await admin
    .from("comanda_items")
    .select("id")
    .eq("comanda_id", comandaId);

  const keepIds = new Set(items.map((item) => item.id).filter(Boolean));
  const removableIds = (existing ?? [])
    .map((row) => row.id)
    .filter((id) => !keepIds.has(id));
  await deleteComandaItemsSafely(admin, removableIds);

  if (items.length > 0) {
    const existingIds = new Set((existing ?? []).map((row) => row.id));
    const toInsert = items.filter((item) => !existingIds.has(item.id));
    const toUpdate = items.filter((item) => existingIds.has(item.id));

    for (const item of toUpdate) {
      await admin
        .from("comanda_items")
        .update({
          service_id: item.serviceId,
          product_id: item.productId,
          service_name: item.serviceName,
          catalog_price_cents: item.catalogPriceCents,
          charged_price_cents: item.chargedPriceCents,
          quantity: item.quantity,
          commission_percent_snapshot: item.commissionPercentSnapshot,
          squeeze_appointment_id: item.squeezeAppointmentId,
          appointment_id: item.appointmentId,
          professional_id: item.professionalId,
          is_tip: item.isTip,
        })
        .eq("id", item.id);
    }

    if (toInsert.length > 0) {
      await admin.from("comanda_items").insert(
        toInsert.map((item, index) => ({
          id: item.id,
          comanda_id: comandaId,
          service_id: item.serviceId,
          product_id: item.productId,
          service_name: item.serviceName,
          catalog_price_cents: item.catalogPriceCents,
          charged_price_cents: item.chargedPriceCents,
          quantity: item.quantity,
          commission_percent_snapshot: item.commissionPercentSnapshot,
          sort_order: index,
          squeeze_appointment_id: item.squeezeAppointmentId,
          appointment_id: item.appointmentId,
          professional_id: item.professionalId,
          is_tip: item.isTip,
        }))
      );
    }
  }

  const totals = await recalculateComandaTotals(admin, comandaId);

  await admin
    .from("comandas")
    .update({
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", comandaId);
}

type ProductRowForComanda = {
  id: string;
  name: string;
  price_cents: number;
  commission_percent: number;
  active: boolean;
};

async function loadProductsForComandaItems(
  admin: SupabaseClient,
  productItems: ComandaItemInput[]
): Promise<
  | { ok: true; products: Map<string, ProductRowForComanda> }
  | { ok: false; error: string; status: number }
> {
  const ids = [
    ...new Set(
      productItems
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (ids.length === 0) {
    return { ok: true, products: new Map() };
  }

  const { data, error } = await admin
    .from("products")
    .select("id, name, price_cents, commission_percent, active")
    .in("id", ids);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível carregar os produtos.",
      status: 500,
    };
  }

  const products = new Map((data ?? []).map((row) => [row.id, row]));
  for (const id of ids) {
    const product = products.get(id);
    if (!product) {
      return { ok: false, error: "Produto não encontrado.", status: 400 };
    }
    if (!product.active) {
      return {
        ok: false,
        error: `O produto "${product.name}" está inativo.`,
        status: 400,
      };
    }
  }

  return { ok: true, products };
}

async function listComandaProductQuantities(
  admin: SupabaseClient,
  comandaId: string
): Promise<Map<string, number>> {
  const { data } = await admin
    .from("comanda_items")
    .select("product_id, quantity")
    .eq("comanda_id", comandaId)
    .not("product_id", "is", null);

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.product_id) continue;
    totals.set(
      row.product_id,
      (totals.get(row.product_id) ?? 0) + (row.quantity ?? 1)
    );
  }
  return totals;
}

async function validateProductStockForClose(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const required = await listComandaProductQuantities(admin, comandaId);
  if (required.size === 0) return { ok: true };

  const { data: products, error } = await admin
    .from("products")
    .select("id, name, stock_quantity")
    .in("id", [...required.keys()]);

  if (error) {
    return {
      ok: false,
      error: "Não foi possível conferir o estoque.",
      status: 500,
    };
  }

  const stockById = new Map(
    (products ?? []).map((row) => [row.id, row] as const)
  );

  for (const [productId, quantity] of required) {
    const product = stockById.get(productId);
    if (!product) {
      return { ok: false, error: "Produto não encontrado.", status: 400 };
    }
    if (product.stock_quantity < quantity) {
      return {
        ok: false,
        error: `Estoque insuficiente para "${product.name}" (disponível: ${product.stock_quantity}).`,
        status: 400,
      };
    }
  }

  return { ok: true };
}

async function deductProductStockForComanda(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const required = await listComandaProductQuantities(admin, comandaId);
  if (required.size === 0) return { ok: true };

  for (const [productId, quantity] of required) {
    const { data: product } = await admin
      .from("products")
      .select("id, name, stock_quantity")
      .eq("id", productId)
      .maybeSingle();

    if (!product) {
      return { ok: false, error: "Produto não encontrado.", status: 400 };
    }

    if (product.stock_quantity < quantity) {
      return {
        ok: false,
        error: `Estoque insuficiente para "${product.name}".`,
        status: 400,
      };
    }

    const { data: updated, error } = await admin
      .from("products")
      .update({
        stock_quantity: product.stock_quantity - quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("stock_quantity", product.stock_quantity)
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return {
        ok: false,
        error: `Não foi possível baixar o estoque de "${product.name}".`,
        status: 409,
      };
    }
  }

  return { ok: true };
}

async function restoreProductStockForComanda(
  admin: SupabaseClient,
  comandaId: string
): Promise<void> {
  const required = await listComandaProductQuantities(admin, comandaId);
  if (required.size === 0) return;

  for (const [productId, quantity] of required) {
    const { data: product } = await admin
      .from("products")
      .select("stock_quantity")
      .eq("id", productId)
      .maybeSingle();

    if (!product) continue;

    await admin
      .from("products")
      .update({
        stock_quantity: product.stock_quantity + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);
  }
}

export async function updateComandaItems(
  admin: SupabaseClient,
  comandaId: string,
  items: ComandaItemInput[]
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const current = await getComandaById(admin, comandaId, { sync: false });
  if (!current.ok) return current;

  if (current.comanda.status !== "open") {
    return {
      ok: false,
      error: "Comanda fechada não pode ser editada. Reabra antes.",
      status: 409,
    };
  }

  const serviceItems = items.filter(
    (item) => !item.isTip && !item.productId
  );
  const productItems = items.filter((item) => !item.isTip && item.productId);
  const tipItems = items.filter((item) => item.isTip);

  if (serviceItems.length === 0 && productItems.length === 0) {
    return {
      ok: false,
      error: "Informe ao menos um serviço ou produto na comanda.",
      status: 400,
    };
  }

  for (const item of items) {
    if (item.chargedPriceCents < 0) {
      return { ok: false, error: "Valor cobrado inválido.", status: 400 };
    }
  }

  for (const product of productItems) {
    if (!product.professionalId) {
      return {
        ok: false,
        error: "Escolha o barbeiro que vendeu o produto.",
        status: 400,
      };
    }
    const qty = product.quantity ?? 1;
    if (qty < 1) {
      return {
        ok: false,
        error: "Quantidade de produto inválida.",
        status: 400,
      };
    }
  }

  for (const tip of tipItems) {
    if (!tip.professionalId) {
      return {
        ok: false,
        error: "Escolha o barbeiro que recebe a gorjeta.",
        status: 400,
      };
    }
    if (tip.chargedPriceCents < 1) {
      return {
        ok: false,
        error: "Informe um valor de gorjeta válido.",
        status: 400,
      };
    }
  }

  const previousItems = current.comanda.items;

  const productsResult = await loadProductsForComandaItems(admin, productItems);
  if (!productsResult.ok) return productsResult;

  const durationsResult = await loadServiceDurationsForSync(
    admin,
    serviceItems,
    current.comanda.professionalId,
    current.comanda.serviceDate
  );
  if (!durationsResult.ok) return durationsResult;

  const previousServiceItems = previousItems.filter(
    (item) => !item.isTip && !item.productId
  );

  const agendaMoveResult = await syncComandaItemAgendaMoves(
    admin,
    comandaId,
    serviceItems,
    previousServiceItems,
    durationsResult.durations
  );
  if (!agendaMoveResult.ok) return agendaMoveResult;

  const itemsForAgendaSync = serviceItems.map((item, index) => ({
    ...item,
    appointmentId:
      agendaMoveResult.appointmentIdsForItems[index] ??
      item.appointmentId,
  }));

  const syncResult = await syncComandaAddonAppointments(
    admin,
    itemsForAgendaSync,
    previousServiceItems,
    durationsResult.durations
  );

  if (!syncResult.ok) {
    return syncResult;
  }

  const { data: existingRows } = await admin
    .from("comanda_items")
    .select("id")
    .eq("comanda_id", comandaId);
  const existingIds = (existingRows ?? []).map((row) => row.id);
  const protectedIds = await loadPayoutProtectedItemIds(admin, existingIds);

  // Não apaga itens que já entraram em repasse de comissão (FK restrict).
  const removableIds = existingIds.filter((id) => !protectedIds.has(id));
  const deleteResult = await deleteComandaItemsSafely(admin, removableIds);
  if (!deleteResult.ok) {
    return { ok: false, error: deleteResult.error, status: 500 };
  }

  const previousById = new Map(previousItems.map((item) => [item.id, item]));

  const serviceInsertRows = serviceItems.map((item, index) => {
    const previous =
      (item.id ? previousById.get(item.id) : undefined) ??
      previousServiceItems[index];
    const preferredId = item.id ?? crypto.randomUUID();
    return {
      id: protectedIds.has(preferredId) ? crypto.randomUUID() : preferredId,
      comanda_id: comandaId,
      service_id: item.serviceId ?? null,
      product_id: null,
      service_name: item.serviceName,
      catalog_price_cents:
        durationsResult.catalogPrices.get(item.serviceId ?? "") ??
        item.catalogPriceCents,
      charged_price_cents: item.chargedPriceCents,
      quantity: 1,
      commission_percent_snapshot: null,
      sort_order: index,
      is_tip: false,
      squeeze_appointment_id:
        syncResult.squeezeIdsForItems[index] ??
        previous?.squeezeAppointmentId ??
        null,
      appointment_id:
        agendaMoveResult.appointmentIdsForItems[index] ??
        syncResult.appointmentIdsForItems[index] ??
        item.appointmentId ??
        null,
      professional_id: item.professionalId ?? null,
    };
  });

  const productInsertRows = productItems.map((item, index) => {
    const product = productsResult.products.get(item.productId!)!;
    const qty = item.quantity ?? 1;
    const unitPrice = item.catalogPriceCents || product.price_cents;
    const lineTotal =
      item.chargedPriceCents > 0 ? item.chargedPriceCents : unitPrice * qty;
    const preferredId = item.id ?? crypto.randomUUID();
    return {
      id: protectedIds.has(preferredId) ? crypto.randomUUID() : preferredId,
      comanda_id: comandaId,
      service_id: null,
      product_id: item.productId,
      service_name: product.name,
      catalog_price_cents: unitPrice,
      charged_price_cents: lineTotal,
      quantity: qty,
      commission_percent_snapshot:
        item.commissionPercent ?? product.commission_percent,
      sort_order: serviceItems.length + index,
      is_tip: false,
      squeeze_appointment_id: null,
      appointment_id: null,
      professional_id: item.professionalId ?? null,
    };
  });

  const tipInsertRows = tipItems.map((item, index) => {
    const preferredId = item.id ?? crypto.randomUUID();
    return {
      id: protectedIds.has(preferredId) ? crypto.randomUUID() : preferredId,
      comanda_id: comandaId,
      service_id: null,
      product_id: null,
      service_name: item.serviceName,
      catalog_price_cents: item.chargedPriceCents,
      charged_price_cents: item.chargedPriceCents,
      quantity: 1,
      commission_percent_snapshot: null,
      sort_order: serviceItems.length + productItems.length + index,
      is_tip: true,
      squeeze_appointment_id: null,
      appointment_id: null,
      professional_id: item.professionalId ?? null,
    };
  });

  const insertRows = [
    ...serviceInsertRows,
    ...productInsertRows,
    ...tipInsertRows,
  ];

  const { error: insertError } = await admin
    .from("comanda_items")
    .insert(insertRows);

  if (insertError) {
    await restoreComandaItems(admin, comandaId, previousItems);
    await removeSqueezeAppointments(
      admin,
      syncResult.squeezeIdsForItems.filter((id): id is string => Boolean(id))
    );
    return {
      ok: false,
      error: "Não foi possível atualizar os itens da comanda.",
      status: 500,
    };
  }

  await unlinkSqueezeAppointmentsFromComanda(admin, comandaId);

  const totals = await recalculateComandaTotals(admin, comandaId);

  await admin
    .from("comandas")
    .update({
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", comandaId);

  return getComandaById(admin, comandaId, { sync: false });
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

export type CreditDepositInput = {
  amountCents: number;
  paymentMethod: CashInflowPaymentMethod;
};

export type CloseComandaOptions = {
  creditDeposits?: CreditDepositInput[];
};

export async function closeComanda(
  admin: SupabaseClient,
  comandaId: string,
  payments: ComandaPaymentInput[],
  closedByUserId: string,
  options: CloseComandaOptions = {}
): Promise<{ ok: true; comanda: ComandaDetail } | { ok: false; error: string; status: number }> {
  const current = await getComandaById(admin, comandaId);
  if (!current.ok) return current;

  if (current.comanda.status === "closed") {
    return { ok: false, error: "Esta comanda já está fechada.", status: 409 };
  }

  // Limpa itens de horário cancelado antes de validar total x pagamento.
  await scrubInactiveAppointmentItemsFromOpenComanda(admin, comandaId);

  const refreshed = await getComandaById(admin, comandaId, { sync: false });
  if (!refreshed.ok) return refreshed;
  const comanda = refreshed.comanda;

  const activeLinked = comanda.linkedAppointments.filter((apt) =>
    (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
  );

  if (
    comanda.linkedAppointments.length > 0 &&
    activeLinked.length === 0
  ) {
    return {
      ok: false,
      error: "Agendamento cancelado não pode ser fechado.",
      status: 409,
    };
  }

  if (comanda.items.filter((item) => !item.isTip).length === 0) {
    return {
      ok: false,
      error: "Adicione ao menos um serviço ou produto antes de fechar.",
      status: 400,
    };
  }

  const stockCheck = await validateProductStockForClose(admin, comandaId);
  if (!stockCheck.ok) return stockCheck;

  // Total ao vivo dos itens restantes (não o total_cents antigo da linha).
  const liveTotals = await recalculateComandaTotals(admin, comandaId);
  const paymentError = validatePayments(payments, liveTotals.totalCents);
  if (paymentError) {
    return { ok: false, error: paymentError, status: 400 };
  }

  const storeCreditCents = payments
    .filter((payment) => payment.paymentMethod === "store_credit")
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  if (storeCreditCents > 0) {
    const balance = await getCustomerCreditBalanceByWhatsapp(
      admin,
      comanda.customerWhatsapp
    );
    if (balance < storeCreditCents) {
      return {
        ok: false,
        error: "Saldo de crédito insuficiente para fechar a comanda.",
        status: 400,
      };
    }
  }

  const creditDeposits = (options.creditDeposits ?? []).filter(
    (deposit) => deposit.amountCents > 0
  );

  const customerId =
    storeCreditCents > 0 || creditDeposits.length > 0
      ? await resolveCustomerIdByWhatsapp(admin, comanda.customerWhatsapp)
      : null;

  if ((storeCreditCents > 0 || creditDeposits.length > 0) && !customerId) {
    return {
      ok: false,
      error: "Cliente não encontrado para movimentar o crédito.",
      status: 400,
    };
  }

  const cashCheck = await assertComandaClosableInOpenCashRegister(
    admin,
    comanda.serviceDate
  );
  if (!cashCheck.ok) {
    return { ok: false, error: cashCheck.error, status: cashCheck.status };
  }

  const totals = await recalculateComandaTotals(admin, comandaId);
  const commissionPercentSnapshot =
    totals.totalCents > 0
      ? Math.round((totals.commissionCents / totals.totalCents) * 100)
      : 50;

  const stockDeduct = await deductProductStockForComanda(admin, comandaId);
  if (!stockDeduct.ok) return stockDeduct;

  const now = new Date().toISOString();
  const closedBy =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      closedByUserId
    )
      ? closedByUserId
      : null;

  let deductedStoreCredit = false;
  if (storeCreditCents > 0 && customerId) {
    const deductResult = await deductCustomerCredit(admin, {
      customerId,
      amountCents: storeCreditCents,
      comandaId,
      createdBy: closedBy,
    });
    if (!deductResult.ok) {
      return { ok: false, error: deductResult.error, status: 400 };
    }
    deductedStoreCredit = true;
  }

  const { error: payError } = await admin.from("comanda_payments").insert(
    payments.map((p) => ({
      comanda_id: comandaId,
      payment_method: p.paymentMethod,
      amount_cents: p.amountCents,
    }))
  );

  if (payError) {
    await restoreProductStockForComanda(admin, comandaId);
    if (deductedStoreCredit) {
      await reverseComandaCreditTransactions(admin, comandaId);
    }
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
      commission_percent_snapshot: commissionPercentSnapshot,
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      closed_at: now,
      closed_by: closedBy,
      cash_register_session_id: cashCheck.sessionId,
      updated_at: now,
    })
    .eq("id", comandaId);

  if (comandaError) {
    await restoreProductStockForComanda(admin, comandaId);
    await admin.from("comanda_payments").delete().eq("comanda_id", comandaId);
    if (deductedStoreCredit) {
      await reverseComandaCreditTransactions(admin, comandaId);
    }
    return {
      ok: false,
      error: "Não foi possível fechar a comanda.",
      status: 500,
    };
  }

  const linkedIds = comanda.linkedAppointments.map((apt) => apt.id);
  if (linkedIds.length > 0) {
    await admin
      .from("appointments")
      .update({ status: "done" })
      .in("id", linkedIds);
  } else if (comanda.appointmentId) {
    await admin
      .from("appointments")
      .update({ status: "done" })
      .eq("id", comanda.appointmentId);
  }

  const squeezeIds = await listComandaSqueezeAppointmentIds(admin, comandaId);
  if (squeezeIds.length > 0) {
    await admin
      .from("appointments")
      .update({ status: "done" })
      .in("id", squeezeIds)
      .eq("is_squeeze_in", true);
  }

  // A comanda já está fechada neste ponto (não há mais como desfazer o
  // fechamento). Falha ao registrar o depósito de crédito não deve fazer
  // a função retornar erro — isso faria a tela achar que o fechamento
  // falhou, quando na verdade a comanda já foi fechada normalmente.
  if (creditDeposits.length > 0 && customerId) {
    for (const deposit of creditDeposits) {
      const addResult = await addCustomerCredit(admin, {
        customerId,
        amountCents: deposit.amountCents,
        paymentMethod: deposit.paymentMethod,
        comandaId,
        cashRegisterSessionId: cashCheck.sessionId,
        createdBy: closedBy,
      });
      if (!addResult.ok) {
        console.error(
          `Falha ao registrar depósito de crédito da comanda ${comandaId}:`,
          addResult.error
        );
      }
    }
  }

  return getComandaById(admin, comandaId, { sync: false });
}

/** Remove comandas abertas duplicadas do mesmo cliente/dia antes de reabrir. */
async function absorbConflictingOpenComandas(
  admin: SupabaseClient,
  targetComandaId: string,
  customerWhatsapp: string,
  serviceDate: string
): Promise<void> {
  const { data: conflicts } = await admin
    .from("comandas")
    .select("id")
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("service_date", serviceDate)
    .eq("status", "open")
    .neq("id", targetComandaId);

  for (const { id: otherId } of conflicts ?? []) {
    const { data: dupLinks } = await admin
      .from("comanda_appointments")
      .select("appointment_id")
      .eq("comanda_id", otherId);

    for (const link of dupLinks ?? []) {
      await linkAppointmentToComanda(admin, targetComandaId, link.appointment_id);
    }

    await admin
      .from("comanda_items")
      .update({ comanda_id: targetComandaId })
      .eq("comanda_id", otherId);

    await admin.from("comanda_payments").delete().eq("comanda_id", otherId);
    await admin.from("comanda_appointments").delete().eq("comanda_id", otherId);
    await admin.from("comandas").delete().eq("id", otherId);
  }
}

export type ReopenComandaResult =
  | { ok: true; comanda: ComandaDetail }
  | {
      ok: false;
      error: string;
      status: number;
      code?: "credit_shortfall";
      shortfallCents?: number;
    };

export async function reopenComanda(
  admin: SupabaseClient,
  comandaId: string,
  options?: { confirmCreditShortfall?: boolean }
): Promise<ReopenComandaResult> {
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

  const { validateAdminAppointmentSlot } = await import("@/lib/get-availability");

  for (const linked of comanda.linkedAppointments) {
    if (linked.status !== "done" || linked.isSqueezeIn) continue;

    const { data: appointment } = await admin
      .from("appointments")
      .select("date, start_time, end_time, professional_id")
      .eq("id", linked.id)
      .maybeSingle();

    if (!appointment) continue;

    const durationMinutes =
      timeToMinutes(formatTime(appointment.end_time)) -
      timeToMinutes(formatTime(appointment.start_time));

    const slotCheck = await validateAdminAppointmentSlot(
      appointment.professional_id,
      appointment.date,
      formatTime(appointment.start_time),
      durationMinutes,
      linked.id,
      { skipScheduleBlocks: true }
    );

    if (!slotCheck.ok) {
      return {
        ok: false,
        error:
          "Outro agendamento ocupou esse horário enquanto a comanda estava fechada. Ajuste a agenda antes de reabrir.",
        status: 409,
      };
    }
  }

  await absorbConflictingOpenComandas(
    admin,
    comandaId,
    comanda.customerWhatsapp,
    comanda.serviceDate
  );

  const creditCheck = await canReverseComandaCreditTransactions(admin, comandaId);
  if (!creditCheck.ok) {
    if (
      creditCheck.code === "credit_shortfall" &&
      !options?.confirmCreditShortfall
    ) {
      return {
        ok: false,
        error: creditCheck.error,
        status: 409,
        code: "credit_shortfall",
        shortfallCents: creditCheck.shortfallCents,
      };
    }

    if (
      creditCheck.code !== "credit_shortfall" ||
      !options?.confirmCreditShortfall
    ) {
      return { ok: false, error: creditCheck.error, status: 400 };
    }
  }

  const customerId = await resolveCustomerIdByWhatsapp(
    admin,
    comanda.customerWhatsapp
  );

  const creditReverse = await reverseComandaCreditTransactions(admin, comandaId, {
    allowShortfall: Boolean(options?.confirmCreditShortfall),
    customerId,
  });
  if (!creditReverse.ok) {
    return { ok: false, error: creditReverse.error, status: 400 };
  }

  await restoreProductStockForComanda(admin, comandaId);

  await admin.from("comanda_payments").delete().eq("comanda_id", comandaId);

  const totals = await recalculateComandaTotals(admin, comandaId);
  const now = new Date().toISOString();

  const { error } = await admin
    .from("comandas")
    .update({
      status: "open",
      commission_percent_snapshot: null,
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      closed_at: null,
      closed_by: null,
      cash_register_session_id: null,
      updated_at: now,
    })
    .eq("id", comandaId);

  if (error) {
    const isDuplicateOpen =
      error.code === "23505" ||
      error.message?.includes("comandas_open_customer_day_idx");
    return {
      ok: false,
      error: isDuplicateOpen
        ? "Ainda existe outra comanda aberta para este cliente hoje. Recarregue a página e tente de novo."
        : "Não foi possível reabrir a comanda.",
      status: 500,
    };
  }

  for (const linked of comanda.linkedAppointments) {
    if (linked.status !== "done") continue;

    await admin
      .from("appointments")
      .update({ status: "scheduled" })
      .eq("id", linked.id);
  }

  const squeezeIds = await listComandaSqueezeAppointmentIds(admin, comandaId);
  if (squeezeIds.length > 0) {
    await admin
      .from("appointments")
      .update({ status: "scheduled" })
      .in("id", squeezeIds)
      .eq("is_squeeze_in", true);
  }

  return getComandaById(admin, comandaId, { sync: false });
}
