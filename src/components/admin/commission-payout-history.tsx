"use client";

import { Wallet } from "lucide-react";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatDateTimeBR, formatPriceBRL } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type CommissionPayoutHistoryProps = {
  payouts: CommissionPayout[];
  /** "owner" = texto para o dono; "self" = texto para o barbeiro. */
  viewer?: "owner" | "self";
  /** Lista flat no painel lista+detalhe (sem cards empilhados). */
  embedded?: boolean;
};

export function CommissionPayoutHistory({
  payouts,
  viewer = "owner",
  embedded = false,
}: CommissionPayoutHistoryProps) {
  const isOwner = viewer === "owner";

  if (payouts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1e]">
          <Wallet className={cn("size-4", ADMIN_SURFACE.muted)} />
        </div>
        <p className="text-sm font-medium text-[#f5f5f5]">
          {isOwner
            ? "Nenhum pagamento registrado"
            : "Nenhum pagamento recebido ainda"}
        </p>
        <p className={cn("max-w-sm text-xs", ADMIN_SURFACE.muted)}>
          {isOwner
            ? "Quando você registrar um pagamento deste barbeiro, o histórico aparece aqui."
            : "Quando a barbearia registrar um repasse da sua comissão, ele aparece aqui."}
        </p>
      </div>
    );
  }

  const totalPaidCents = payouts.reduce(
    (sum, payout) => sum + payout.amountCents,
    0
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#f5f5f5]">
            {payouts.length} pagamento{payouts.length === 1 ? "" : "s"}
          </p>
          <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
            {isOwner ? "Já repassado a este barbeiro" : "Já recebido"}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-[#f5f5f5]">
          {formatPriceBRL(totalPaidCents)}
        </p>
      </div>

      {embedded ? (
        <ul className="divide-y divide-white/10">
          {payouts.map((payout) => (
            <li
              key={payout.id}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium leading-snug tracking-tight text-[#f5f5f5]">
                  {formatDateTimeBR(payout.paidAt)}
                </p>
                <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                  Período{" "}
                  {formatPeriodLabel(payout.periodFrom, payout.periodTo)}
                </p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-[#f5f5f5]">
                {formatPriceBRL(payout.amountCents)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {payouts.map((payout) => (
            <li key={payout.id}>
              <div
                className={cn(
                  ADMIN_SURFACE.panel,
                  "flex items-start justify-between gap-3 p-4"
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug tracking-tight text-[#f5f5f5]">
                    {formatDateTimeBR(payout.paidAt)}
                  </p>
                  <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                    Período{" "}
                    {formatPeriodLabel(payout.periodFrom, payout.periodTo)}
                  </p>
                </div>
                <p className="shrink-0 text-base font-semibold tabular-nums text-[#f5f5f5]">
                  {formatPriceBRL(payout.amountCents)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
