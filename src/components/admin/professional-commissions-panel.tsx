"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminFormSectionCard } from "@/components/admin/admin-form-layout";
import { CommissionPayoutHistory } from "@/components/admin/commission-payout-history";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { PayCommissionButton } from "@/components/admin/pay-commission-button";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatPriceBRL } from "@/lib/format";

type ProfessionalCommissionsPanelProps = {
  professionalId: string;
  professionalNickname: string;
  today: string;
  from: string;
  to: string;
  openCommissionCents: number;
  payouts: CommissionPayout[];
};

export function ProfessionalCommissionsPanel({
  professionalId,
  professionalNickname,
  today,
  from,
  to,
  openCommissionCents,
  payouts,
}: ProfessionalCommissionsPanelProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function buildHref(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    return `/admin/profissionais/${professionalId}?${params.toString()}`;
  }

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildHref(fromDate, toDate));
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    router.push(buildHref(presetFrom, presetTo));
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminFormSectionCard
        title="A pagar no período"
        description={`Comissão em aberto de ${formatPeriodLabel(from, to)}.`}
      >
        <div className="flex flex-col gap-4">
          <FinancePeriodFilter
            today={today}
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onSubmit={applyFilter}
            onPreset={applyPreset}
            embedded
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total a pagar</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatPriceBRL(openCommissionCents)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <PayCommissionButton
                from={from}
                to={to}
                professionalId={professionalId}
                professionalNickname={professionalNickname}
                amountCents={openCommissionCents}
                label="Registrar pagamento"
                className="h-10 w-full sm:h-8 sm:w-auto"
              />
              <Button
                variant="outline"
                className="h-10 w-full sm:h-8 sm:w-auto"
                asChild
              >
                <Link
                  href={`/admin/financeiro/comissoes?from=${from}&to=${to}&professionalId=${professionalId}`}
                >
                  Ver detalhes
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </AdminFormSectionCard>

      <AdminFormSectionCard
        title="Histórico de pagamentos"
        description="Repasses já registrados para este barbeiro."
      >
        <CommissionPayoutHistory payouts={payouts} viewer="owner" />
      </AdminFormSectionCard>
    </div>
  );
}
