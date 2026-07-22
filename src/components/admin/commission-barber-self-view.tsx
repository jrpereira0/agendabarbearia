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
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type CommissionBarberSelfViewProps = {
  professional: CommissionProfessionalReport;
  from: string;
  to: string;
  buildDayHref: (date: string) => string;
  /** "self" = barbeiro vendo a própria comissão; "owner" = dono detalhando. */
  viewer?: "self" | "owner";
  payouts?: CommissionPayout[];
  /** Quando o PageHeader já mostra nome e CTA de pagamento. */
  hideIdentityHeader?: boolean;
  /** Dentro do painel lista+detalhe: cards mais leves, sem “caixa dentro de caixa”. */
  embedded?: boolean;
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
      <p className="px-4 py-8 text-center text-sm text-[#8b8d93]">
        Nenhum serviço no período.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li
            key={`${row.isTip ? "tip" : "svc"}:${row.serviceName}`}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium leading-snug">{row.serviceName}</p>
              <p className="text-xs text-[#8b8d93]">
                {row.quantity}x
                {row.isTip ? " · gorjeta" : ""}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatPriceBRL(row.commissionCents)}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs text-[#8b8d93]">
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
                    <span className="ml-2 text-xs font-normal text-[#8b8d93]">
                      gorjeta
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.quantity}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatPriceBRL(row.commissionCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AtendimentoCard({
  comanda,
  receiveLabel,
  panelClass = ADMIN_SURFACE.panel,
}: {
  comanda: CommissionComandaDetail;
  receiveLabel: string;
  panelClass?: string;
}) {
  const customerLabel =
    comanda.customerName?.trim() ||
    formatWhatsapp(comanda.customerWhatsapp) ||
    "Cliente";

  return (
    <div className={cn(panelClass, "flex flex-col gap-3 p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
              {customerLabel}
            </p>
            <p className="mt-0.5 text-xs text-[#8b8d93]">
              {formatDateBR(comanda.serviceDate)}
              {comanda.serviceItemCount > 0
                ? ` · ${comanda.serviceItemCount} serviço${
                    comanda.serviceItemCount === 1 ? "" : "s"
                  }`
                : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-[#8b8d93]">{receiveLabel}</p>
            <p className="text-base font-semibold tabular-nums text-[#f5f5f5]">
              {formatPriceBRL(comanda.commissionCents)}
            </p>
          </div>
        </div>

        {comanda.items.length > 0 ? (
          <ul className="divide-y rounded-lg border border-[var(--page-border,rgb(255_255_255_/_10%))]">
            {comanda.items.map((item, index) => (
              <li
                key={`${item.serviceName}-${index}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {item.serviceName}
                  {item.isTip ? (
                    <span className="ml-1 text-xs text-[#8b8d93]">
                      gorjeta
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-[#8b8d93]">
                  {formatPriceBRL(item.commissionCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
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
    <>
      <ul className="divide-y md:hidden">
        {rows.map((row) => {
          const isActive = activeDate === row.date;
          return (
            <li key={row.date}>
              <Link
                href={buildDayHref(row.date)}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 active:bg-muted/40",
                  isActive && "bg-muted/30"
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">{formatDateBR(row.date)}</p>
                  <p className="text-xs text-[#8b8d93]">
                    {row.serviceItemCount} serviço
                    {row.serviceItemCount === 1 ? "" : "s"}
                  </p>
                  <div
                    className={cn(
                      "mt-1.5 h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full",
                      ADMIN_SURFACE.progress
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        ADMIN_SURFACE.progressBar
                      )}
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
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatPriceBRL(row.commissionCents)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs text-[#8b8d93]">
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
                      <div
                        className={cn(
                          "mt-1.5 h-1 w-full max-w-[8rem] overflow-hidden rounded-full",
                          ADMIN_SURFACE.progress
                        )}
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            ADMIN_SURFACE.progressBar
                          )}
                          style={{
                            width: `${
                              maxDayCommission > 0
                                ? Math.round(
                                    (row.commissionCents / maxDayCommission) *
                                      100
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
    </>
  );
}

export function CommissionBarberSelfView({
  professional,
  from,
  to,
  buildDayHref,
  viewer = "self",
  payouts = [],
  hideIdentityHeader = false,
  embedded = false,
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

  const metricCount =
    2 +
    (summary.tipCents > 0 ? 1 : 0) +
    (bestDay && !isSingleDay ? 1 : 0);

  const panelClass = embedded
    ? "rounded-xl border border-white/10 bg-[#1a1b1e] text-[#f5f5f5]"
    : ADMIN_SURFACE.panel;

  return (
    <div className="flex flex-col gap-5">
      {!hideIdentityHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
              {professional.professionalNickname}
            </p>
            <p className="mt-0.5 text-xs text-[#8b8d93]">{heroHint}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div>
              <p className="text-xs text-[#8b8d93]">
                {isOwnerView ? "A pagar" : "Você recebe"}
              </p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#f5f5f5] sm:text-3xl">
                {formatPriceBRL(summary.commissionCents)}
              </p>
            </div>
            {isOwnerView ? (
              <PayCommissionButton
                from={from}
                to={to}
                professionalId={professional.professionalId}
                professionalNickname={professional.professionalNickname}
                amountCents={summary.commissionCents}
                label="Registrar pagamento"
                className={cn(
                  ADMIN_SURFACE.btnPrimary,
                  "h-10 w-full sm:h-9 sm:w-auto"
                )}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          <p className={ADMIN_SURFACE.sectionLabel}>
            {isOwnerView ? "A pagar no período" : "Você recebe"}
          </p>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-[#f5f5f5]">
            {formatPriceBRL(summary.commissionCents)}
          </p>
          <p className="mt-1.5 text-xs text-[#8b8d93]">{heroHint}</p>
        </div>
      )}

      <div
        className={cn(
          "grid gap-2",
          metricCount >= 4
            ? "sm:grid-cols-2 xl:grid-cols-4"
            : metricCount === 3
              ? "sm:grid-cols-3"
              : "sm:grid-cols-2"
        )}
      >
        <div className={cn(panelClass, "px-3.5 py-3")}>
          <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
            Atendimentos
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[#f5f5f5]">
            {summary.serviceItemCount}
          </p>
        </div>
        <div className={cn(panelClass, "px-3.5 py-3")}>
          <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
            Em serviços
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[#f5f5f5]">
            {formatPriceBRL(serviceRevenueCents)}
          </p>
        </div>
        {summary.tipCents > 0 ? (
          <div className={cn(panelClass, "px-3.5 py-3")}>
            <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
              Gorjetas
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#f5f5f5]">
              {formatPriceBRL(summary.tipCents)}
            </p>
          </div>
        ) : null}
        {bestDay && !isSingleDay ? (
          <div className={cn(panelClass, "px-3.5 py-3")}>
            <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
              Melhor dia
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#f5f5f5]">
              {formatPriceBRL(bestDay.commissionCents)}
            </p>
            <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
              {formatDateBR(bestDay.date)}
            </p>
          </div>
        ) : null}
      </div>

      {isSingleDay && activeDay ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            className={ADMIN_SURFACE.btnGhost}
            asChild
          >
            <Link href={`/admin?date=${from}`}>
              <CalendarDays className="size-4" />
              {isOwnerView
                ? "Ver agenda neste dia"
                : "Ver sua agenda neste dia"}
            </Link>
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="atendimentos" className="w-full">
        <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto w-max min-w-full gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            <TabsTrigger
              value="atendimentos"
              className="shrink-0 rounded-lg px-3 py-2 text-xs text-[#8b8d93] data-[state=active]:bg-[#1a1b1e] data-[state=active]:text-[#ecf15e] data-[state=active]:shadow-none sm:text-sm"
            >
              Atendimentos
            </TabsTrigger>
            <TabsTrigger
              value="servicos"
              className="shrink-0 rounded-lg px-3 py-2 text-xs text-[#8b8d93] data-[state=active]:bg-[#1a1b1e] data-[state=active]:text-[#ecf15e] data-[state=active]:shadow-none sm:text-sm"
            >
              Por serviço
            </TabsTrigger>
            {!isSingleDay ? (
              <TabsTrigger
                value="dias"
                className="shrink-0 rounded-lg px-3 py-2 text-xs text-[#8b8d93] data-[state=active]:bg-[#1a1b1e] data-[state=active]:text-[#ecf15e] data-[state=active]:shadow-none sm:text-sm"
              >
                Por dia
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="repasses"
              className="shrink-0 rounded-lg px-3 py-2 text-xs text-[#8b8d93] data-[state=active]:bg-[#1a1b1e] data-[state=active]:text-[#ecf15e] data-[state=active]:shadow-none sm:text-sm"
            >
              Repasses
            </TabsTrigger>
            <TabsTrigger
              value="resumo"
              className="shrink-0 rounded-lg px-3 py-2 text-xs text-[#8b8d93] data-[state=active]:bg-[#1a1b1e] data-[state=active]:text-[#ecf15e] data-[state=active]:shadow-none sm:text-sm"
            >
              Resumo
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="atendimentos" className="mt-4">
          {comandas.length === 0 ? (
            <div
              className={cn(
                panelClass,
                "flex flex-col items-center gap-2 px-4 py-10 text-center"
              )}
            >
              <ClipboardList className={cn("size-5", ADMIN_SURFACE.muted)} />
              <p className={cn("text-sm", ADMIN_SURFACE.muted)}>
                Nenhum atendimento neste período.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {isSingleDay ? (
                <p className="text-xs text-[#8b8d93]">{formatDateBR(from)}</p>
              ) : null}
              {comandas.map((comanda) => (
                <AtendimentoCard
                  key={comanda.comandaId}
                  comanda={comanda}
                  receiveLabel={receiveLabel}
                  panelClass={panelClass}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="servicos" className="mt-4">
          <div className={cn(panelClass, "overflow-hidden")}>
            <ServiceTable rows={serviceRows} earnLabel={earnLabel} />
          </div>
        </TabsContent>

        {!isSingleDay ? (
          <TabsContent value="dias" className="mt-4">
            {dayRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[#8b8d93]">
                Nenhum dia com atendimento no período.
              </p>
            ) : (
              <div className={cn(panelClass, "overflow-hidden")}>
                <DayTable
                  rows={dayRows}
                  maxDayCommission={maxDayCommission}
                  buildDayHref={buildDayHref}
                  earnLabel={earnLabel}
                />
              </div>
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="repasses" className="mt-4">
          <CommissionPayoutHistory
            payouts={payouts}
            viewer={isOwnerView ? "owner" : "self"}
          />
        </TabsContent>

        <TabsContent value="resumo" className="mt-4 space-y-4">
          {!isSingleDay && chartDays.length > 0 ? (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="size-4" />
                  Comissão dia a dia
                </h2>
                <p className="text-xs text-[#8b8d93]">{dayChartHint}</p>
              </div>
              <div className={cn(panelClass, "px-4 pt-5 pb-4")}>
                  <VerticalBarChart items={chartDays} height={160} />
                </div>
            </section>
          ) : null}

          {topServices.length > 0 ? (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Scissors className="size-4" />
                  O que mais rendeu
                </h2>
                <p className="text-xs text-[#8b8d93]">{topServicesHint}</p>
              </div>
              <div className={cn(panelClass, "px-4 pt-5 pb-4")}>
                  <HorizontalBarChart items={topServices} />
                </div>
            </section>
          ) : null}

          {activePaymentMethods.length > 0 ? (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="size-4" />
                  Formas de pagamento
                </h2>
                <p className="text-xs text-[#8b8d93]">{paymentsHint}</p>
              </div>
              <div className={cn(panelClass, "flex flex-col gap-3 px-4 pt-5 pb-4")}>
                  {activePaymentMethods.map((method) => {
                    const amount = paymentRows[method];
                    const pct =
                      paymentTotal > 0
                        ? Math.round((amount / paymentTotal) * 100)
                        : 0;
                    return (
                      <div key={method} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-[#8b8d93]">
                            {formatPaymentMethodLabel(method)}
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatPriceBRL(amount)}
                            <span className="ml-1 text-xs font-normal text-[#8b8d93]">
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div
                          className={cn(
                            "h-1.5 overflow-hidden rounded-full",
                            ADMIN_SURFACE.progress
                          )}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              ADMIN_SURFACE.progressBar
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
            </section>
          ) : null}

          {!isSingleDay &&
          chartDays.length === 0 &&
          topServices.length === 0 &&
          activePaymentMethods.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[#8b8d93]">
              Nada para resumir neste período.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
