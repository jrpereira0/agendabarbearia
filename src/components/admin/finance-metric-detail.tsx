"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DonutChart,
  HorizontalBarChart,
  VerticalBarChart,
} from "@/components/admin/finance-charts";
import {
  formatPaymentMethodLabel,
  type FinanceMetricsReport,
} from "@/lib/finance-reports";
import {
  financeHeroValue,
  financeMetricLabel,
  ticketAverageCents,
  type FinanceMetricId,
} from "@/lib/finance-metrics";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type DetailMetric = Exclude<FinanceMetricId, "geral">;

type FinanceMetricDetailProps = {
  metric: DetailMetric;
  report: FinanceMetricsReport;
  from: string;
  to: string;
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className={cn(ADMIN_SURFACE.sectionLabel)}>{title}</p>
        {description ? (
          <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function formatCount(value: number): string {
  return String(value);
}

export function FinanceMetricDetail({
  metric,
  report,
  from,
  to,
}: FinanceMetricDetailProps) {
  const daysWithActivity = useMemo(
    () =>
      report.byDay.filter(
        (day) =>
          day.totalCents > 0 ||
          day.cashInflowCents > 0 ||
          day.serviceItemCount > 0
      ),
    [report.byDay]
  );

  const topServices = useMemo(
    () =>
      report.serviceBreakdown
        .filter((row) => !row.isTip)
        .slice(0, 10)
        .map((row) => ({
          label: row.serviceName,
          value: row.grossCents,
          sublabel: `${row.quantity}x`,
        })),
    [report.serviceBreakdown]
  );

  const topServicesByQty = useMemo(
    () =>
      [...report.serviceBreakdown]
        .filter((row) => !row.isTip)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)
        .map((row) => ({
          label: row.serviceName,
          value: row.quantity,
          sublabel: formatPriceBRL(row.grossCents),
        })),
    [report.serviceBreakdown]
  );

  const paymentItems = useMemo(
    () =>
      PAYMENT_METHODS.filter(
        (method) => report.cashInflowByPaymentMethod[method] > 0
      ).map((method) => ({
        label: formatPaymentMethodLabel(method),
        value: report.cashInflowByPaymentMethod[method],
      })),
    [report.cashInflowByPaymentMethod]
  );

  const weekdayGross = useMemo(
    () =>
      report.weekdayBreakdown.map((row) => ({
        label: row.label.slice(0, 3),
        value: row.grossCents,
      })),
    [report.weekdayBreakdown]
  );

  const weekdayServices = useMemo(
    () =>
      report.weekdayBreakdown.map((row) => ({
        label: row.label.slice(0, 3),
        value: row.serviceItemCount,
      })),
    [report.weekdayBreakdown]
  );

  const weekdayTicket = useMemo(
    () =>
      report.weekdayBreakdown.map((row) => ({
        label: row.label.slice(0, 3),
        value: ticketAverageCents(row.grossCents, row.serviceItemCount),
      })),
    [report.weekdayBreakdown]
  );

  const dayEvolutionGross = useMemo(
    () =>
      daysWithActivity.map((day) => ({
        label: shortDate(day.date),
        value: day.totalCents,
      })),
    [daysWithActivity]
  );

  const dayEvolutionCash = useMemo(
    () =>
      daysWithActivity.map((day) => ({
        label: shortDate(day.date),
        value: day.cashInflowCents,
      })),
    [daysWithActivity]
  );

  const dayEvolutionTicket = useMemo(
    () =>
      daysWithActivity.map((day) => ({
        label: shortDate(day.date),
        value: ticketAverageCents(day.totalCents, day.serviceItemCount),
      })),
    [daysWithActivity]
  );

  const dayEvolutionServices = useMemo(
    () =>
      daysWithActivity.map((day) => ({
        label: shortDate(day.date),
        value: day.serviceItemCount,
      })),
    [daysWithActivity]
  );

  const dayEvolutionCommission = useMemo(
    () =>
      daysWithActivity.map((day) => ({
        label: shortDate(day.date),
        value: day.commissionCents,
      })),
    [daysWithActivity]
  );

  const hero = financeHeroValue(report, metric);
  const heroHint =
    metric === "servicos"
      ? `${report.activeDays} dia${report.activeDays === 1 ? "" : "s"} com atendimento`
      : metric === "ticket"
        ? `${report.totals.serviceItemCount} serviço${report.totals.serviceItemCount === 1 ? "" : "s"} no período`
        : metric === "comissoes"
          ? `${report.commissionRatePercent}% do faturamento · barbearia ${report.shopRatePercent}%`
          : metric === "caixa" && report.totals.creditDepositsCents > 0
            ? `Inclui ${formatPriceBRL(report.totals.creditDepositsCents)} em créditos`
            : metric === "pagamentos"
              ? "Total que entrou no caixa por forma de pagamento"
              : metric === "barbeiros"
                ? "Barbeiros com atendimento no período"
                : metric === "semana"
                  ? "Como o movimento se distribui na semana"
                  : metric === "ranking"
                    ? "Serviços cadastrados com movimento"
                    : metric === "produtos"
                      ? `${report.productSales.totalQuantity} un. · ${report.productSales.byProduct.length} produto${report.productSales.byProduct.length === 1 ? "" : "s"}`
                      : undefined;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <p className={cn(ADMIN_SURFACE.sectionLabel)}>
          {financeMetricLabel(metric)}
        </p>
        <p className="page-display mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#f5f5f5] sm:text-4xl">
          {hero}
        </p>
        {heroHint ? (
          <p className={cn("mt-1 text-xs sm:text-sm", ADMIN_SURFACE.muted)}>
            {heroHint}
          </p>
        ) : null}
      </div>

      {metric === "faturamento" && (
        <>
          <Section title="Evolução no período" description="Faturamento por dia">
            {dayEvolutionGross.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart items={dayEvolutionGross} height={148} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Por dia da semana">
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <VerticalBarChart items={weekdayGross} height={132} />
              </CardContent>
            </Card>
          </Section>

          {topServices.length > 0 && (
            <Section title="Top serviços" description="Maior faturamento">
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart items={topServices} />
                </CardContent>
              </Card>
            </Section>
          )}

          {report.professionals.length > 0 && (
            <Section title="Por barbeiro">
              <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
                <ProfessionalMoneyTable
                  rows={report.professionals.map((pro) => ({
                    id: pro.professionalId,
                    name: pro.professionalNickname,
                    value: pro.totalCents,
                    sub: `${pro.serviceItemCount} serviço${pro.serviceItemCount === 1 ? "" : "s"}`,
                  }))}
                  from={from}
                  to={to}
                />
              </Card>
            </Section>
          )}
        </>
      )}

      {metric === "caixa" && (
        <>
          <Section
            title="Formas de pagamento"
            description="Quanto entrou por cada meio"
          >
            {paymentItems.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart items={paymentItems} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Entradas por dia">
            {dayEvolutionCash.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart items={dayEvolutionCash} height={148} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Dia a dia">
            <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
              {daysWithActivity.length === 0 ? (
                <p
                  className={cn(
                    "px-4 py-8 text-center text-sm",
                    ADMIN_SURFACE.muted
                  )}
                >
                  Sem entradas neste período.
                </p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {daysWithActivity.map((day) => (
                    <li
                      key={day.date}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#f5f5f5]">
                          {formatDateBR(day.date)}
                        </p>
                        {day.creditDepositsCents > 0 ? (
                          <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                            Créditos{" "}
                            {formatPriceBRL(day.creditDepositsCents)}
                          </p>
                        ) : null}
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          ADMIN_SURFACE.accent
                        )}
                      >
                        {formatPriceBRL(day.cashInflowCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
        </>
      )}

      {metric === "ticket" && (
        <>
          <Section
            title="Evolução do ticket"
            description="Valor médio por serviço em cada dia"
          >
            {dayEvolutionTicket.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart items={dayEvolutionTicket} height={148} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Ticket por dia da semana">
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <VerticalBarChart items={weekdayTicket} height={132} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Ticket por dia">
            <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
              {daysWithActivity.length === 0 ? (
                <EmptyBlock />
              ) : (
                <ul className="divide-y divide-white/10">
                  {daysWithActivity.map((day) => (
                    <li
                      key={day.date}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#f5f5f5]">
                          {formatDateBR(day.date)}
                        </p>
                        <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                          {day.serviceItemCount} serviço
                          {day.serviceItemCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          ADMIN_SURFACE.accent
                        )}
                      >
                        {formatPriceBRL(
                          ticketAverageCents(
                            day.totalCents,
                            day.serviceItemCount
                          )
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>

          {report.professionals.length > 0 && (
            <Section title="Ticket médio por barbeiro">
              <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
                <ProfessionalMoneyTable
                  rows={[...report.professionals]
                    .map((pro) => ({
                      id: pro.professionalId,
                      name: pro.professionalNickname,
                      value: ticketAverageCents(
                        pro.totalCents,
                        pro.serviceItemCount
                      ),
                      sub: `${pro.serviceItemCount} serviço${pro.serviceItemCount === 1 ? "" : "s"}`,
                    }))
                    .sort((a, b) => b.value - a.value)}
                  from={from}
                  to={to}
                />
              </Card>
            </Section>
          )}
        </>
      )}

      {metric === "servicos" && (
        <>
          <Section title="Serviços por dia">
            {dayEvolutionServices.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart
                    items={dayEvolutionServices}
                    height={148}
                    formatValue={formatCount}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Por dia da semana">
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <VerticalBarChart
                  items={weekdayServices}
                  height={132}
                  formatValue={formatCount}
                />
              </CardContent>
            </Card>
          </Section>

          {topServicesByQty.length > 0 && (
            <Section title="Serviços mais feitos">
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart
                    items={topServicesByQty}
                    formatValue={formatCount}
                  />
                </CardContent>
              </Card>
            </Section>
          )}

          {report.professionals.length > 0 && (
            <Section title="Por barbeiro">
              <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
                <MetricRowList
                  rows={[...report.professionals]
                    .sort((a, b) => b.serviceItemCount - a.serviceItemCount)
                    .map((pro) => ({
                      id: pro.professionalId,
                      title: pro.professionalNickname,
                      value: String(pro.serviceItemCount),
                      href: `/admin/financeiro/comissoes?from=${from}&to=${to}&professionalId=${pro.professionalId}`,
                      ariaLabel: `Comissões de ${pro.professionalNickname}`,
                    }))}
                />
              </Card>
            </Section>
          )}
        </>
      )}

      {metric === "comissoes" && (
        <>
          <Section title="Divisão do faturamento">
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <DonutChart
                  slices={[
                    {
                      label: "Comissões",
                      value: report.totals.commissionCents,
                      className: "text-[#ecf15e] bg-[#ecf15e]",
                    },
                    {
                      label: "Barbearia",
                      value: report.totals.shopCents,
                      className: "text-white/35 bg-white/35",
                    },
                  ]}
                  centerLabel="Comissão"
                  centerValue={formatPriceBRL(report.totals.commissionCents)}
                />
              </CardContent>
            </Card>
          </Section>

          <Section title="Comissão por dia">
            {dayEvolutionCommission.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart
                    items={dayEvolutionCommission}
                    height={148}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          {report.professionals.length > 0 && (
            <Section title="Por barbeiro">
              <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
                <ProfessionalMoneyTable
                  rows={[...report.professionals]
                    .map((pro) => ({
                      id: pro.professionalId,
                      name: pro.professionalNickname,
                      value: pro.commissionCents,
                      sub: `${pro.commissionPercent}% · ${pro.serviceItemCount} serviço${pro.serviceItemCount === 1 ? "" : "s"}`,
                    }))
                    .sort((a, b) => b.value - a.value)}
                  from={from}
                  to={to}
                />
              </Card>
            </Section>
          )}

          <Button
            variant="outline"
            size="sm"
            className={cn("h-10 w-full sm:h-8 sm:w-fit", ADMIN_SURFACE.btnGhost)}
            asChild
          >
            <Link href={`/admin/financeiro/comissoes?from=${from}&to=${to}`}>
              <Percent className="size-4" />
              Abrir página de comissões
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      )}

      {metric === "pagamentos" && (
        <>
          <Section
            title="Mix de pagamentos"
            description="Quanto entrou por cada forma"
          >
            {paymentItems.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart items={paymentItems} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Detalhe por forma">
            <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
              {paymentItems.length === 0 ? (
                <p
                  className={cn(
                    "px-4 py-8 text-center text-sm",
                    ADMIN_SURFACE.muted
                  )}
                >
                  Sem entradas neste período.
                </p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {paymentItems.map((item) => {
                    const pct =
                      report.totals.cashInflowCents > 0
                        ? Math.round(
                            (item.value / report.totals.cashInflowCents) * 100
                          )
                        : 0;
                    return (
                      <li
                        key={item.label}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#f5f5f5]">
                            {item.label}
                          </p>
                          <p
                            className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}
                          >
                            {pct}% do total
                          </p>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            ADMIN_SURFACE.accent
                          )}
                        >
                          {formatPriceBRL(item.value)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Section>
        </>
      )}

      {metric === "barbeiros" && (
        <>
          <Section
            title="Faturamento por barbeiro"
            description="Valor dos serviços de cada um"
          >
            {report.professionals.length > 0 ? (
              <Card className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
                <ProfessionalMoneyTable
                  rows={[...report.professionals]
                    .map((pro) => ({
                      id: pro.professionalId,
                      name: pro.professionalNickname,
                      value: pro.totalCents,
                      sub: `${pro.serviceItemCount} serviço${pro.serviceItemCount === 1 ? "" : "s"} · ticket ${formatPriceBRL(ticketAverageCents(pro.totalCents, pro.serviceItemCount))}`,
                    }))
                    .sort((a, b) => b.value - a.value)}
                  from={from}
                  to={to}
                />
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Comissão gerada">
            {report.professionals.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart
                    items={[...report.professionals]
                      .map((pro) => ({
                        label: pro.professionalNickname,
                        value: pro.commissionCents,
                        sublabel: `${pro.commissionPercent}%`,
                      }))
                      .sort((a, b) => b.value - a.value)}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>
        </>
      )}

      {metric === "semana" && (
        <>
          <Section
            title="Faturamento por dia da semana"
            description="Qual dia da semana rende mais"
          >
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <VerticalBarChart items={weekdayGross} height={148} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Serviços por dia da semana">
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <VerticalBarChart
                  items={weekdayServices}
                  height={132}
                  formatValue={formatCount}
                />
              </CardContent>
            </Card>
          </Section>

          <Section title="Entradas no caixa">
            <Card className={ADMIN_SURFACE.panel}>
              <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                <VerticalBarChart
                  items={report.weekdayBreakdown.map((row) => ({
                    label: row.label.slice(0, 3),
                    value: row.cashInflowCents,
                  }))}
                  height={132}
                />
              </CardContent>
            </Card>
          </Section>
        </>
      )}

      {metric === "ranking" && (
        <>
          <Section
            title="Por faturamento"
            description="Serviços que mais geraram valor"
          >
            {topServices.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart items={topServices} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section
            title="Por quantidade"
            description="Serviços mais feitos"
          >
            {topServicesByQty.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart
                    items={topServicesByQty}
                    formatValue={formatCount}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>
        </>
      )}

      {metric === "produtos" && (
        <>
          <Section
            title="Resumo"
            description="Só produtos — sem serviços nem gorjeta"
          >
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MiniStat
                label="Faturamento"
                value={formatPriceBRL(report.productSales.totalRevenueCents)}
              />
              <MiniStat
                label="Unidades"
                value={String(report.productSales.totalQuantity)}
              />
              <MiniStat
                label="Comissão"
                value={formatPriceBRL(report.productSales.totalCommissionCents)}
              />
            </div>
          </Section>

          <Section title="Por produto" description="Quem mais vendeu em valor">
            {report.productSales.byProduct.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart
                    items={report.productSales.byProduct
                      .slice(0, 10)
                      .map((row) => ({
                        label: row.productName,
                        value: row.revenueCents,
                        sublabel: `${row.quantitySold} un.`,
                      }))}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Por barbeiro" description="Inclui vendas sem profissional">
            {report.productSales.byProfessional.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <HorizontalBarChart
                    items={report.productSales.byProfessional.map((row) => ({
                      label: row.professionalNickname,
                      value: row.revenueCents,
                      sublabel: `${row.quantitySold} un.`,
                    }))}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Por dia" description="Faturamento de produtos no período">
            {report.productSales.byDay.length > 0 ? (
              <Card className={ADMIN_SURFACE.panel}>
                <CardContent className="px-3 pt-4 sm:px-6 sm:pt-5">
                  <VerticalBarChart
                    items={report.productSales.byDay.map((row) => ({
                      label: shortDate(row.date),
                      value: row.revenueCents,
                    }))}
                    height={148}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(ADMIN_SURFACE.panel, "px-4 py-3")}>
      <p className={cn("text-xs uppercase tracking-wide", ADMIN_SURFACE.muted)}>
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#f5f5f5]">
        {value}
      </p>
    </div>
  );
}

function EmptyBlock() {
  return (
    <p
      className={cn(
        "rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm",
        ADMIN_SURFACE.muted
      )}
    >
      Sem dados neste período.
    </p>
  );
}

function MetricRowList({
  rows,
}: {
  rows: {
    id: string;
    title: string;
    subtitle?: string;
    value: string;
    href?: string;
    ariaLabel?: string;
  }[];
}) {
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#f5f5f5]">
              {row.title}
            </p>
            {row.subtitle ? (
              <p className={cn("mt-0.5 truncate text-xs", ADMIN_SURFACE.muted)}>
                {row.subtitle}
              </p>
            ) : null}
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              ADMIN_SURFACE.accent
            )}
          >
            {row.value}
          </p>
          {row.href ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-[#8b8d93] hover:bg-white/5 hover:text-[#f5f5f5] sm:size-8"
              asChild
            >
              <Link href={row.href} aria-label={row.ariaLabel ?? row.title}>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ProfessionalMoneyTable({
  rows,
  from,
  to,
}: {
  rows: { id: string; name: string; value: number; sub?: string }[];
  from: string;
  to: string;
  linkLabel?: string;
}) {
  return (
    <MetricRowList
      rows={rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.sub,
        value: formatPriceBRL(row.value),
        href: `/admin/financeiro/comissoes?from=${from}&to=${to}&professionalId=${row.id}`,
        ariaLabel: `Detalhar ${row.name}`,
      }))}
    />
  );
}
