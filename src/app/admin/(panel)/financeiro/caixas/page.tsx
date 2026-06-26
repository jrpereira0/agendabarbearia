import { Wallet } from "lucide-react";
import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import { listCashRegisterSessions } from "@/lib/cash-register-service";
import { CashRegisterHistoryView } from "@/components/admin/cash-register-history-view";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Histórico de caixas" };

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function CaixasPage({ searchParams }: PageProps) {
  await assertOwnerPage();

  const { from: fromParam, to: toParam } = await searchParams;
  const today = todayInTimezone();
  const defaultFrom = shiftDate(today, -7);
  const from =
    fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : defaultFrom;
  const to =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : today;

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sistema indisponível"
        description="Não foi possível carregar o histórico. Tente de novo em instantes."
      />
    );
  }

  const sessions = await listCashRegisterSessions(admin, from, to);

  return (
    <CashRegisterHistoryView from={from} to={to} sessions={sessions} />
  );
}
