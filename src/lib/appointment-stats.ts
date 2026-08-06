import type { SupabaseClient } from "@supabase/supabase-js";
import { isRealCancellation } from "@/lib/cancellation-reasons";
import { inclusiveDayCount, shiftDate } from "@/lib/date-range";

export type CancellationRow = {
  appointmentId: string;
  date: string;
  startTime: string;
  customerName: string;
  professionalNickname: string;
  cancelledAt: string | null;
  reason: string | null;
};

export type CancellationByProfessionalRow = {
  professionalId: string;
  professionalNickname: string;
  totalCount: number;
  cancelledCount: number;
  ratePercent: number;
};

export type CancellationByDayRow = {
  date: string;
  cancelledCount: number;
};

export type CancellationReport = {
  from: string;
  to: string;
  /** Total de agendamentos (qualquer status) com data no período. */
  totalCount: number;
  /** Só cancelamentos reais (cliente desmarcou / não compareceu / motivo válido). */
  cancelledCount: number;
  ratePercent: number;
  previousRatePercent: number | null;
  /** Variação em pontos percentuais vs. o período anterior equivalente. */
  ratePointsChange: number | null;
  byProfessional: CancellationByProfessionalRow[];
  byDay: CancellationByDayRow[];
  /** Cancelamentos reais, do mais recente para o mais antigo. */
  cancellations: CancellationRow[];
};

type ProfessionalRef = { nickname: string } | { nickname: string }[] | null;

type AppointmentRow = {
  id: string;
  date: string;
  start_time: string;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  customer_first_name: string;
  customer_last_name: string;
  professional_id: string | null;
  professionals: ProfessionalRef;
};

function firstProfessional(value: ProfessionalRef): { nickname: string } | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isCountedCancellation(row: AppointmentRow): boolean {
  return row.status === "cancelled" && isRealCancellation(row);
}

async function loadAppointmentsForRange(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<AppointmentRow[]> {
  const { data } = await admin
    .from("appointments")
    .select(
      `
      id,
      date,
      start_time,
      status,
      cancelled_at,
      cancellation_reason,
      customer_first_name,
      customer_last_name,
      professional_id,
      professionals ( nickname )
    `
    )
    .gte("date", from)
    .lte("date", to);

  return (data ?? []) as AppointmentRow[];
}

function ratePercentOf(cancelledCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Math.round((cancelledCount / totalCount) * 100);
}

/** Taxa de cancelamento real no período (ignora erro de agendamento, remarcação e cancelamentos internos). */
export async function getCancellationReport(
  admin: SupabaseClient,
  from: string,
  to: string
): Promise<CancellationReport> {
  const rows = await loadAppointmentsForRange(admin, from, to);
  const cancelledRows = rows.filter(isCountedCancellation);
  const totalCount = rows.length;
  const cancelledCount = cancelledRows.length;
  const ratePercent = ratePercentOf(cancelledCount, totalCount);

  const proMap = new Map<
    string,
    { professionalNickname: string; totalCount: number; cancelledCount: number }
  >();
  for (const row of rows) {
    if (!row.professional_id) continue;
    const entry =
      proMap.get(row.professional_id) ?? {
        professionalNickname: firstProfessional(row.professionals)?.nickname ?? "—",
        totalCount: 0,
        cancelledCount: 0,
      };
    entry.totalCount += 1;
    if (isCountedCancellation(row)) entry.cancelledCount += 1;
    proMap.set(row.professional_id, entry);
  }
  const byProfessional: CancellationByProfessionalRow[] = [...proMap.entries()]
    .map(([professionalId, entry]) => ({
      professionalId,
      professionalNickname: entry.professionalNickname,
      totalCount: entry.totalCount,
      cancelledCount: entry.cancelledCount,
      ratePercent: ratePercentOf(entry.cancelledCount, entry.totalCount),
    }))
    .filter((row) => row.cancelledCount > 0)
    .sort((a, b) => b.cancelledCount - a.cancelledCount);

  const dayMap = new Map<string, number>();
  for (const row of cancelledRows) {
    dayMap.set(row.date, (dayMap.get(row.date) ?? 0) + 1);
  }
  const byDay: CancellationByDayRow[] = [...dayMap.entries()]
    .map(([date, count]) => ({ date, cancelledCount: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const cancellations: CancellationRow[] = cancelledRows
    .map((row) => ({
      appointmentId: row.id,
      date: row.date,
      startTime: row.start_time,
      customerName: `${row.customer_first_name} ${row.customer_last_name}`.trim(),
      professionalNickname:
        firstProfessional(row.professionals)?.nickname ?? "—",
      cancelledAt: row.cancelled_at,
      reason: row.cancellation_reason,
    }))
    .sort((a, b) => {
      const keyA = a.cancelledAt ?? `${a.date}T${a.startTime}`;
      const keyB = b.cancelledAt ?? `${b.date}T${b.startTime}`;
      return keyB.localeCompare(keyA);
    });

  let previousRatePercent: number | null = null;
  let ratePointsChange: number | null = null;
  const periodDayCount = inclusiveDayCount(from, to);
  const previousTo = shiftDate(from, -1);
  const previousFrom = shiftDate(previousTo, -(periodDayCount - 1));

  if (previousFrom <= previousTo) {
    const previousRows = await loadAppointmentsForRange(
      admin,
      previousFrom,
      previousTo
    );
    if (previousRows.length > 0 || totalCount > 0) {
      const previousCancelledCount = previousRows.filter(isCountedCancellation).length;
      previousRatePercent = ratePercentOf(
        previousCancelledCount,
        previousRows.length
      );
      ratePointsChange = ratePercent - previousRatePercent;
    }
  }

  return {
    from,
    to,
    totalCount,
    cancelledCount,
    ratePercent,
    previousRatePercent,
    ratePointsChange,
    byProfessional,
    byDay,
    cancellations,
  };
}
