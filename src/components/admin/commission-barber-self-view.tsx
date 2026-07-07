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
import {
  HorizontalBarChart,
  SparklineBars,
  VerticalBarChart,
} from "@/components/admin/finance-charts";
import {
  commissionServiceRevenueCents,
  formatPaymentMethodLabel,
  type CommissionComandaDetail,
  type CommissionDayRow,
  type CommissionProfessionalReport,
  type CommissionServiceBreakdownRow,
} from "@/lib/finance-reports";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL, formatWhatsapp } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type CommissionBarberSelfViewProps = {
  professional: CommissionProfessionalReport;
  from: string;
  to: string;
  buildDayHref: (date: string) => string;
};

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function MetricTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function SelfServiceTable({
  rows,
}: {
  rows: CommissionServiceBreakdownRow[];
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
            <th className="px-4 py-3 font-medium text-right">Seu ganho</th>
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

function SelfAtendimentoCard({ comanda }: { comanda: CommissionComandaDetail }) {
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
          <p className="text-xs text-muted-foreground">Você recebe</p>
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

function SelfDayTable({
  rows,
  maxDayCommission,
  buildDayHref,
  activeDate,
}: {
  rows: CommissionDayRow[];
  maxDayCommission: number;
  buildDayHref: (date: string) => string;
  activeDate?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Dia</th>
            <th className="px-4 py-3 font-medium text-right">Serviços</th>
            <th className="px-4 py-3 font-medium text-right">Seu ganho</th>
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
}: CommissionBarberSelfViewProps) {
  const isSingleDay = from === to;
  const dayRows = professional.byDay.filter((row) => row.serviceItemCount > 0);
  const activeDay = isSingleDay
    ? professional.byDay.find((day) => day.date === from)
    : null;
  const comandas = isSingleDay
    ? professional.comandas.filter((comanda) => comanda.serviceDate === from)
    : professional.comandas;

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
  const activeDays = dayRows.length;
  const avgPerService =
    summary.serviceItemCount > 0
      ? Math.round(summary.commissionCents / summary.serviceItemCount)
      : 0;
  const avgPerActiveDay =
    activeDays > 0 ? Math.round(summary.commissionCents / activeDays) : 0;

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
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-muted/20 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {formatPeriodLabel(from, to)}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                {formatPriceBRL(summary.commissionCents)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sua comissão no período · {professional.commissionPercent}% nos
                serviços
              </p>
            </div>
            {!isSingleDay && dayRows.length > 1 && (
              <div className="w-full sm:max-w-[200px]">
                <p className="mb-2 text-xs text-muted-foreground">
                  Evolução diária
                </p>
                <SparklineBars
                  values={dayRows.map((day) => day.commissionCents)}
                  height={44}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            className="rounded-none border-0 bg-card"
            label="Serviços realizados"
            value={String(summary.serviceItemCount)}
            hint="Cortes, barbas e demais"
          />
          <MetricTile
            className="rounded-none border-0 bg-card"
            label="Gorjetas"
            value={formatPriceBRL(summary.tipCents)}
            hint="100% seu"
          />
          <MetricTile
            className="rounded-none border-0 bg-card"
            label="Média por serviço"
            value={formatPriceBRL(avgPerService)}
            hint="Comissão em cada atendimento"
          />
          <MetricTile
            className="rounded-none border-0 bg-card"
            label="Média por dia ativo"
            value={formatPriceBRL(avgPerActiveDay)}
            hint={
              activeDays > 0
                ? `${activeDays} dia${activeDays === 1 ? "" : "s"} com serviço`
                : "Nenhum dia com serviço"
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricTile
          label="Valor dos seus serviços"
          value={formatPriceBRL(serviceRevenueCents)}
          hint="Só o que você fez, sem gorjeta"
        />
        {bestDay && !isSingleDay && (
          <MetricTile
            label="Melhor dia"
            value={formatPriceBRL(bestDay.commissionCents)}
            hint={`${formatDateBR(bestDay.date)} · ${bestDay.serviceItemCount} serviços`}
          />
        )}
        {isSingleDay && activeDay && (
          <MetricTile
            label="Neste dia"
            value={formatPriceBRL(activeDay.commissionCents)}
            hint={`${activeDay.serviceItemCount} serviços · ${formatDateBR(from)}`}
          />
        )}
      </div>

      {isSingleDay && activeDay && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin?date=${from}`}>
              <CalendarDays className="size-4" />
              Ver sua agenda neste dia
            </Link>
          </Button>
        </div>
      )}

      {!isSingleDay && chartDays.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="size-4" />
              Comissão dia a dia
            </h2>
            <p className="text-xs text-muted-foreground">
              Quanto você ganhou em cada dia com atendimento
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <VerticalBarChart items={chartDays} height={180} />
            </CardContent>
          </Card>
        </section>
      )}

      {topServices.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Scissors className="size-4" />
              O que mais rendeu
            </h2>
            <p className="text-xs text-muted-foreground">
              Serviços que mais geraram comissão para você
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <HorizontalBarChart items={topServices} />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Scissors className="size-4" />
            Detalhe por serviço
          </h2>
          <p className="text-xs text-muted-foreground">
            Quantidade e quanto cada serviço rendeu para você
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <SelfServiceTable rows={serviceRows} />
          </CardContent>
        </Card>
      </section>

      {!isSingleDay && dayRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">Dia a dia</h2>
            <p className="text-xs text-muted-foreground">
              Toque no dia para ver o detalhe completo
            </p>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <SelfDayTable
                rows={dayRows}
                maxDayCommission={maxDayCommission}
                buildDayHref={buildDayHref}
              />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="size-4" />
            Por cliente
            {isSingleDay && ` · ${formatDateBR(from)}`}
          </h2>
          <p className="text-xs text-muted-foreground">
            Cada atendimento finalizado e quanto você recebeu
          </p>
        </div>
        {comandas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum atendimento neste período.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {comandas.map((comanda) => (
              <SelfAtendimentoCard key={comanda.comandaId} comanda={comanda} />
            ))}
          </div>
        )}
      </section>

      {activePaymentMethods.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="size-4" />
              Formas de pagamento
            </h2>
            <p className="text-xs text-muted-foreground">
              Como seus clientes pagaram a parte dos seus serviços
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
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
    </div>
  );
}
