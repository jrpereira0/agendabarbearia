"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, History, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSectionTitle } from "@/components/admin/form-section";
import { CommissionPayoutHistory } from "@/components/admin/commission-payout-history";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { PayCommissionButton } from "@/components/admin/pay-commission-button";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatPriceBRL } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type ProfessionalCommissionsPanelProps = {
  professionalId: string;
  professionalNickname: string;
  today: string;
  from: string;
  to: string;
  openCommissionCents: number;
  payouts: CommissionPayout[];
  tone?: "default" | "dark";
};

export function ProfessionalCommissionsPanel({
  professionalId,
  professionalNickname,
  today,
  from,
  to,
  openCommissionCents,
  payouts,
  tone = "default",
}: ProfessionalCommissionsPanelProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [applied, setApplied] = useState({ from, to });
  const dark = tone === "dark";

  if (applied.from !== from || applied.to !== to) {
    setApplied({ from, to });
    setFromDate(from);
    setToDate(to);
  }

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
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          dark
            ? cn(ADMIN_SURFACE.panel, "p-4 sm:p-6")
            : "overflow-hidden rounded-lg border bg-card shadow-sm"
        )}
      >
        {dark ? (
          <div className="mb-4 sm:mb-5">
            <FormSectionTitle
              tone="dark"
              icon={Wallet}
              title="A pagar no período"
              description={`Comissão em aberto de ${formatPeriodLabel(from, to)}.`}
            />
          </div>
        ) : (
          <div className="border-b bg-muted/20 px-5 py-4">
            <h2 className="text-sm font-semibold">A pagar no período</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Comissão em aberto de {formatPeriodLabel(from, to)}.
            </p>
          </div>
        )}
        <div className={cn("flex flex-col gap-4", !dark && "p-5")}>
          <FinancePeriodFilter
            today={today}
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            onSubmit={applyFilter}
            onPreset={applyPreset}
            embedded
            tone={dark ? "dark" : "default"}
            mobilePresetsFirst={dark}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className={cn(
                  "text-xs",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                Total a pagar
              </p>
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
                  dark ? ADMIN_SURFACE.accent : undefined
                )}
              >
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
                className={cn(
                  "h-10 w-full sm:h-8 sm:w-auto",
                  dark && ADMIN_SURFACE.btnPrimary
                )}
              />
              <Button
                variant="outline"
                className={cn(
                  "h-10 w-full sm:h-8 sm:w-auto",
                  dark && ADMIN_SURFACE.btnGhost
                )}
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
      </div>

      <div
        className={cn(
          dark
            ? cn(ADMIN_SURFACE.panel, "p-4 sm:p-6")
            : "overflow-hidden rounded-lg border bg-card shadow-sm"
        )}
      >
        {dark ? (
          <div className="mb-4 sm:mb-5">
            <FormSectionTitle
              tone="dark"
              icon={History}
              title="Histórico de pagamentos"
              description="Repasses já registrados para este barbeiro."
            />
          </div>
        ) : (
          <div className="border-b bg-muted/20 px-5 py-4">
            <h2 className="text-sm font-semibold">Histórico de pagamentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Repasses já registrados para este barbeiro.
            </p>
          </div>
        )}
        <div className={cn(!dark && "p-5")}>
          <CommissionPayoutHistory
            payouts={payouts}
            viewer="owner"
            embedded={dark}
          />
        </div>
      </div>
    </div>
  );
}
