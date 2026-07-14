"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Scissors,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HorizontalBarChart,
  VerticalBarChart,
} from "@/components/admin/finance-charts";
import { PayCommissionButton } from "@/components/admin/pay-commission-button";
import { CommissionPayoutHistory } from "@/components/admin/commission-payout-history";
import {
  commissionServiceRevenueCents,
  formatPaymentMethodLabel,
  type CommissionComandaDetail,
  type CommissionDayRow,
  type CommissionProfessionalReport,
  type CommissionServiceBreakdownRow,
} from "@/lib/finance-reports";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import {
  formatDateBR,
  formatPriceBRL,
  formatWhatsapp,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type CommissionBarberSelfViewProps = {
  professional: CommissionProfessionalReport;
  from: string;
  to: string;
  buildDayHref: (date: string) => string;
  /** "self" = barbeiro vendo a própria comissão; "owner" = dono detalhando. */
  viewer?: "self" | "owner";
  payouts?: CommissionPayout[];
};

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function ServiceTable({
  rows,
  earnLabel,
}: {
  rows: CommissionServiceBreakdownRow[];
  earnLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhum serviço no período.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Serviço</th>
            <th className="px-4 py-3 font-medium text-right">Qtd</th>
            <th className="px-4 py-3 font-medium text-right">{earnLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.isTip ? "tip" : "svc"}:${row.serviceName}`}
              className="border-b last:border-b-0"
            >
              <td className="px-4 py-3 font-medium">
                {row.serviceName}
                {row.isTip && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    gorjeta
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatPriceBRL(row.commissionCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AtendimentoCard({
  comanda,
  receiveLabel,
}: {
  comanda: CommissionComandaDetail;
  receiveLabel: string;
}) {
  const customerLabel =
    comanda.customerName?.trim() ||
    formatWhatsapp(comanda.customerWhatsapp) ||
    "Cliente";

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{customerLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDateBR(comanda.serviceDate)}
            {comanda.serviceItemCount > 0 &&
              ` · ${comanda.serviceItemCount} serviço${comanda.serviceItemCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{receiveLabel}</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatPriceBRL(comanda.commissionCents)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {comanda.items.map((item, index) => (
          <div
            key={`${item.serviceName}-${index}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm"
          >
            <span>
              {item.serviceName}
              {item.isTip && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (gorjeta)
                </span>
              )}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatPriceBRL(item.commissionCents)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayTable({
  rows,
  maxDayCommission,
  buildDayHref,
  activeDate,
  earnLabel,
}: {
  rows: CommissionDayRow[];
  maxDayCommission: number;
  buildDayHref: (date: string) => string;
  activeDate?: string;
  earnLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Dia</th>
            <th className="px-4 py-3 font-medium text-right">Serviços</th>
            <th className="px-4 py-3 font-medium text-right">{earnLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isActive = activeDate === row.date;
            return (
              <tr
                key={row.date}
                className={cn(
                  "border-b last:border-b-0",
                  isActive && "bg-muted/30"
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={buildDayHref(row.date)}
                    className="group block font-medium"
                  >
                    <span className="group-hover:underline">
                      {formatDateBR(row.date)}
                    </span>
                    <div className="mt-1.5 h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/70"
                        style={{
                          width: `${
                            maxDayCommission > 0
                              ? Math.round(
                                  (row.commissionCents / maxDayCommission) * 100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.serviceItemCount}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatPriceBRL(row.commissionCents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CommissionBarberSelfView({
  professional,
  from,
  to,
  buildDayHref,
  viewer = "self",
  payouts = [],
}: CommissionBarberSelfViewProps) {
  const isOwnerView = viewer === "owner";
  const isSingleDay = from === to;
  const dayRows = professional.byDay.filter((row) => row.serviceItemCount > 0);
  const activeDay = isSingleDay
    ? professional.byDay.find((day) => day.date === from)
    : null;
  const comandas = isSingleDay
    ? professional.comandas.filter((comanda) => comanda.serviceDate === from)
    : professional.comandas;

  const earnLabel = isOwnerView ? "Comissão" : "Seu ganho";
  const receiveLabel = isOwnerView ? "Comissão" : "Você recebe";
  const tipHint = isOwnerView ? "100% para o barbeiro" : "100% seu";
  const topServicesHint = isOwnerView
    ? "Serviços que mais geraram comissão"
    : "Serviços que mais geraram comissão para você";
  const dayChartHint = isOwnerView
    ? "Comissão por dia com atendimento"
    : "Quanto você ganhou em cada dia com atendimento";
  const paymentsHint = isOwnerView
    ? "Como os clientes pagaram a parte dos serviços dele"
    : "Como seus clientes pagaram a parte dos seus serviços";
  const heroHint = isOwnerView
    ? `${professional.commissionPercent}% nos serviços · ${tipHint}`
    : `Sua comissão · ${professional.commissionPercent}% nos serviços`;

  const serviceRows = useMemo(() => {
    if (!isSingleDay) {
      return [...professional.serviceBreakdown].sort(
        (a, b) => b.commissionCents - a.commissionCents
      );
    }

    const map = new Map<string, CommissionServiceBreakdownRow>();
    for (const comanda of comandas) {
      for (const item of comanda.items) {
        const key = `${item.isTip ? "tip" : "svc"}:${item.serviceName}`;
        const existing = map.get(key) ?? {
          serviceName: item.serviceName,
          isTip: item.isTip,
          quantity: 0,
          grossCents: 0,
          commissionCents: 0,
        };
        existing.quantity += 1;
        existing.grossCents += item.chargedPriceCents;
        existing.commissionCents += item.commissionCents;
        map.set(key, existing);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.commissionCents - a.commissionCents
    );
  }, [comandas, isSingleDay, professional.serviceBreakdown]);

  const summary = professional.summary;
  const serviceRevenueCents = commissionServiceRevenueCents(summary);

  const bestDay = useMemo(() => {
    if (dayRows.length === 0) return null;
    return [...dayRows].sort(
      (a, b) => b.commissionCents - a.commissionCents
    )[0];
  }, [dayRows]);

  const topServices = useMemo(
    () =>
      serviceRows
        .filter((row) => !row.isTip)
        .slice(0, 5)
        .map((row) => ({
          label: row.serviceName,
          value: row.commissionCents,
          sublabel: `${row.quantity}x`,
        })),
    [serviceRows]
  );

  const chartDays = useMemo(() => {
    const slice = dayRows.length > 14 ? dayRows.slice(-14) : dayRows;
    return slice.map((row) => ({
      label: shortDate(row.date),
      value: row.commissionCents,
    }));
  }, [dayRows]);

  const paymentRows = professional.byPaymentMethod;
  const activePaymentMethods = PAYMENT_METHODS.filter(
    (method) => paymentRows[method] > 0
  );
  const paymentTotal = activePaymentMethods.reduce(
    (sum, method) => sum + paymentRows[method],
    0
  );

  const maxDayCommission = Math.max(
    ...dayRows.map((day) => day.commissionCents),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {professional.professionalNickname}
            </p>
            <p className="text-xs text-muted-foreground">{heroHint}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
              {formatPriceBRL(summary.commissionCents)}
            </p>
            {isOwnerView && (
              <PayCommissionButton
                from={from}
                to={to}
                professionalId={professional.professionalId}
                professionalNickname={professional.professionalNickname}
                amountCents={summary.commissionCents}
                label="Registrar pagamento"
              />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {summary.serviceItemCount} atendimento
          {summary.serviceItemCount === 1 ? "" : "s"}
          {" · "}
          {formatPriceBRL(serviceRevenueCents)} em serviços
          {summary.tipCents > 0
            ? ` · ${formatPriceBRL(summary.tipCents)} gorjeta`
            : ""}
          {bestDay && !isSingleDay
            ? ` · melhor dia ${formatDateBR(bestDay.date)}`
            : ""}
        </p>
        {isSingleDay && activeDay ? (
          <div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${from}`}>
                <CalendarDays className="size-4" />
                {isOwnerView
                  ? "Ver agenda neste dia"
                  : "Ver sua agenda neste dia"}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Tabs defaultValue="atendimentos" className="w-full">
        <TabsList>
          <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          {!isSingleDay && <TabsTrigger value="dias">Dias</TabsTrigger>}
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="resumo">Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="atendimentos">
          {comandas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <ClipboardList className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum atendimento neste período.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {isSingleDay && (
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(from)}
                </p>
              )}
              {comandas.map((comanda) => (
                <AtendimentoCard
                  key={comanda.comandaId}
                  comanda={comanda}
                  receiveLabel={receiveLabel}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="servicos">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <ServiceTable rows={serviceRows} earnLabel={earnLabel} />
            </CardContent>
          </Card>
        </TabsContent>

        {!isSingleDay && (
          <TabsContent value="dias">
            {dayRows.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum dia com atendimento no período.
              </p>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <DayTable
                    rows={dayRows}
                    maxDayCommission={maxDayCommission}
                    buildDayHref={buildDayHref}
                    earnLabel={earnLabel}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="pagamentos">
          <CommissionPayoutHistory
            payouts={payouts}
            viewer={isOwnerView ? "owner" : "self"}
          />
        </TabsContent>

        <TabsContent value="resumo" className="space-y-4">
          {!isSingleDay && chartDays.length > 0 && (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="size-4" />
                  Comissão dia a dia
                </h2>
                <p className="text-xs text-muted-foreground">{dayChartHint}</p>
              </div>
              <Card>
                <CardContent className="pt-5">
                  <VerticalBarChart items={chartDays} height={160} />
                </CardContent>
              </Card>
            </section>
          )}

          {topServices.length > 0 && (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Scissors className="size-4" />
                  O que mais rendeu
                </h2>
                <p className="text-xs text-muted-foreground">{topServicesHint}</p>
              </div>
              <Card>
                <CardContent className="pt-5">
                  <HorizontalBarChart items={topServices} />
                </CardContent>
              </Card>
            </section>
          )}

          {activePaymentMethods.length > 0 && (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="size-4" />
                  Formas de pagamento
                </h2>
                <p className="text-xs text-muted-foreground">{paymentsHint}</p>
              </div>
              <Card>
                <CardContent className="flex flex-col gap-3 pt-5">
                  {activePaymentMethods.map((method) => {
                    const amount = paymentRows[method];
                    const pct =
                      paymentTotal > 0
                        ? Math.round((amount / paymentTotal) * 100)
                        : 0;
                    return (
                      <div key={method} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {formatPaymentMethodLabel(method)}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatPriceBRL(amount)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/80"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          )}

          {!isSingleDay &&
            chartDays.length === 0 &&
            topServices.length === 0 &&
            activePaymentMethods.length === 0 && (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nada para resumir neste período.
              </p>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
