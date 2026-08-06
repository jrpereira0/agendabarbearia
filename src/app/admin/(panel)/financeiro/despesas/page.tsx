import Link from "next/link";
import { Receipt, Repeat } from "lucide-react";
import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import { monthStart, formatPeriodLabel } from "@/lib/date-range";
import {
  generateDueRecurringExpenses,
  getExpensesForPeriod,
} from "@/lib/expense-service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { ExpensesManager } from "@/components/admin/expenses-manager";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export const metadata = { title: "Despesas" };

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function DespesasPage({ searchParams }: PageProps) {
  await assertOwnerPage();

  const { from: fromParam, to: toParam } = await searchParams;
  const today = todayInTimezone();
  let from = isIsoDate(fromParam) ? fromParam : monthStart(today);
  let to = isIsoDate(toParam) ? toParam : today;
  if (from > to) [from, to] = [to, from];

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <div className="admin-page -m-4 flex min-h-full flex-col bg-[#0e0f11] p-4 text-[#f5f5f5] md:-m-8 md:p-8">
        <EmptyState
          icon={Receipt}
          className="border-white/10 text-[#f5f5f5]"
          title="Sistema indisponível"
          description="Não foi possível carregar as despesas. Tente de novo em instantes."
        />
      </div>
    );
  }

  await generateDueRecurringExpenses(admin, today);
  const expenses = await getExpensesForPeriod(admin, from, to);
  const totalCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <PageHeader
          tone="dark"
          title="Despesas"
          description={`Saídas da barbearia · ${formatPeriodLabel(from, to)}`}
          backHref="/admin/metricas"
          backLabel="Financeiro"
          action={
            <Button asChild variant="outline" size="sm" className={ADMIN_SURFACE.btnGhost}>
              <Link href="/admin/financeiro/despesas/recorrentes">
                <Repeat />
                Despesas fixas
              </Link>
            </Button>
          }
        />

        <ExpensesManager
          from={from}
          to={to}
          today={today}
          expenses={expenses}
          totalCents={totalCents}
        />
      </div>
    </div>
  );
}
