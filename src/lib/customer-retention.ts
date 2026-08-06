import type { SupabaseClient } from "@supabase/supabase-js";
import { inclusiveDayCount, shiftDate } from "@/lib/date-range";
import {
  normalizeWhatsapp,
  whatsappLookupKeys,
} from "@/lib/whatsapp";

export type RetentionCustomerRow = {
  key: string;
  customerName: string;
  whatsapp: string | null;
  firstVisitDate: string;
  visitCountInPeriod: number;
};

export type CustomerRetentionReport = {
  from: string;
  to: string;
  /** Clientes distintos com horário não cancelado no período (com WhatsApp). */
  totalCustomers: number;
  newCount: number;
  recurringCount: number;
  newPercent: number;
  previousNewPercent: number | null;
  newPointsChange: number | null;
  newCustomers: RetentionCustomerRow[];
  recurringCustomers: RetentionCustomerRow[];
};

type AptRow = {
  id: string;
  date: string;
  start_time: string;
  customer_whatsapp: string | null;
  customer_first_name: string;
  customer_last_name: string;
};

function customerKeyFromWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return normalizeWhatsapp(raw);
}

function ratePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function appointmentSortKey(row: {
  date: string;
  start_time: string;
  id: string;
}): string {
  return `${row.date}T${row.start_time}:${row.id}`;
}

async function loadNonCancelledByWhatsappKeys(
  admin: SupabaseClient,
  whatsappKeys: string[],
  toDate: string
): Promise<AptRow[]> {
  if (whatsappKeys.length === 0) return [];

  const lookupKeys = [
    ...new Set(whatsappKeys.flatMap((key) => whatsappLookupKeys(key))),
  ];

  const { data } = await admin
    .from("appointments")
    .select(
      "id, date, start_time, customer_whatsapp, customer_first_name, customer_last_name"
    )
    .in("customer_whatsapp", lookupKeys)
    .neq("status", "cancelled")
    .lte("date", toDate);

  return (data ?? []) as AptRow[];
}

function buildFirstVisitByKey(rows: AptRow[]): Map<
  string,
  { appointmentId: string; date: string; name: string; whatsapp: string }
> {
  const map = new Map<
    string,
    { appointmentId: string; date: string; name: string; whatsapp: string; sortKey: string }
  >();

  for (const row of rows) {
    const key = customerKeyFromWhatsapp(row.customer_whatsapp);
    if (!key || !row.customer_whatsapp) continue;
    const sortKey = appointmentSortKey(row);
    const existing = map.get(key);
    if (existing && existing.sortKey <= sortKey) continue;
    map.set(key, {
      appointmentId: row.id,
      date: row.date,
      name: `${row.customer_first_name} ${row.customer_last_name}`.trim(),
      whatsapp: row.customer_whatsapp,
      sortKey,
    });
  }

  return new Map(
    [...map.entries()].map(([key, value]) => [
      key,
      {
        appointmentId: value.appointmentId,
        date: value.date,
        name: value.name,
        whatsapp: value.whatsapp,
      },
    ])
  );
}

/**
 * Marca quais agendamentos do dia são a 1ª visita do cliente (por WhatsApp).
 * Sem WhatsApp → não marca (não dá pra saber o histórico).
 */
export async function loadFirstVisitAppointmentIds(
  admin: SupabaseClient,
  appointments: {
    id: string;
    date: string;
    startTime: string;
    customerWhatsapp: string;
  }[]
): Promise<Set<string>> {
  const withPhone = appointments.filter((apt) =>
    Boolean(customerKeyFromWhatsapp(apt.customerWhatsapp))
  );
  if (withPhone.length === 0) return new Set();

  const keys = [
    ...new Set(
      withPhone
        .map((apt) => customerKeyFromWhatsapp(apt.customerWhatsapp))
        .filter((key): key is string => Boolean(key))
    ),
  ];
  const maxDate = withPhone.reduce(
    (max, apt) => (apt.date > max ? apt.date : max),
    withPhone[0].date
  );

  const history = await loadNonCancelledByWhatsappKeys(admin, keys, maxDate);
  const firstByKey = buildFirstVisitByKey(history);

  const firstIds = new Set<string>();
  for (const apt of withPhone) {
    const key = customerKeyFromWhatsapp(apt.customerWhatsapp);
    if (!key) continue;
    const first = firstByKey.get(key);
    if (first?.appointmentId === apt.id) {
      firstIds.add(apt.id);
    }
  }
  return firstIds;
}

async function buildRetentionForRange(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<{
  totalCustomers: number;
  newCount: number;
  recurringCount: number;
  newPercent: number;
  newCustomers: RetentionCustomerRow[];
  recurringCustomers: RetentionCustomerRow[];
}> {
  const { data: periodRows } = await admin
    .from("appointments")
    .select(
      "id, date, start_time, customer_whatsapp, customer_first_name, customer_last_name"
    )
    .gte("date", from)
    .lte("date", to)
    .neq("status", "cancelled")
    .not("customer_whatsapp", "is", null);

  const period = (periodRows ?? []) as AptRow[];
  const visitsInPeriod = new Map<
    string,
    { count: number; name: string; whatsapp: string }
  >();

  for (const row of period) {
    const key = customerKeyFromWhatsapp(row.customer_whatsapp);
    if (!key || !row.customer_whatsapp) continue;
    const existing = visitsInPeriod.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    visitsInPeriod.set(key, {
      count: 1,
      name: `${row.customer_first_name} ${row.customer_last_name}`.trim(),
      whatsapp: row.customer_whatsapp,
    });
  }

  const keys = [...visitsInPeriod.keys()];
  const history = await loadNonCancelledByWhatsappKeys(admin, keys, to);
  const firstByKey = buildFirstVisitByKey(history);

  const newCustomers: RetentionCustomerRow[] = [];
  const recurringCustomers: RetentionCustomerRow[] = [];

  for (const [key, visit] of visitsInPeriod) {
    const first = firstByKey.get(key);
    const firstVisitDate = first?.date ?? from;
    const row: RetentionCustomerRow = {
      key,
      customerName: visit.name || first?.name || "Cliente",
      whatsapp: visit.whatsapp,
      firstVisitDate,
      visitCountInPeriod: visit.count,
    };
    if (firstVisitDate >= from && firstVisitDate <= to) {
      newCustomers.push(row);
    } else {
      recurringCustomers.push(row);
    }
  }

  newCustomers.sort((a, b) => b.firstVisitDate.localeCompare(a.firstVisitDate));
  recurringCustomers.sort((a, b) =>
    a.customerName.localeCompare(b.customerName, "pt-BR")
  );

  const totalCustomers = visitsInPeriod.size;
  const newCount = newCustomers.length;
  const recurringCount = recurringCustomers.length;

  return {
    totalCustomers,
    newCount,
    recurringCount,
    newPercent: ratePercent(newCount, totalCustomers),
    newCustomers,
    recurringCustomers,
  };
}

/** Clientes novos vs. recorrentes no período (por WhatsApp, ignorando cancelados). */
export async function getCustomerRetentionReport(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<CustomerRetentionReport> {
  const current = await buildRetentionForRange(admin, from, to);

  let previousNewPercent: number | null = null;
  let newPointsChange: number | null = null;
  const periodDayCount = inclusiveDayCount(from, to);
  const previousTo = shiftDate(from, -1);
  const previousFrom = shiftDate(previousTo, -(periodDayCount - 1));

  if (previousFrom <= previousTo) {
    const previous = await buildRetentionForRange(
      admin,
      previousFrom,
      previousTo
    );
    if (previous.totalCustomers > 0 || current.totalCustomers > 0) {
      previousNewPercent = previous.newPercent;
      newPointsChange = current.newPercent - previous.newPercent;
    }
  }

  return {
    from,
    to,
    totalCustomers: current.totalCustomers,
    newCount: current.newCount,
    recurringCount: current.recurringCount,
    newPercent: current.newPercent,
    previousNewPercent,
    newPointsChange,
    newCustomers: current.newCustomers,
    recurringCustomers: current.recurringCustomers,
  };
}
