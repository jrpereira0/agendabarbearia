import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/comanda-types";

export type CashRegisterSummary = {
  date: string;
  totalCents: number;
  commissionCents: number;
  shopCents: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  comandaCount: number;
  comandas: {
    id: string;
    appointmentId: string;
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

function dateRangeBounds(from: string, to: string): { start: string; end: string } {
  return {
    start: `${from}T00:00:00.000-03:00`,
    end: `${to}T23:59:59.999-03:00`,
  };
}

export async function getCashRegisterSummary(
  admin: SupabaseClient,
  date: string
): Promise<CashRegisterSummary> {
  const bounds = dateRangeBounds(date, date);

  const { data } = await admin
    .from("comandas")
    .select(
      `
      id,
      appointment_id,
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
    .gte("closed_at", bounds.start)
    .lte("closed_at", bounds.end)
    .order("closed_at", { ascending: true });

  const byPaymentMethod: Record<PaymentMethod, number> = {
    pix: 0,
    cash: 0,
    debit: 0,
    credit: 0,
  };

  let totalCents = 0;
  let commissionCents = 0;

  const comandas = (data ?? []).map((row) => {
    totalCents += row.total_cents;
    commissionCents += row.commission_cents;

    const payments = (row.comanda_payments ?? []).map((p) => {
      const method = p.payment_method as PaymentMethod;
      byPaymentMethod[method] += p.amount_cents;
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

  return {
    date,
    totalCents,
    commissionCents,
    shopCents: totalCents - commissionCents,
    byPaymentMethod,
    comandaCount: comandas.length,
    comandas,
  };
}

export async function getCommissionSummary(
  admin: SupabaseClient,
  from: string,
  to: string,
  professionalId?: string
): Promise<CommissionSummary> {
  const bounds = dateRangeBounds(from, to);

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
    .gte("closed_at", bounds.start)
    .lte("closed_at", bounds.end);

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

export function formatPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}
