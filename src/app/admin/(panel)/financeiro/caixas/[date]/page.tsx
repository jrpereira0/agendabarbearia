import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import {
  getCashRegisterSession,
  getOpenCashRegisterSession,
} from "@/lib/cash-register-service";
import { getCashRegisterSummary } from "@/lib/finance-reports";
import { loadCashRegisterResponsibleOptions } from "@/lib/cash-register-options";
import { getAdminSession } from "@/lib/require-admin";
import { formatDateBR } from "@/lib/format";
import { CashRegisterDetailView } from "@/components/admin/cash-register-detail-view";
import { EmptyState } from "@/components/admin/empty-state";

type PageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { title: "Caixa" };
  }
  return { title: `Caixa · ${formatDateBR(date)}` };
}

export default async function CaixaDetalhePage({
  params,
  searchParams,
}: PageProps) {
  await assertOwnerPage();

  const { date } = await params;
  const { from: fromParam, to: toParam } = await searchParams;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const today = todayInTimezone();
  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sistema indisponível"
        description="Não foi possível carregar o caixa. Tente de novo em instantes."
      />
    );
  }

  const adminSession = await getAdminSession();
  const [cashSession, openCashRegister, responsibleOptions] =
    await Promise.all([
      getCashRegisterSession(admin, date),
      getOpenCashRegisterSession(admin),
      adminSession
        ? loadCashRegisterResponsibleOptions(admin, adminSession.userId)
        : Promise.resolve([]),
    ]);

  const cash = await getCashRegisterSummary(admin, date, {
    cashRegisterSessionId: cashSession?.id,
  });

  const listFrom =
    fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : date;
  const listTo =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : date;
  const backHref = `/admin/financeiro/caixas?from=${listFrom}&to=${listTo}`;

  return (
    <CashRegisterDetailView
      date={date}
      today={today}
      backHref={backHref}
      cash={cash}
      cashSession={cashSession}
      openCashRegister={openCashRegister}
      responsibleOptions={responsibleOptions}
    />
  );
}
