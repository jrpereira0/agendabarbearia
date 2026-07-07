"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Percent,
  Receipt,
  Scissors,
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
  DonutChart,
  HorizontalBarChart,
  SparklineBars,
  VerticalBarChart,
} from "@/components/admin/finance-charts";
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

function SectionTitle({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: typeof BarChart3;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {Icon && <Icon className="size-4" />}
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function FinanceView({ from, to, today, report }: FinanceViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  const isSingleDay = from === to;
  const isToday = isSingleDay && from === today;
  const hasData = report.totals.serviceItemCount > 0;

  const activePaymentMethods = useMemo(
    () =>
      PAYMENT_METHODS.filter(
        (method) => report.cashInflowByPaymentMethod[method] > 0
      ),
    [report.cashInflowByPaymentMethod]
  );

  const topProfessional = useMemo(() => {
    if (report.professionals.length === 0) return null;
    return [...report.professionals].sort((a, b) => b.totalCents - a.totalCents)[0];
  }, [report.professionals]);

  const daysWithSales = useMemo(
    () => report.byDay.filter((day) => day.cashInflowCents > 0),
    [report.byDay]
  );

  const dailySparkline = useMemo(
    () => report.byDay.map((day) => day.cashInflowCents),
    [report.byDay]
  );

  const weekdayChartItems = useMemo(() => {
    const ordered = [1, 2, 3, 4, 5, 6, 0];
    return ordered.map((weekday) => {
      const row = report.weekdayBreakdown.find((r) => r.weekday === weekday)!;
      return {
        label: row.label.slice(0, 3),
        value: row.grossCents,
        sublabel:
          row.serviceItemCount > 0 ? `${row.serviceItemCount} serv.` : undefined,
      };
    });
  }, [report.weekdayBreakdown]);

  const serviceItems = useMemo(
    () =>
      report.serviceBreakdown
        .filter((row) => !row.isTip)
        .slice(0, 8)
        .map((row) => ({
          label: row.serviceName,
          value: row.grossCents,
          sublabel: `${row.quantity}x`,
        })),
    [report.serviceBreakdown]
  );

  const tipTotal = useMemo(
    () =>
      report.serviceBreakdown
        .filter((row) => row.isTip)
        .reduce((sum, row) => sum + row.grossCents, 0),
    [report.serviceBreakdown]
  );

  const cashInflowHint =
    report.totals.creditDepositsCents > 0
      ? `${formatPriceBRL(report.totals.totalCents)} em serviços + ${formatPriceBRL(report.totals.creditDepositsCents)} em créditos`
      : `${report.totals.serviceItemCount} serviços realizados`;

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    router.push(`/admin/financeiro?${params.toString()}`);
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    router.push(`/admin/financeiro?from=${presetFrom}&to=${presetTo}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Financeiro"
        description="Painel para estudar faturamento, comissões, mix de pagamento e desempenho por dia e por serviço."
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
                  {report.idleDays > 0 && ` · ${report.idleDays} sem vendas`}
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
          description="Não há serviços finalizados entre essas datas. Ajuste o período ou feche atendimentos na agenda."
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
              label="Entradas no caixa"
              value={formatPriceBRL(report.totals.cashInflowCents)}
              hint={cashInflowHint}
              change={report.comparison?.cashInflowChangePercent ?? null}
            />
            <MetricCard
              label="Faturamento em serviços"
              value={formatPriceBRL(report.totals.servicesGrossCents)}
              hint={`${report.totals.serviceItemCount} serviços realizados`}
              change={report.comparison?.totalChangePercent ?? null}
            />
            <MetricCard
              label="Valor médio por serviço"
              value={formatPriceBRL(report.averageServiceCents)}
              hint={`${report.averageServicesPerActiveDay} serviços/dia ativo`}
              change={report.comparison?.serviceChangePercent ?? null}
            />
            <MetricCard
              label="Comissões"
              value={formatPriceBRL(report.totals.commissionCents)}
              hint={`${report.commissionRatePercent}% dos serviços · barbearia ${report.shopRatePercent}%`}
            />
          </div>

          {report.comparison && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Comparativo com período anterior
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPeriodLabel(
                      report.comparison.previousFrom,
                      report.comparison.previousTo
                    )}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Caixa</p>
                    <p className="font-medium tabular-nums">
                      {formatPriceBRL(report.comparison.cashInflowCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatChange(report.comparison.cashInflowChangePercent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <p className="font-medium tabular-nums">
                      {formatPriceBRL(report.comparison.totalCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatChange(report.comparison.totalChangePercent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qtd. serviços</p>
                    <p className="font-medium tabular-nums">
                      {report.comparison.serviceItemCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatChange(report.comparison.serviceChangePercent)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <SectionTitle
                icon={BarChart3}
                title="Evolução no período"
                description="Entradas no caixa dia a dia"
              />
              <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                  <SparklineBars values={dailySparkline} height={56} />
                  <div className="max-h-[18rem] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 border-b bg-background">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="py-2 font-medium">Dia</th>
                          <th className="hidden py-2 font-medium sm:table-cell">
                            Serviços
                          </th>
                          <th className="py-2 font-medium text-right">
                            Entradas
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {daysWithSales.map((day) => (
                          <tr key={day.date} className="border-b last:border-b-0">
                            <td className="py-2.5 font-medium">
                              {formatDateBR(day.date)}
                            </td>
                            <td className="hidden py-2.5 tabular-nums text-muted-foreground sm:table-cell">
                              {day.serviceItemCount}
                            </td>
                            <td className="py-2.5 text-right font-semibold tabular-nums">
                              {formatPriceBRL(day.cashInflowCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle
                title="Divisão do faturamento"
                description="Quanto ficou com barbeiros e com a barbearia"
              />
              <Card>
                <CardContent className="pt-6">
                  <DonutChart
                    slices={[
                      {
                        label: "Comissões",
                        value: report.totals.commissionCents,
                        className: "text-foreground/45",
                      },
                      {
                        label: "Barbearia",
                        value: report.totals.shopCents,
                        className: "text-foreground",
                      },
                    ]}
                    centerValue={formatPriceBRL(report.totals.servicesGrossCents)}
                    centerLabel="em serviços"
                  />
                </CardContent>
              </Card>

              {tipTotal > 0 && (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Gorjetas no período
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatPriceBRL(tipTotal)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <SectionTitle
                icon={CalendarDays}
                title="Por dia da semana"
                description="Em quais dias a barbearia fatura mais"
              />
              <Card>
                <CardContent className="pt-6">
                  <VerticalBarChart items={weekdayChartItems} />
                </CardContent>
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle
                icon={Receipt}
                title="Formas de pagamento"
                description="Mix de entradas no caixa"
              />
              <Card>
                <CardContent className="pt-6">
                  <HorizontalBarChart
                    items={activePaymentMethods.map((method: PaymentMethod) => {
                      const amount = report.cashInflowByPaymentMethod[method];
                      const pct =
                        report.totals.cashInflowCents > 0
                          ? Math.round(
                              (amount / report.totals.cashInflowCents) * 100
                            )
                          : 0;
                      return {
                        label: formatPaymentMethodLabel(method),
                        value: amount,
                        sublabel: `${pct}%`,
                      };
                    })}
                    maxValue={report.totals.cashInflowCents}
                  />
                </CardContent>
              </Card>
            </section>
          </div>

          {serviceItems.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle
                icon={Scissors}
                title="Serviços mais vendidos"
                description="Ranking por valor faturado no período"
              />
              <Card>
                <CardContent className="pt-6">
                  <HorizontalBarChart
                    items={serviceItems}
                    maxValue={serviceItems[0]?.value ?? 1}
                  />
                </CardContent>
              </Card>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionTitle
              icon={Users}
              title="Performance por barbeiro"
              description="Serviços, faturamento e comissão por barbeiro"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/financeiro/comissoes?from=${from}&to=${to}`}>
                    Detalhar comissões
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              }
            />
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Barbeiro</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Serviços
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
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.professionals]
                      .sort((a, b) => b.totalCents - a.totalCents)
                      .map((row) => {
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
                                {row.commissionPercent}% nos serviços
                                {row.tipCents > 0 &&
                                  ` · gorjeta ${formatPriceBRL(row.tipCents)}`}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {row.serviceItemCount}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                              {formatPriceBRL(row.totalCents - row.tipCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatPriceBRL(row.commissionCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {formatPriceBRL(row.shopCents)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {report.totals.serviceItemCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(
                          report.professionals.reduce(
                            (sum, row) => sum + row.totalCents - row.tipCents,
                            0
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.totals.commissionCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(
                          report.professionals.reduce(
                            (sum, row) => sum + row.shopCents,
                            0
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {topProfessional && (
              <p className="text-xs text-muted-foreground">
                Destaque: {topProfessional.professionalNickname} liderou com{" "}
                {formatPriceBRL(topProfessional.totalCents)} em{" "}
                {topProfessional.serviceItemCount} serviço
                {topProfessional.serviceItemCount === 1 ? "" : "s"}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
