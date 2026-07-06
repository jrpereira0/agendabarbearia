import { Percent } from "lucide-react";
import { assertOwnerPage } from "@/lib/require-owner";
import { requireAdminClient } from "@/lib/supabase/admin";
import { isActionResult } from "@/lib/is-action-result";
import { todayInTimezone } from "@/lib/availability";
import { getCommissionReport } from "@/lib/finance-reports";
import { shiftDate } from "@/lib/date-range";
import { CommissionsView } from "@/components/admin/commissions-view";
import { EmptyState } from "@/components/admin/empty-state";

export const metadata = { title: "Comissões" };

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string; professionalId?: string }>;
};

export default async function ComissoesPage({ searchParams }: PageProps) {
  await assertOwnerPage();

  const { from: fromParam, to: toParam, professionalId } = await searchParams;
  const today = todayInTimezone();
  const defaultFrom = shiftDate(today, -10);
  let from =
    fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : defaultFrom;
  let to =
    toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : today;

  if (from > to) {
    [from, to] = [to, from];
  }

  const admin = requireAdminClient();
  if (isActionResult(admin)) {
    return (
      <EmptyState
        icon={Percent}
        title="Sistema indisponível"
        description="Não foi possível carregar as comissões. Tente de novo em instantes."
      />
    );
  }

  const { data: professionalsData } = await admin
    .from("professionals")
    .select("id, nickname, commission_percent")
    .eq("active", true)
    .order("nickname");

  const professionals = (professionalsData ?? []).map((row) => ({
    id: row.id,
    nickname: row.nickname,
    commissionPercent: row.commission_percent ?? 50,
  }));

  const validProfessionalId =
    professionalId && professionals.some((p) => p.id === professionalId)
      ? professionalId
      : undefined;

  const report = await getCommissionReport(
    admin,
    from,
    to,
    validProfessionalId
  );

  return (
    <CommissionsView
      from={from}
      to={to}
      today={today}
      professionalId={validProfessionalId ?? null}
      report={report}
      professionals={professionals}
    />
  );
}
