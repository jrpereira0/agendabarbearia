"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Percent,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import {
  formatPaymentMethodLabel,
  type FinanceMetricsReport,
} from "@/lib/finance-reports";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL } from "@/lib/format";
import { shiftDate, monthStart, formatPeriodLabel } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type FinanceViewProps = {
  from: string;
  to: string;
  today: string;
  report: FinanceMetricsReport;
};

function formatChange(changePercent: number | null): string {
  if (changePercent === null) return "—";
  if (changePercent > 0) return `+${changePercent}%`;
  return `${changePercent}%`;
}

function MetricCard({
  label,
  value,
  hint,
  change,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number | null;
}) {
  const hasChange = change !== undefined && change !== null;
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;

  return (
    <div className="rounded-xl border px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {hasChange && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              isPositive && "text-foreground",
              isNegative && "text-muted-foreground",
              !isPositive && !isNegative && "text-muted-foreground"
            )}
          >
            {isPositive && <TrendingUp className="size-3" />}
            {isNegative && <TrendingDown className="size-3" />}
            {formatChange(change)} vs período anterior
          </span>
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatPriceBRL(value)}
          {suffix && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/80 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FinanceView({
  from,
  to,
  today,
  report,
}: FinanceViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  const isSingleDay = from === to;
  const isToday = isSingleDay && from === today;
  const hasData = report.totals.comandaCount > 0;

  const activePaymentMethods = useMemo(
    () =>
      PAYMENT_METHODS.filter((method) => report.byPaymentMethod[method] > 0),
    [report.byPaymentMethod]
  );

  const maxDayTotal = useMemo(
    () => Math.max(...report.byDay.map((day) => day.totalCents), 0),
    [report.byDay]
  );

  const topProfessional = useMemo(() => {
    if (report.professionals.length === 0) return null;
    return [...report.professionals].sort((a, b) => b.totalCents - a.totalCents)[0];
  }, [report.professionals]);

  const daysWithSales = useMemo(
    () => report.byDay.filter((day) => day.comandaCount > 0),
    [report.byDay]
  );

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    router.push(`/admin/financeiro?${params.toString()}`);
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    router.push(
      `/admin/financeiro?from=${presetFrom}&to=${presetTo}`
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Financeiro"
        description="Métricas e indicadores para analisar o desempenho da barbearia."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/financeiro/comissoes?from=${from}&to=${to}`}>
                <Percent className="size-4" />
                Comissões
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/financeiro/caixas">
                <Wallet className="size-4" />
                Caixas
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${to}`}>
                <CalendarDays className="size-4" />
                Agenda
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={applyFilter} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {formatPeriodLabel(from, to)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {isToday
                    ? "Hoje · "
                    : isSingleDay
                      ? "Um dia · "
                      : `${report.periodDayCount} dias · `}
                  {report.activeDays} com movimentação
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(today, today)}
                >
                  Hoje
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(shiftDate(today, -6), today)}
                >
                  7 dias
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(monthStart(today), today)}
                >
                  Este mês
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="finance-from">Data inicial</Label>
                <Input
                  id="finance-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-to">Data final</Label>
                <Input
                  id="finance-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto">
                  Analisar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Sem dados no período"
          description="Não há comandas fechadas entre essas datas. Ajuste o período ou feche atendimentos na agenda."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${to}`}>Abrir agenda</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Faturamento"
              value={formatPriceBRL(report.totals.totalCents)}
              hint={`${report.totals.comandaCount} comandas`}
              change={report.comparison?.changePercent ?? null}
            />
            <MetricCard
              label="Ticket médio"
              value={formatPriceBRL(report.averageTicketCents)}
              hint="Por comanda fechada"
            />
            <MetricCard
              label="Comissões"
              value={formatPriceBRL(report.totals.commissionCents)}
              hint={`${report.commissionRatePercent}% do faturamento`}
            />
            <MetricCard
              label="Barbearia"
              value={formatPriceBRL(report.totals.shopCents)}
              hint={`${report.shopRatePercent}% do faturamento`}
            />
          </div>

          {report.comparison && (
            <p className="text-xs text-muted-foreground">
              Período anterior ({formatPeriodLabel(
                report.comparison.previousFrom,
                report.comparison.previousTo
              )}
              ): {formatPriceBRL(report.comparison.totalCents)} em{" "}
              {report.comparison.comandaCount} comandas.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Evolução diária */}
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-medium">Evolução diária</h2>
                <p className="text-xs text-muted-foreground">
                  Faturamento por dia do caixa
                </p>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="max-h-[22rem] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 border-b bg-background">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2.5 font-medium">Dia</th>
                          <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                            Comandas
                          </th>
                          <th className="px-4 py-2.5 font-medium text-right">
                            Faturamento
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {daysWithSales.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-8 text-center text-muted-foreground"
                            >
                              Nenhum dia com vendas.
                            </td>
                          </tr>
                        ) : (
                          daysWithSales.map((day) => (
                            <tr key={day.date} className="border-b last:border-b-0">
                              <td className="px-4 py-3">
                                <p className="font-medium">
                                  {formatDateBR(day.date)}
                                </p>
                                <div className="mt-1.5 h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-muted sm:max-w-none">
                                  <div
                                    className="h-full rounded-full bg-foreground/70"
                                    style={{
                                      width: `${
                                        maxDayTotal > 0
                                          ? Math.round(
                                              (day.totalCents / maxDayTotal) *
                                                100
                                            )
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                                {day.comandaCount}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                {formatPriceBRL(day.totalCents)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Mix de pagamentos */}
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-medium">Formas de pagamento</h2>
                <p className="text-xs text-muted-foreground">
                  Distribuição do faturamento no período
                </p>
              </div>
              <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                  {activePaymentMethods.map((method: PaymentMethod) => {
                    const amount = report.byPaymentMethod[method];
                    const pct =
                      report.totals.totalCents > 0
                        ? Math.round((amount / report.totals.totalCents) * 100)
                        : 0;
                    return (
                      <BarRow
                        key={method}
                        label={formatPaymentMethodLabel(method)}
                        value={amount}
                        max={report.totals.totalCents}
                        suffix={`${pct}%`}
                      />
                    );
                  })}
                </CardContent>
              </Card>

              {topProfessional && (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Destaque do período
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {topProfessional.professionalNickname}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Maior faturamento ·{" "}
                      {formatPriceBRL(topProfessional.totalCents)} ·{" "}
                      {topProfessional.comandaCount} atendimentos
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* Performance por barbeiro */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Users className="size-4" />
                  Performance por barbeiro
                </h2>
                <p className="text-xs text-muted-foreground">
                  Faturamento, comissão e participação no período
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/financeiro/comissoes?from=${from}&to=${to}`}>
                  Detalhar comissões
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Barbeiro</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Atend.
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Faturamento
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Comissão
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Barbearia
                      </th>
                      <th className="hidden px-4 py-3 font-medium text-right md:table-cell">
                        % fat.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.professionals]
                      .sort((a, b) => b.totalCents - a.totalCents)
                      .map((row) => {
                        const shopCents = row.totalCents - row.commissionCents;
                        const share =
                          report.totals.totalCents > 0
                            ? Math.round(
                                (row.totalCents / report.totals.totalCents) * 100
                              )
                            : 0;
                        return (
                          <tr
                            key={row.professionalId}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3.5">
                              <p className="font-medium">
                                {row.professionalNickname}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {row.commissionPercent}% comissão
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {row.comandaCount}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                              {formatPriceBRL(row.totalCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatPriceBRL(row.commissionCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {formatPriceBRL(shopCents)}
                            </td>
                            <td className="hidden px-4 py-3.5 text-right tabular-nums text-muted-foreground md:table-cell">
                              {share}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {report.totals.comandaCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.totals.totalCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.totals.commissionCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.totals.shopCents)}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
