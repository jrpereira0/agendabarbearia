import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateItemCommissionCents,
  CASH_INFLOW_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type CashInflowPaymentMethod,
  type PaymentMethod,
} from "@/lib/comanda-types";

export type CashRegisterSummary = {
  from: string;
  to: string;
  totalCents: number;
  commissionCents: number;
  shopCents: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  creditDepositsByMethod: Record<CashInflowPaymentMethod, number>;
  creditDepositsCents: number;
  cashInflowCents: number;
  comandaCount: number;
  comandas: {
    id: string;
    appointmentId: string;
    serviceDate: string;
    closedAt: string;
    professionalNickname: string;
    customerName: string;
    totalCents: number;
    commissionCents: number;
    payments: { method: PaymentMethod; amountCents: number }[];
  }[];
};

export type CommissionSummaryRow = {
  professionalId: string;
  professionalNickname: string;
  commissionPercent: number;
  comandaCount: number;
  totalCents: number;
  commissionCents: number;
};

export type CommissionSummary = {
  from: string;
  to: string;
  rows: CommissionSummaryRow[];
  totals: {
    totalCents: number;
    commissionCents: number;
    shopCents: number;
    comandaCount: number;
  };
};

export async function getFinancePeriodSummary(
  admin: SupabaseClient,
  from: string,
  to: string,
  options: { cashRegisterSessionId?: string } = {}
): Promise<CashRegisterSummary> {
  let query = admin
    .from("comandas")
    .select(
      `
      id,
      appointment_id,
      service_date,
      closed_at,
      total_cents,
      commission_cents,
      professionals ( nickname ),
      appointments (
        customer_first_name,
        customer_last_name
      ),
      comanda_payments ( payment_method, amount_cents )
    `
    )
    .eq("status", "closed")
    .gte("service_date", from)
    .lte("service_date", to)
    .order("service_date", { ascending: true })
    .order("closed_at", { ascending: true });

  if (options.cashRegisterSessionId) {
    query = query.eq(
      "cash_register_session_id",
      options.cashRegisterSessionId
    );
  }

  const { data } = await query;

  const byPaymentMethod = emptyPaymentMap();
  const creditDepositsByMethod = emptyCashInflowMap();

  let totalCents = 0;
  let commissionCents = 0;

  const comandas = (data ?? []).map((row) => {
    totalCents += row.total_cents;
    commissionCents += row.commission_cents;

    const payments = (row.comanda_payments ?? []).map((p) => {
      const method = p.payment_method as PaymentMethod;
      if (method in byPaymentMethod) {
        byPaymentMethod[method] += p.amount_cents;
      }
      return { method, amountCents: p.amount_cents };
    });

    const apt = Array.isArray(row.appointments)
      ? row.appointments[0]
      : row.appointments;
    const pro = Array.isArray(row.professionals)
      ? row.professionals[0]
      : row.professionals;

    return {
      id: row.id,
      appointmentId: row.appointment_id,
      serviceDate: row.service_date as string,
      closedAt: row.closed_at as string,
      professionalNickname: pro?.nickname ?? "—",
      customerName: apt
        ? `${apt.customer_first_name} ${apt.customer_last_name}`
        : "—",
      totalCents: row.total_cents,
      commissionCents: row.commission_cents,
      payments,
    };
  });

  if (options.cashRegisterSessionId) {
    const { data: creditDeposits } = await admin
      .from("customer_credit_transactions")
      .select("amount_cents, payment_method")
      .eq("cash_register_session_id", options.cashRegisterSessionId)
      .eq("type", "add");

    for (const row of creditDeposits ?? []) {
      const method = row.payment_method as CashInflowPaymentMethod | null;
      if (!method || !(method in creditDepositsByMethod)) continue;
      creditDepositsByMethod[method] += row.amount_cents;
    }
  }

  const creditDepositsCents = CASH_INFLOW_PAYMENT_METHODS.reduce(
    (sum, method) => sum + creditDepositsByMethod[method],
    0
  );
  const cashInflowCents =
    CASH_INFLOW_PAYMENT_METHODS.reduce(
      (sum, method) => sum + byPaymentMethod[method],
      0
    ) + creditDepositsCents;

  return {
    from,
    to,
    totalCents,
    commissionCents,
    shopCents: totalCents - commissionCents,
    byPaymentMethod,
    creditDepositsByMethod,
    creditDepositsCents,
    cashInflowCents,
    comandaCount: comandas.length,
    comandas,
  };
}

export async function getCashRegisterSummary(
  admin: SupabaseClient,
  date: string,
  options: { cashRegisterSessionId?: string } = {}
): Promise<CashRegisterSummary> {
  return getFinancePeriodSummary(admin, date, date, options);
}

export async function getCommissionSummary(
  admin: SupabaseClient,
  from: string,
  to: string,
  professionalId?: string
): Promise<CommissionSummary> {
  let query = admin
    .from("comandas")
    .select(
      `
      professional_id,
      total_cents,
      commission_cents,
      professionals ( nickname, commission_percent )
    `
    )
    .eq("status", "closed")
    .gte("service_date", from)
    .lte("service_date", to);

  if (professionalId) {
    query = query.eq("professional_id", professionalId);
  }

  const { data } = await query;

  const map = new Map<string, CommissionSummaryRow>();

  for (const row of data ?? []) {
    const pro = Array.isArray(row.professionals)
      ? row.professionals[0]
      : row.professionals;
    const pid = row.professional_id as string;
    const existing = map.get(pid) ?? {
      professionalId: pid,
      professionalNickname: pro?.nickname ?? "—",
      commissionPercent: pro?.commission_percent ?? 50,
      comandaCount: 0,
      totalCents: 0,
      commissionCents: 0,
    };
    existing.comandaCount += 1;
    existing.totalCents += row.total_cents;
    existing.commissionCents += row.commission_cents;
    map.set(pid, existing);
  }

  const rows = [...map.values()].sort((a, b) =>
    a.professionalNickname.localeCompare(b.professionalNickname, "pt-BR")
  );

  const totals = rows.reduce(
    (acc, row) => ({
      totalCents: acc.totalCents + row.totalCents,
      commissionCents: acc.commissionCents + row.commissionCents,
      shopCents: 0,
      comandaCount: acc.comandaCount + row.comandaCount,
    }),
    { totalCents: 0, commissionCents: 0, shopCents: 0, comandaCount: 0 }
  );
  totals.shopCents = totals.totalCents - totals.commissionCents;

  return { from, to, rows, totals };
}

export type FinanceDayMetric = {
  date: string;
  totalCents: number;
  commissionCents: number;
  shopCents: number;
  comandaCount: number;
};

export type FinancePeriodComparison = {
  previousFrom: string;
  previousTo: string;
  totalCents: number;
  comandaCount: number;
  changePercent: number | null;
};

export type FinanceMetricsReport = {
  from: string;
  to: string;
  totals: {
    totalCents: number;
    commissionCents: number;
    shopCents: number;
    comandaCount: number;
  };
  averageTicketCents: number;
  commissionRatePercent: number;
  shopRatePercent: number;
  activeDays: number;
  periodDayCount: number;
  byDay: FinanceDayMetric[];
  byPaymentMethod: Record<PaymentMethod, number>;
  professionals: CommissionSummaryRow[];
  comparison: FinancePeriodComparison | null;
};

function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function inclusiveDayCount(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function listDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return dates;
}

function buildDayMetrics(
  comandas: CashRegisterSummary["comandas"],
  from: string,
  to: string
): FinanceDayMetric[] {
  const map = new Map<string, FinanceDayMetric>();

  for (const date of listDatesInRange(from, to)) {
    map.set(date, {
      date,
      totalCents: 0,
      commissionCents: 0,
      shopCents: 0,
      comandaCount: 0,
    });
  }

  for (const comanda of comandas) {
    const entry =
      map.get(comanda.serviceDate) ??
      {
        date: comanda.serviceDate,
        totalCents: 0,
        commissionCents: 0,
        shopCents: 0,
        comandaCount: 0,
      };
    entry.totalCents += comanda.totalCents;
    entry.commissionCents += comanda.commissionCents;
    entry.shopCents += comanda.totalCents - comanda.commissionCents;
    entry.comandaCount += 1;
    map.set(comanda.serviceDate, entry);
  }

  return [...map.values()];
}

export async function getFinanceMetricsReport(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<FinanceMetricsReport> {
  const [summary, commissions] = await Promise.all([
    getFinancePeriodSummary(admin, from, to),
    getCommissionSummary(admin, from, to),
  ]);

  const byDay = buildDayMetrics(summary.comandas, from, to);
  const activeDays = byDay.filter((day) => day.comandaCount > 0).length;
  const periodDayCount = inclusiveDayCount(from, to);
  const averageTicketCents =
    summary.comandaCount > 0
      ? Math.round(summary.totalCents / summary.comandaCount)
      : 0;
  const commissionRatePercent =
    summary.totalCents > 0
      ? Math.round((summary.commissionCents / summary.totalCents) * 100)
      : 0;
  const shopRatePercent =
    summary.totalCents > 0 ? 100 - commissionRatePercent : 0;

  let comparison: FinancePeriodComparison | null = null;
  const previousTo = shiftIsoDate(from, -1);
  const previousFrom = shiftIsoDate(previousTo, -(periodDayCount - 1));

  if (previousFrom <= previousTo) {
    const previous = await getFinancePeriodSummary(admin, previousFrom, previousTo);
    comparison = {
      previousFrom,
      previousTo,
      totalCents: previous.totalCents,
      comandaCount: previous.comandaCount,
      changePercent:
        previous.totalCents > 0
          ? Math.round(
              ((summary.totalCents - previous.totalCents) / previous.totalCents) *
                100
            )
          : summary.totalCents > 0
            ? 100
            : null,
    };
  }

  return {
    from,
    to,
    totals: {
      totalCents: summary.totalCents,
      commissionCents: summary.commissionCents,
      shopCents: summary.shopCents,
      comandaCount: summary.comandaCount,
    },
    averageTicketCents,
    commissionRatePercent,
    shopRatePercent,
    activeDays,
    periodDayCount,
    byDay,
    byPaymentMethod: summary.byPaymentMethod,
    professionals: commissions.rows,
    comparison,
  };
}

export function formatPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export type CommissionReportSummary = {
  servicesGrossCents: number;
  commissionCents: number;
  itemCount: number;
  comandaCount: number;
};

export type CommissionDayRow = {
  date: string;
  servicesGrossCents: number;
  commissionCents: number;
  comandaCount: number;
};

export type CommissionProfessionalReport = {
  professionalId: string;
  professionalNickname: string;
  commissionPercent: number;
  summary: CommissionReportSummary;
  byPaymentMethod: Record<PaymentMethod, number>;
  byDay: CommissionDayRow[];
};

export type CommissionReport = {
  from: string;
  to: string;
  professionalId: string | null;
  summary: CommissionReportSummary;
  byPaymentMethod: Record<PaymentMethod, number>;
  byDay: CommissionDayRow[];
  professionals: CommissionProfessionalReport[];
};

type ComandaCommissionRow = {
  id: string;
  service_date: string;
  total_cents: number;
  comanda_items: {
    charged_price_cents: number;
    professional_id: string | null;
    is_tip: boolean;
    professionals:
      | { nickname: string; commission_percent: number }
      | { nickname: string; commission_percent: number }[]
      | null;
  }[];
  comanda_payments: {
    payment_method: string;
    amount_cents: number;
  }[];
};

function emptyDayMap(): Map<
  string,
  { servicesGrossCents: number; commissionCents: number; comandaIds: Set<string> }
> {
  return new Map();
}

function bumpDay(
  map: Map<
    string,
    { servicesGrossCents: number; commissionCents: number; comandaIds: Set<string> }
  >,
  date: string,
  grossCents: number,
  commissionCents: number,
  comandaId: string
) {
  const entry =
    map.get(date) ??
    { servicesGrossCents: 0, commissionCents: 0, comandaIds: new Set<string>() };
  entry.servicesGrossCents += grossCents;
  entry.commissionCents += commissionCents;
  entry.comandaIds.add(comandaId);
  map.set(date, entry);
}

function dayMapToRows(
  map: Map<
    string,
    { servicesGrossCents: number; commissionCents: number; comandaIds: Set<string> }
  >
): CommissionDayRow[] {
  return [...map.entries()]
    .map(([date, entry]) => ({
      date,
      servicesGrossCents: entry.servicesGrossCents,
      commissionCents: entry.commissionCents,
      comandaCount: entry.comandaIds.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function emptyPaymentMap(): Record<PaymentMethod, number> {
  return {
    pix: 0,
    cash: 0,
    debit: 0,
    credit: 0,
    store_credit: 0,
  };
}

function emptyCashInflowMap(): Record<CashInflowPaymentMethod, number> {
  return { pix: 0, cash: 0, debit: 0, credit: 0 };
}

function firstPro(
  value: ComandaCommissionRow["comanda_items"][0]["professionals"]
): { nickname: string; commission_percent: number } | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getCommissionReport(
  admin: SupabaseClient,
  from: string,
  to: string,
  professionalId?: string
): Promise<CommissionReport> {
  const { data } = await admin
    .from("comandas")
    .select(
      `
      id,
      service_date,
      total_cents,
      comanda_items (
        charged_price_cents,
        professional_id,
        is_tip,
        professionals ( nickname, commission_percent )
      ),
      comanda_payments ( payment_method, amount_cents )
    `
    )
    .eq("status", "closed")
    .gte("service_date", from)
    .lte("service_date", to);

  const proMap = new Map<
    string,
    {
      professionalNickname: string;
      commissionPercent: number;
      summary: CommissionReportSummary;
      byPaymentMethod: Record<PaymentMethod, number>;
      byDay: ReturnType<typeof emptyDayMap>;
      comandaIds: Set<string>;
    }
  >();
  const allComandaIds = new Set<string>();
  const reportByDay = emptyDayMap();

  for (const row of (data ?? []) as ComandaCommissionRow[]) {
    const serviceDate = row.service_date;
    const items = (row.comanda_items ?? []).filter((item) =>
      professionalId ? item.professional_id === professionalId : true
    );
    if (items.length === 0) continue;
    allComandaIds.add(row.id);

    const comandaTotal =
      row.total_cents > 0
        ? row.total_cents
        : items.reduce((sum, item) => sum + item.charged_price_cents, 0);

    const grossByPro = new Map<string, number>();
    const commissionByPro = new Map<string, number>();
    for (const item of items) {
      if (!item.professional_id) continue;
      const pro = firstPro(item.professionals);
      const entry =
        proMap.get(item.professional_id) ??
        {
          professionalNickname: pro?.nickname ?? "—",
          commissionPercent: pro?.commission_percent ?? 50,
          summary: {
            servicesGrossCents: 0,
            commissionCents: 0,
            itemCount: 0,
            comandaCount: 0,
          },
          byPaymentMethod: emptyPaymentMap(),
          byDay: emptyDayMap(),
          comandaIds: new Set<string>(),
        };

      const pct = pro?.commission_percent ?? entry.commissionPercent;
      const itemCommission = calculateItemCommissionCents(
        {
          chargedPriceCents: item.charged_price_cents,
          professionalId: item.professional_id,
          isTip: item.is_tip,
        },
        new Map([[item.professional_id, pct]])
      );
      entry.summary.servicesGrossCents += item.charged_price_cents;
      entry.summary.commissionCents += itemCommission;
      entry.summary.itemCount += 1;
      entry.comandaIds.add(row.id);
      bumpDay(
        entry.byDay,
        serviceDate,
        item.charged_price_cents,
        itemCommission,
        row.id
      );
      grossByPro.set(
        item.professional_id,
        (grossByPro.get(item.professional_id) ?? 0) + item.charged_price_cents
      );
      commissionByPro.set(
        item.professional_id,
        (commissionByPro.get(item.professional_id) ?? 0) + itemCommission
      );
      proMap.set(item.professional_id, entry);
    }

    const rowGross = items.reduce((sum, item) => sum + item.charged_price_cents, 0);
    const rowCommission = [...commissionByPro.values()].reduce((sum, v) => sum + v, 0);
    bumpDay(reportByDay, serviceDate, rowGross, rowCommission, row.id);

    if (comandaTotal <= 0) continue;

    for (const [pid, proGross] of grossByPro) {
      const entry = proMap.get(pid);
      if (!entry) continue;
      const share = proGross / comandaTotal;
      for (const payment of row.comanda_payments ?? []) {
        const method = payment.payment_method as PaymentMethod;
        if (!(method in entry.byPaymentMethod)) continue;
        entry.byPaymentMethod[method] += Math.round(payment.amount_cents * share);
      }
    }
  }

  const professionals: CommissionProfessionalReport[] = [...proMap.entries()]
    .map(([id, entry]) => ({
      professionalId: id,
      professionalNickname: entry.professionalNickname,
      commissionPercent: entry.commissionPercent,
      summary: {
        ...entry.summary,
        comandaCount: entry.comandaIds.size,
      },
      byPaymentMethod: entry.byPaymentMethod,
      byDay: dayMapToRows(entry.byDay),
    }))
    .sort((a, b) =>
      a.professionalNickname.localeCompare(b.professionalNickname, "pt-BR")
    );

  const summary = professionals.reduce<Omit<CommissionReportSummary, "comandaCount">>(
    (acc, row) => ({
      servicesGrossCents: acc.servicesGrossCents + row.summary.servicesGrossCents,
      commissionCents: acc.commissionCents + row.summary.commissionCents,
      itemCount: acc.itemCount + row.summary.itemCount,
    }),
    { servicesGrossCents: 0, commissionCents: 0, itemCount: 0 }
  );

  const reportSummary: CommissionReportSummary = {
    ...summary,
    comandaCount: allComandaIds.size,
  };

  const byPaymentMethod = emptyPaymentMap();
  for (const row of professionals) {
    for (const method of PAYMENT_METHODS) {
      byPaymentMethod[method] += row.byPaymentMethod[method];
    }
  }

  return {
    from,
    to,
    professionalId: professionalId ?? null,
    summary: reportSummary,
    byPaymentMethod,
    byDay: dayMapToRows(reportByDay),
    professionals,
  };
}
