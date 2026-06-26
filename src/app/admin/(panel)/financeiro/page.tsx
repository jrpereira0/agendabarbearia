import { Wallet } from "lucide-react";
import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import { getFinanceMetricsReport } from "@/lib/finance-reports";
import { FinanceView } from "@/components/admin/finance-view";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Financeiro" };

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string; date?: string }>;
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function normalizeRange(
  fromParam: string | undefined,
  toParam: string | undefined,
  legacyDate: string | undefined,
  today: string
): { from: string; to: string } {
  const defaultFrom = shiftDate(today, -10);
  let from = isIsoDate(fromParam)
    ? fromParam
    : isIsoDate(legacyDate)
      ? legacyDate
      : defaultFrom;
  let to = isIsoDate(toParam)
    ? toParam
    : isIsoDate(legacyDate)
      ? legacyDate
      : today;

  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  await assertOwnerPage();

  const { from: fromParam, to: toParam, date: legacyDate } = await searchParams;
  const today = todayInTimezone();
  const { from, to } = normalizeRange(fromParam, toParam, legacyDate, today);

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sistema indisponível"
        description="Não foi possível carregar o financeiro. Tente de novo em instantes."
      />
    );
  }

  const report = await getFinanceMetricsReport(admin, from, to);

  return (
    <FinanceView
      from={from}
      to={to}
      today={today}
      report={report}
    />
  );
}
