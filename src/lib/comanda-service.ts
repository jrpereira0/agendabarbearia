import type { SupabaseClient } from "@supabase/supabase-js";
import { minutesToTime, timeToMinutes } from "@/lib/availability";
import { formatTime } from "@/lib/format";
import {
  calculateComandaTotals,
  calculateComandaTotalsByProfessional,
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
    service_name: string;
    catalog_price_cents: number;
    charged_price_cents: number;
    sort_order: number;
    squeeze_appointment_id: string | null;
    appointment_id: string | null;
    professional_id: string | null;
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
    service_name,
    catalog_price_cents,
    charged_price_cents,
    sort_order,
    squeeze_appointment_id,
    appointment_id,
    professional_id,
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
      if (
        item.squeeze_appointment_id &&
        validSqueezeAppointmentIds.has(item.squeeze_appointment_id)
      ) {
        return true;
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
        serviceName: item.service_name,
        catalogPriceCents: item.catalog_price_cents,
        chargedPriceCents: item.charged_price_cents,
        sortOrder: item.sort_order,
        squeezeAppointmentId: item.squeeze_appointment_id,
        appointmentId: item.appointment_id,
        professionalId: item.professional_id,
        professionalNickname: itemPro?.nickname ?? "—",
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
  serviceDate: string
): Promise<ComandaLinkedAppointment[]> {
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
      professionals ( nickname )
    `
    )
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("date", serviceDate)
    .eq("is_squeeze_in", true)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES]);

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
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime, "pt-BR"));
}

async function syncManualEncaixeItemsToComanda(
  admin: SupabaseClient,
  comandaId: string,
  customerWhatsapp: string,
  serviceDate: string
): Promise<void> {
  const { data: squeezeApts } = await admin
    .from("appointments")
    .select("id, professional_id")
    .eq("customer_whatsapp", customerWhatsapp)
    .eq("date", serviceDate)
    .eq("is_squeeze_in", true)
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

  for (const apt of squeezeApts) {
    const { data: services } = await admin
      .from("appointment_services")
      .select("service_id, services ( name, price_cents )")
      .eq("appointment_id", apt.id);

    for (const link of services ?? []) {
      const squeezeKey = `${apt.id}:${link.service_id}`;
      const aptKey = `apt:${apt.id}:${link.service_id}`;
      if (coveredKeys.has(squeezeKey) || coveredKeys.has(aptKey)) continue;

      const service = Array.isArray(link.services)
        ? link.services[0]
        : link.services;
      const price = service?.price_cents ?? 0;

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
  const linkedFromJunction = await loadLinkedAppointments(
    admin,
    row.id,
    row.service_date
  );
  const dayEncaixes = await loadCustomerDayEncaixes(
    admin,
    row.customer_whatsapp,
    row.service_date
  );

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
  return mapComandaRow(row, linkedAppointments, validAppointmentIds, {
    customerFirstName: apt?.customer_first_name ?? "",
    customerLastName: apt?.customer_last_name ?? "",
    customerWhatsapp: row.customer_whatsapp,
    validSqueezeAppointmentIds,
  });
}

async function seedItemsFromAppointment(
  admin: SupabaseClient,
  comandaId: string,
  appointmentId: string,
  sortOrderStart = 0
): Promise<number> {
  const { data: appointment } = await admin
    .from("appointments")
    .select("professional_id")
    .eq("id", appointmentId)
    .maybeSingle();

  const { data: links } = await admin
    .from("appointment_services")
    .select("service_id, services ( name, price_cents )")
    .eq("appointment_id", appointmentId);

  if (!links?.length || !appointment) return sortOrderStart;

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
      sort_order: sortOrderStart + index,
      appointment_id: appointmentId,
      professional_id: appointment.professional_id,
    };
  });

  await admin.from("comanda_items").insert(rows);
  return sortOrderStart + rows.length;
}

/** Remove vínculos e itens de agendamentos que não são do dia da comanda. */
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

  const staleItemIds = (items ?? [])
    .filter(
      (item) =>
        item.appointment_id && !validAppointmentIds.has(item.appointment_id)
    )
    .map((item) => item.id);

  if (staleItemIds.length > 0) {
    await admin.from("comanda_items").delete().in("id", staleItemIds);
  }
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
      .select("service_id, services ( name, price_cents )")
      .eq("appointment_id", appointmentId);

    for (const link of services ?? []) {
      const key = `${appointmentId}:${link.service_id}`;
      if (existingKeys.has(key)) continue;

      const service = Array.isArray(link.services)
        ? link.services[0]
        : link.services;
      const price = service?.price_cents ?? 0;

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

export async function getOrCreateComandaForAppointment(
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
    const { data: byAppointment } = await admin
      .from("comandas")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("service_date", trigger.date)
      .eq("status", "open")
      .maybeSingle();

    comandaId = byAppointment?.id ?? null;
  }

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

  await pruneComandaToDayScope(
    admin,
    resolvedComandaId,
    validDayAppointmentIds
  );

  for (const id of dayIds) {
    await linkAppointmentToComanda(admin, resolvedComandaId, id);
  }

  await syncItemsFromLinkedAppointments(
    admin,
    resolvedComandaId,
    validDayAppointmentIds
  );

  await unlinkSqueezeAppointmentsFromComanda(admin, resolvedComandaId);

  await syncManualEncaixeItemsToComanda(
    admin,
    resolvedComandaId,
    trigger.customer_whatsapp,
    trigger.date
  );

  const totals = await recalculateComandaTotals(admin, resolvedComandaId);
  await admin
    .from("comandas")
    .update({
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resolvedComandaId);

  return getComandaById(admin, resolvedComandaId);
}

async function recalculateComandaTotals(
  admin: SupabaseClient,
  comandaId: string
): Promise<{ totalCents: number; commissionCents: number }> {
  const { data: items } = await admin
    .from("comanda_items")
    .select("charged_price_cents, professional_id")
    .eq("comanda_id", comandaId);

  const professionalIds = [
    ...new Set(
      (items ?? [])
        .map((item) => item.professional_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const commissions = await loadProfessionalCommissions(admin, professionalIds);

  return calculateComandaTotalsByProfessional(
    (items ?? []).map((item) => ({
      chargedPriceCents: item.charged_price_cents,
      professionalId: item.professional_id,
    })),
    commissions
  );
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

  if (data.status === "open") {
    await syncManualEncaixeItemsToComanda(
      admin,
      comandaId,
      data.customer_whatsapp,
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
  fallbackProfessionalId: string
): Promise<
  | { ok: true; durations: Map<string, number> }
  | { ok: false; error: string; status: number }
> {
  const uniqueIds = [...new Set(items.map((item) => item.serviceId))];
  const { data: foundServices } = await admin
    .from("services")
    .select("id, duration_minutes, active")
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

  return {
    ok: true,
    durations: new Map(
      foundServices.map((service) => [service.id, service.duration_minutes])
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
  existingSqueezeId: string | null
): Promise<
  { ok: true; appointmentId: string } | { ok: false; error: string; status: number }
> {
  const startTime = formatTime(main.start_time);
  const endMinutes = timeToMinutes(startTime) + durationMinutes;
  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error:
        "O serviço extra passa da meia-noite. Remova-o ou ajuste o horário do agendamento.",
      status: 400,
    };
  }
  const endTime = minutesToTime(endMinutes);
  const status = squeezeStatusFromMain(main.status);

  if (existingSqueezeId) {
    const { error: updateError } = await admin
      .from("appointments")
      .update({
        professional_id: professionalId,
        date: main.date,
        start_time: main.start_time,
        end_time: endTime,
        status,
      })
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
      start_time: main.start_time,
      end_time: endTime,
      status,
      is_squeeze_in: true,
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

  return { ok: true, appointmentId: created.id };
}

async function cancelSqueezeAppointments(
  admin: SupabaseClient,
  appointmentIds: string[]
): Promise<void> {
  if (appointmentIds.length === 0) return;
  await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .in("id", appointmentIds)
    .eq("is_squeeze_in", true);
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

    const main = await resolveMainForComandaItem(admin, item);
    if (!main || main.status === "cancelled") continue;

    const { data: mainLinks } = await admin
      .from("appointment_services")
      .select("service_id")
      .eq("appointment_id", main.id);

    const mainServiceIds = (mainLinks ?? []).map((link) => link.service_id);
    const needsSqueeze = flagComandaItemsNeedingSqueeze(
      [item],
      mainServiceIds
    )[0];

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
      existingSqueezeId
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
  await admin.from("comanda_items").delete().eq("comanda_id", comandaId);

  if (items.length > 0) {
    await admin.from("comanda_items").insert(
      items.map((item, index) => ({
        id: item.id,
        comanda_id: comandaId,
        service_id: item.serviceId,
        service_name: item.serviceName,
        catalog_price_cents: item.catalogPriceCents,
        charged_price_cents: item.chargedPriceCents,
        sort_order: index,
        squeeze_appointment_id: item.squeezeAppointmentId,
        appointment_id: item.appointmentId,
        professional_id: item.professionalId,
      }))
    );
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

  const previousItems = current.comanda.items;

  const durationsResult = await loadServiceDurationsForSync(
    admin,
    items,
    current.comanda.professionalId
  );
  if (!durationsResult.ok) return durationsResult;

  const agendaMoveResult = await syncComandaItemAgendaMoves(
    admin,
    comandaId,
    items,
    previousItems,
    durationsResult.durations
  );
  if (!agendaMoveResult.ok) return agendaMoveResult;

  const itemsForAgendaSync = items.map((item, index) => ({
    ...item,
    appointmentId:
      agendaMoveResult.appointmentIdsForItems[index] ??
      item.appointmentId,
  }));

  const syncResult = await syncComandaAddonAppointments(
    admin,
    itemsForAgendaSync,
    previousItems,
    durationsResult.durations
  );

  if (!syncResult.ok) {
    return syncResult;
  }

  await admin.from("comanda_items").delete().eq("comanda_id", comandaId);

  const previousById = new Map(previousItems.map((item) => [item.id, item]));

  const insertRows = items.map((item, index) => {
    const previous =
      (item.id ? previousById.get(item.id) : undefined) ??
      previousItems[index];
    return {
      id: item.id ?? crypto.randomUUID(),
      comanda_id: comandaId,
      service_id: item.serviceId,
      service_name: item.serviceName,
      catalog_price_cents: item.catalogPriceCents,
      charged_price_cents: item.chargedPriceCents,
      sort_order: index,
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
      error: "Não foi possível atualizar os serviços.",
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

  if (
    comanda.linkedAppointments.length > 0 &&
    comanda.linkedAppointments.every((apt) => apt.status === "cancelled")
  ) {
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

  const totals = await recalculateComandaTotals(admin, comandaId);
  const commissionPercentSnapshot =
    totals.totalCents > 0
      ? Math.round((totals.commissionCents / totals.totalCents) * 100)
      : 50;

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
      commission_percent_snapshot: commissionPercentSnapshot,
      total_cents: totals.totalCents,
      commission_cents: totals.commissionCents,
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

  for (const linked of comanda.linkedAppointments) {
    if (linked.status !== "done") continue;

    const { data: appointment } = await admin
      .from("appointments")
      .select(
        "status, date, start_time, is_squeeze_in, professional_id, appointment_services ( service_id )"
      )
      .eq("id", linked.id)
      .maybeSingle();

    if (!appointment) continue;

    const serviceIds = (appointment.appointment_services ?? []).map(
      (r) => r.service_id
    );

    if (!appointment.is_squeeze_in && serviceIds.length > 0) {
      const { getAvailability } = await import("@/lib/get-availability");
      const availability = await getAvailability(
        appointment.professional_id,
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

  return getComandaById(admin, comandaId);
}
