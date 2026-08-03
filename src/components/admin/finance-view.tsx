"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { FinanceMetricCard } from "@/components/admin/finance-metric-card";
import { FinanceMetricDetail } from "@/components/admin/finance-metric-detail";
import { VerticalBarChart } from "@/components/admin/finance-charts";
import type {
  FinanceDayMetric,
  FinanceMetricsReport,
} from "@/lib/finance-reports";
import type { ExpensesReport } from "@/lib/expense-service";
import {
  buildFinanceQuery,
  FINANCE_METRIC_OPTIONS,
  type FinanceMetricId,
} from "@/lib/finance-metrics";
import { formatPeriodLabel, shiftDate } from "@/lib/date-range";
import { formatPriceBRL, WEEKDAYS } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type FinanceViewProps = {
  from: string;
  to: string;
  today: string;
  metric: FinanceMetricId;
  report: FinanceMetricsReport;
  /** Dias do gráfico “últimos 7 dias” (hoje e 6 anteriores). */
  last7Days: FinanceDayMetric[];
  /** Relatório de saídas (despesas) do período. */
  expensesReport: ExpensesReport;
};

function weekdayShort(isoDate: string): string {
  const weekday = new Date(`${isoDate}T00:00:00`).getDay();
  return WEEKDAYS[weekday].slice(0, 3);
}

function dayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export function FinanceView({
  from,
  to,
  today,
  metric,
  report,
  last7Days,
  expensesReport,
}: FinanceViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [selectedMetric, setSelectedMetric] = useState<FinanceMetricId>(metric);
  const [applied, setApplied] = useState({ from, to, metric });

  // Sincroniza com a URL quando período/métrica mudam (ex: navegação pelo filtro).
  if (applied.from !== from || applied.to !== to || applied.metric !== metric) {
    setApplied({ from, to, metric });
    setFromDate(from);
    setToDate(to);
    setSelectedMetric(metric);
  }

  const expensesCents = expensesReport.totalCents;
  const hasData =
    report.totals.comandaCount > 0 ||
    report.totals.serviceItemCount > 0 ||
    report.productSales.saleLineCount > 0 ||
    expensesReport.count > 0;
  const isDetail = metric !== "geral";
  const hasMetricData =
    metric === "produtos"
      ? report.productSales.saleLineCount > 0
      : metric === "saidas"
        ? expensesReport.count > 0
        : hasData;

  const attendanceCount = report.totals.comandaCount;
  const ticketAverageCents =
    attendanceCount > 0
      ? Math.round(report.totals.servicesGrossCents / attendanceCount)
      : 0;
  const netProfitCents = report.totals.shopCents - expensesCents;

  const last7Chart = useMemo(
    () =>
      last7Days.map((day) => ({
        label: weekdayShort(day.date),
        value: day.totalCents,
        sublabel: dayMonth(day.date),
      })),
    [last7Days]
  );

  const last7TotalCents = useMemo(
    () => last7Days.reduce((sum, day) => sum + day.totalCents, 0),
    [last7Days]
  );

  function navigate(nextFrom: string, nextTo: string, nextMetric = metric) {
    router.push(
      buildFinanceQuery({ from: nextFrom, to: nextTo, metric: nextMetric })
    );
  }

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    navigate(fromDate, toDate, selectedMetric);
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    navigate(presetFrom, presetTo, selectedMetric);
  }

  function onMetricChange(value: string) {
    const next = value as FinanceMetricId;
    setSelectedMetric(next);
    navigate(from, to, next);
  }

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <PageHeader
          tone="dark"
          title="Financeiro"
          description={formatPeriodLabel(from, to)}
          action={
            <Button asChild variant="outline" size="sm" className={ADMIN_SURFACE.btnGhost}>
              <Link href="/admin/financeiro/despesas">
                <Receipt />
                Despesas
              </Link>
            </Button>
          }
        />

        <FinancePeriodFilter
          today={today}
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          onSubmit={applyFilter}
          onPreset={applyPreset}
          tone="dark"
          mobilePresetsFirst
          extraFields={
            <Select value={selectedMetric} onValueChange={onMetricChange}>
              <SelectTrigger
                aria-label="Analisar métrica"
                className={cn(
                  "h-10 w-full sm:h-8 sm:w-[13.5rem]",
                  ADMIN_SURFACE.selectTrigger
                )}
              >
                <SelectValue placeholder="Visão geral" />
              </SelectTrigger>
              <SelectContent className={ADMIN_SURFACE.popover}>
                {FINANCE_METRIC_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {!hasData && !isDetail ? (
          <EmptyState
            icon={BarChart3}
            className="border-white/10 text-[#f5f5f5]"
            title="Nada neste período"
            description="Não há atendimentos finalizados nem despesas neste intervalo. Ajuste as datas ou feche comandas na agenda."
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={ADMIN_SURFACE.btnGhost}
                  asChild
                >
                  <Link href={`/admin?date=${to}`}>Abrir agenda</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={ADMIN_SURFACE.btnGhost}
                  asChild
                >
                  <Link href={`/admin/financeiro/caixas?from=${from}&to=${to}`}>
                    <Wallet className="size-4" />
                    Caixas
                  </Link>
                </Button>
              </div>
            }
          />
        ) : isDetail ? (
          hasMetricData ? (
            <FinanceMetricDetail
              metric={metric}
              report={report}
              from={from}
              to={to}
              expensesReport={expensesReport}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              className="border-white/10 text-[#f5f5f5]"
              title="Sem dados para esta métrica"
              description={
                metric === "produtos"
                  ? "Não há venda de produto fechada neste período."
                  : metric === "saidas"
                    ? "Não há saída lançada neste período. Cadastre em Despesas."
                    : "Não há atendimento finalizado neste período. Tente outra faixa de datas."
              }
              action={
                metric === "saidas" ? (
                  <Button asChild className={ADMIN_SURFACE.btnPrimary} size="sm">
                    <Link href="/admin/financeiro/despesas">
                      <Receipt />
                      Ir para despesas
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="flex flex-col gap-5 sm:gap-6">
            <section className="flex flex-col gap-2.5">
              <p className={cn(ADMIN_SURFACE.sectionLabel)}>Resultado</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                <FinanceMetricCard
                  tone="dark"
                  label="Faturamento"
                  value={formatPriceBRL(report.totals.servicesGrossCents)}
                  hint="Serviços do período"
                  tooltip="Soma do valor dos serviços realizados no período selecionado."
                  onSelect={() => navigate(from, to, "faturamento")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Saídas"
                  value={formatPriceBRL(expensesCents)}
                  hint={
                    expensesReport.count > 0
                      ? `${expensesReport.count} lançamento${expensesReport.count === 1 ? "" : "s"} · toque`
                      : "Toque para detalhar"
                  }
                  tooltip="Aluguel, contas e outras despesas do período. Abre a métrica Saídas."
                  onSelect={() => navigate(from, to, "saidas")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Lucro líquido"
                  value={formatPriceBRL(netProfitCents)}
                  hint="Após comissões e saídas"
                  tooltip="Faturamento menos comissões dos barbeiros e menos despesas do período."
                />
              </div>
            </section>

            <section className="flex flex-col gap-2.5">
              <p className={cn(ADMIN_SURFACE.sectionLabel)}>Operação</p>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                <FinanceMetricCard
                  tone="dark"
                  label="Atendimentos"
                  value={String(attendanceCount)}
                  hint={
                    attendanceCount === 1
                      ? "1 comanda"
                      : `${attendanceCount} comandas`
                  }
                  tooltip="Quantidade de comandas finalizadas no período."
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Ticket médio"
                  value={formatPriceBRL(ticketAverageCents)}
                  hint="Por atendimento"
                  tooltip="Faturamento dividido pelo número de atendimentos (comandas)."
                  onSelect={() => navigate(from, to, "ticket")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Comissões"
                  value={formatPriceBRL(report.totals.commissionCents)}
                  hint={`${report.commissionRatePercent}% do faturamento`}
                  tooltip="Quanto do faturamento vai para os barbeiros em comissão."
                  onSelect={() => navigate(from, to, "comissoes")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Produtos"
                  value={formatPriceBRL(report.productSales.totalRevenueCents)}
                  hint={
                    report.productSales.totalQuantity > 0
                      ? `${report.productSales.totalQuantity} un. · toque`
                      : "Toque para detalhar"
                  }
                  tooltip="Faturamento só de produtos. Abre a métrica Produtos vendidos."
                  onSelect={() => navigate(from, to, "produtos")}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn(ADMIN_SURFACE.sectionLabel)}>
                    Últimos 7 dias
                  </p>
                  <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
                    {formatPeriodLabel(shiftDate(today, -6), today)}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    ADMIN_SURFACE.accent
                  )}
                >
                  {formatPriceBRL(last7TotalCents)}
                </p>
              </div>
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart items={last7Chart} height={148} />
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
