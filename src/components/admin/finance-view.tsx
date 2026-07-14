"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Percent, Wallet } from "lucide-react";
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
import {
  DonutChart,
  SparklineBars,
  VerticalBarChart,
} from "@/components/admin/finance-charts";
import type { FinanceMetricsReport } from "@/lib/finance-reports";
import {
  buildFinanceQuery,
  FINANCE_METRIC_OPTIONS,
  formatSignedPercent,
  type FinanceMetricId,
} from "@/lib/finance-metrics";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatPriceBRL } from "@/lib/format";

type FinanceViewProps = {
  from: string;
  to: string;
  today: string;
  metric: FinanceMetricId;
  report: FinanceMetricsReport;
};

export function FinanceView({
  from,
  to,
  today,
  metric,
  report,
}: FinanceViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [selectedMetric, setSelectedMetric] = useState<FinanceMetricId>(metric);

  useEffect(() => {
    setFromDate(from);
    setToDate(to);
    setSelectedMetric(metric);
  }, [from, to, metric]);

  const hasData = report.totals.serviceItemCount > 0;
  const isDetail = metric !== "geral";

  const dailySparkline = useMemo(
    () => report.byDay.map((day) => day.cashInflowCents),
    [report.byDay]
  );

  const weekdayGross = useMemo(
    () =>
      report.weekdayBreakdown.map((row) => ({
        label: row.label.slice(0, 3),
        value: row.grossCents,
      })),
    [report.weekdayBreakdown]
  );

  const comparisonLine = useMemo(() => {
    const comparison = report.comparison;
    if (!comparison) return null;
    const parts = [
      `caixa ${formatSignedPercent(comparison.cashInflowChangePercent)}`,
      `faturamento ${formatSignedPercent(comparison.totalChangePercent)}`,
      `serviços ${formatSignedPercent(comparison.serviceChangePercent)}`,
    ];
    return `vs período anterior: ${parts.join(" · ")}`;
  }, [report.comparison]);

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Financeiro"
        description={formatPeriodLabel(from, to)}
      />

      <FinancePeriodFilter
        today={today}
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onSubmit={applyFilter}
        onPreset={applyPreset}
        extraFields={
          <Select value={selectedMetric} onValueChange={onMetricChange}>
            <SelectTrigger
              aria-label="Analisar métrica"
              className="h-8 w-full bg-background sm:w-[13.5rem]"
            >
              <SelectValue placeholder="Visão geral" />
            </SelectTrigger>
            <SelectContent>
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
          title="Nada neste período"
          description="Não há serviços finalizados neste intervalo. Ajuste as datas ou feche comandas na agenda."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin?date=${to}`}>Abrir agenda</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/financeiro/caixas?from=${from}&to=${to}`}>
                  <Wallet className="size-4" />
                  Caixas
                </Link>
              </Button>
            </div>
          }
        />
      ) : isDetail ? (
        hasData ? (
          <FinanceMetricDetail
            metric={metric}
            report={report}
            from={from}
            to={to}
          />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Sem dados para esta métrica"
            description="Não há atendimento finalizado neste período. Tente outra faixa de datas."
          />
        )
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium">Números principais</h2>
              <p className="text-xs text-muted-foreground">
                Resumo do período selecionado
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FinanceMetricCard
                label="Entradas no caixa"
                value={formatPriceBRL(report.totals.cashInflowCents)}
                hint={
                  report.totals.creditDepositsCents > 0
                    ? `Inclui ${formatPriceBRL(report.totals.creditDepositsCents)} em créditos`
                    : "Pagamentos + créditos"
                }
              />
              <FinanceMetricCard
                label="Faturamento"
                value={formatPriceBRL(report.totals.servicesGrossCents)}
                hint="Serviços no período"
              />
              <FinanceMetricCard
                label="Comissões"
                value={formatPriceBRL(report.totals.commissionCents)}
                hint={`${report.commissionRatePercent}% do faturamento`}
              />
              <FinanceMetricCard
                label="Barbearia"
                value={formatPriceBRL(report.totals.shopCents)}
                hint={`${report.shopRatePercent}% fica com a casa`}
              />
              <FinanceMetricCard
                label="Serviços"
                value={String(report.totals.serviceItemCount)}
                hint={`${report.activeDays} dia${report.activeDays === 1 ? "" : "s"} ativos`}
              />
              <FinanceMetricCard
                label="Ticket médio"
                value={formatPriceBRL(report.averageServiceCents)}
                hint="Por serviço realizado"
              />
            </div>
            {comparisonLine && (
              <p className="text-xs text-muted-foreground">{comparisonLine}</p>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-3 pt-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Entradas no caixa</p>
                    <p className="text-xs text-muted-foreground">
                      Evolução dia a dia
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPriceBRL(report.totals.cashInflowCents)}
                  </p>
                </div>
                <SparklineBars values={dailySparkline} height={64} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <div className="mb-4">
                  <p className="text-sm font-medium">
                    Comissões × barbearia
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Como o faturamento se divide
                  </p>
                </div>
                <DonutChart
                  slices={[
                    {
                      label: "Comissões",
                      value: report.totals.commissionCents,
                      className: "text-foreground",
                    },
                    {
                      label: "Barbearia",
                      value: report.totals.shopCents,
                      className: "text-foreground/40",
                    },
                  ]}
                  centerLabel="Total"
                  centerValue={formatPriceBRL(report.totals.totalCents)}
                />
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium">Movimento na semana</h2>
              <p className="text-xs text-muted-foreground">
                Faturamento por dia da semana no período
              </p>
            </div>
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart items={weekdayGross} height={160} />
              </CardContent>
            </Card>
          </section>

          <p className="text-xs text-muted-foreground">
            Para analisar uma métrica com mais detalhes, use o menu ao lado
            do filtro de período.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/financeiro/caixas?from=${from}&to=${to}`}>
                <Wallet className="size-4" />
                Caixas
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/financeiro/comissoes?from=${from}&to=${to}`}>
                <Percent className="size-4" />
                Comissões
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
