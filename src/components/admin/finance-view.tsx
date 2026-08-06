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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { FinanceMetricCard } from "@/components/admin/finance-metric-card";
import { FinanceMetricDetail } from "@/components/admin/finance-metric-detail";
import {
  MiniDonut,
  MiniRing,
  VerticalBarChart,
} from "@/components/admin/finance-charts";
import { formatOccupancyHours } from "@/lib/agenda-occupancy";
import type {
  FinanceDayMetric,
  FinanceMetricsReport,
} from "@/lib/finance-reports";
import type { ExpensesReport } from "@/lib/expense-service";
import {
  buildFinanceQuery,
  FINANCE_METRIC_GROUPS,
  trendFromPercent,
  trendFromPoints,
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
    expensesReport.count > 0 ||
    report.cancellation.totalCount > 0 ||
    report.retention.totalCustomers > 0 ||
    report.occupancy.availableMinutes > 0;
  const isDetail = metric !== "geral";
  const hasMetricData =
    metric === "produtos"
      ? report.productSales.saleLineCount > 0
      : metric === "saidas"
        ? expensesReport.count > 0
        : metric === "cancelamentos"
          ? report.cancellation.totalCount > 0
          : metric === "clientes"
            ? report.retention.totalCustomers > 0
            : metric === "ocupacao"
              ? report.occupancy.availableMinutes > 0
            : hasData;

  const attendanceCount = report.totals.comandaCount;
  const ticketAverageCents =
    attendanceCount > 0
      ? Math.round(report.totals.servicesGrossCents / attendanceCount)
      : 0;
  const netProfitCents = report.totals.shopCents - expensesCents;

  const faturamentoTrend = trendFromPercent(
    report.comparison?.servicesGrossChangePercent ?? null
  );
  const atendimentosTrend = trendFromPercent(
    report.comparison?.serviceChangePercent ?? null
  );
  const ticketTrend = trendFromPercent(
    report.comparison?.averageServiceChangePercent ?? null
  );
  const comissoesTrend = trendFromPercent(
    report.comparison?.commissionChangePercent ?? null
  );
  const cancelamentosTrend = trendFromPoints(
    report.cancellation.ratePointsChange
  );
  const clientesTrend = trendFromPoints(report.retention.newPointsChange);
  const ocupacaoTrend = trendFromPoints(report.occupancy.ratePointsChange);

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
          title="Métricas"
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
                  "h-10 w-full sm:h-8 sm:w-[15rem]",
                  ADMIN_SURFACE.selectTrigger
                )}
              >
                <SelectValue placeholder="Visão geral" />
              </SelectTrigger>
              <SelectContent className={cn(ADMIN_SURFACE.popover, "min-w-[16rem]")}>
                {FINANCE_METRIC_GROUPS.map((group, groupIndex) => (
                  <SelectGroup key={group.label ?? "geral"}>
                    {groupIndex > 0 ? (
                      <SelectSeparator className="my-1.5 bg-white/10" />
                    ) : null}
                    {group.label ? (
                      <SelectLabel className="px-2.5 py-1.5 text-[10px] font-medium tracking-[0.14em] text-[#ecf15e] uppercase">
                        {group.label}
                      </SelectLabel>
                    ) : null}
                    {group.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
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
                    : metric === "cancelamentos"
                      ? "Não há agendamento cadastrado neste período."
                      : metric === "clientes"
                        ? "Não há cliente com WhatsApp agendado neste período."
                        : metric === "ocupacao"
                          ? "Não há horário de trabalho cadastrado neste período."
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
                  trend={faturamentoTrend}
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
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                <FinanceMetricCard
                  tone="dark"
                  label="Atendimentos"
                  value={String(attendanceCount)}
                  hint={
                    attendanceCount === 1
                      ? "1 comanda finalizada"
                      : `${attendanceCount} comandas finalizadas`
                  }
                  tooltip="Quantidade de comandas finalizadas no período."
                  trend={atendimentosTrend}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Ticket médio"
                  value={formatPriceBRL(ticketAverageCents)}
                  hint="Por atendimento"
                  tooltip="Faturamento dividido pelo número de atendimentos (comandas)."
                  trend={ticketTrend}
                  onSelect={() => navigate(from, to, "ticket")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Comissões"
                  value={formatPriceBRL(report.totals.commissionCents)}
                  hint={`${report.commissionRatePercent}% do faturamento`}
                  tooltip="Quanto do faturamento vai para os barbeiros em comissão."
                  trend={comissoesTrend}
                  visual={<MiniRing percent={report.commissionRatePercent} />}
                  onSelect={() => navigate(from, to, "comissoes")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Produtos"
                  value={formatPriceBRL(report.productSales.totalRevenueCents)}
                  hint={
                    report.productSales.totalQuantity > 0
                      ? `${report.productSales.totalQuantity} un. vendidas · toque`
                      : "Toque para detalhar"
                  }
                  tooltip="Faturamento só de produtos. Abre a métrica Produtos vendidos."
                  onSelect={() => navigate(from, to, "produtos")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Clientes novos"
                  value={String(report.retention.newCount)}
                  hint={
                    report.retention.totalCustomers > 0
                      ? `${report.retention.newPercent}% novos · ${report.retention.recurringCount} recorrente${report.retention.recurringCount === 1 ? "" : "s"}`
                      : "Toque para detalhar"
                  }
                  tooltip="Clientes cuja primeira visita (com WhatsApp) caiu neste período."
                  trend={clientesTrend}
                  visual={
                    <MiniDonut
                      slices={[
                        {
                          label: "Novos",
                          value: report.retention.newCount,
                          className: "text-[#ecf15e]",
                        },
                        {
                          label: "Recorrentes",
                          value: report.retention.recurringCount,
                          className: "text-white/35",
                        },
                      ]}
                    />
                  }
                  onSelect={() => navigate(from, to, "clientes")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Ocupação"
                  value={`${report.occupancy.ratePercent}%`}
                  hint={
                    report.occupancy.availableMinutes > 0
                      ? `${formatOccupancyHours(report.occupancy.occupiedMinutes)} de ${formatOccupancyHours(report.occupancy.availableMinutes)} · toque`
                      : "Toque para detalhar"
                  }
                  tooltip="Quanto da grade dos barbeiros estava preenchida no período (sem contar encaixes nem cancelados)."
                  trend={ocupacaoTrend}
                  visual={<MiniRing percent={report.occupancy.ratePercent} />}
                  onSelect={() => navigate(from, to, "ocupacao")}
                />
                <FinanceMetricCard
                  tone="dark"
                  label="Cancelamentos"
                  value={`${report.cancellation.ratePercent}%`}
                  hint={
                    report.cancellation.totalCount > 0
                      ? `${report.cancellation.cancelledCount} de ${report.cancellation.totalCount} agendamentos`
                      : "Toque para detalhar"
                  }
                  tooltip="Percentual de agendamentos cancelados de verdade (cliente desmarcou ou não compareceu). Erro de agendamento e remarcação não entram."
                  trend={cancelamentosTrend}
                  visual={
                    <MiniRing percent={report.cancellation.ratePercent} />
                  }
                  onSelect={() => navigate(from, to, "cancelamentos")}
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
