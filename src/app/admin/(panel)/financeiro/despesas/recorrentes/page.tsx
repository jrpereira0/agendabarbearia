import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import { getRecurringExpenses } from "@/lib/expense-service";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { RecurringExpensesManager } from "@/components/admin/recurring-expenses-manager";
import { Receipt } from "lucide-react";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export const metadata = { title: "Despesas fixas" };

export default async function RecurringExpensesPage() {
  await assertOwnerPage();

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <div className="admin-page -m-4 flex min-h-full flex-col bg-[#0e0f11] p-4 text-[#f5f5f5] md:-m-8 md:p-8">
        <EmptyState
          icon={Receipt}
          className="border-white/10 text-[#f5f5f5]"
          title="Sistema indisponível"
          description="Não foi possível carregar as despesas fixas. Tente de novo em instantes."
        />
      </div>
    );
  }

  const recurringExpenses = await getRecurringExpenses(admin);
  const today = todayInTimezone();

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
          title="Despesas fixas"
          description="Aluguel, internet, salário e outras contas que se repetem todo mês. Elas são lançadas em Despesas automaticamente."
          backHref="/admin/financeiro/despesas"
          backLabel="Despesas"
        />

        <RecurringExpensesManager items={recurringExpenses} today={today} />
      </div>
    </div>
  );
}
