"use client";

import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatDateTimeBR, formatPriceBRL } from "@/lib/format";

type CommissionPayoutHistoryProps = {
  payouts: CommissionPayout[];
  /** "owner" = texto para o dono; "self" = texto para o barbeiro. */
  viewer?: "owner" | "self";
};

export function CommissionPayoutHistory({
  payouts,
  viewer = "owner",
}: CommissionPayoutHistoryProps) {
  const isOwner = viewer === "owner";

  if (payouts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Wallet className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isOwner
              ? "Nenhum pagamento registrado"
              : "Nenhum pagamento recebido ainda"}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {isOwner
              ? "Quando você registrar um pagamento deste barbeiro, o histórico aparece aqui."
              : "Quando a barbearia registrar um repasse da sua comissão, ele aparece aqui."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPaidCents = payouts.reduce(
    (sum, payout) => sum + payout.amountCents,
    0
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {payouts.length} pagamento{payouts.length === 1 ? "" : "s"}
        </p>
        <p className="text-sm font-medium tabular-nums">
          Total pago {formatPriceBRL(totalPaidCents)}
        </p>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y md:hidden">
          {payouts.map((payout) => (
            <li
              key={payout.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium leading-snug">
                  {formatDateTimeBR(payout.paidAt)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatPeriodLabel(payout.periodFrom, payout.periodTo)}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatPriceBRL(payout.amountCents)}
              </p>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Pago em</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateTimeBR(payout.paidAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPeriodLabel(payout.periodFrom, payout.periodTo)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatPriceBRL(payout.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
