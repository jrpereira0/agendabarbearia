import { Wallet } from "lucide-react";
import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import {
  getCashRegisterSummary,
  getCommissionSummary,
} from "@/lib/finance-reports";
import { FinanceView } from "@/components/admin/finance-view";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Financeiro" };

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function FinanceiroPage({ searchParams }: PageProps) {
  await assertOwnerPage();

  const { date: dateParam } = await searchParams;
  const today = todayInTimezone();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const monthFrom = `${date.slice(0, 7)}-01`;

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

  const [cash, commissions] = await Promise.all([
    getCashRegisterSummary(admin, date),
    getCommissionSummary(admin, monthFrom, date),
  ]);

  return (
    <FinanceView
      date={date}
      today={today}
      monthFrom={monthFrom}
      cash={cash}
      commissions={commissions}
    />
  );
}
