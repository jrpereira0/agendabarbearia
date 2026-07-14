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
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
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
                    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {financeMetricLabel(metric)}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
          {hero}
        </p>
        {heroHint ? (
          <p className="mt-1 text-sm text-muted-foreground">{heroHint}</p>
        ) : null}
      </div>

      {metric === "faturamento" && (
        <>
          <Section title="Evolução no período" description="Faturamento por dia">
            {dayEvolutionGross.length > 0 ? (
              <Card>
                <CardContent className="pt-5">
                  <VerticalBarChart items={dayEvolutionGross} height={180} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Por dia da semana">
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart items={weekdayGross} height={160} />
              </CardContent>
            </Card>
          </Section>

          {topServices.length > 0 && (
            <Section title="Top serviços" description="Maior faturamento">
              <Card>
                <CardContent className="pt-5">
                  <HorizontalBarChart items={topServices} />
                </CardContent>
              </Card>
            </Section>
          )}

          {report.professionals.length > 0 && (
            <Section title="Por barbeiro">
              <Card className="overflow-hidden">
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
              <Card>
                <CardContent className="pt-5">
                  <HorizontalBarChart items={paymentItems} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Entradas por dia">
            {dayEvolutionCash.length > 0 ? (
              <Card>
                <CardContent className="pt-5">
                  <VerticalBarChart items={dayEvolutionCash} height={180} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Dia a dia">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Dia</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Entradas
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Créditos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysWithActivity.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          Sem entradas neste período.
                        </td>
                      </tr>
                    ) : (
                      daysWithActivity.map((day) => (
                        <tr
                          key={day.date}
                          className="border-b last:border-b-0"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDateBR(day.date)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatPriceBRL(day.cashInflowCents)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {day.creditDepositsCents > 0
                              ? formatPriceBRL(day.creditDepositsCents)
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
              <Card>
                <CardContent className="pt-5">
                  <VerticalBarChart items={dayEvolutionTicket} height={180} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Ticket por dia da semana">
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart items={weekdayTicket} height={160} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Ticket por dia">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Dia</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Serviços
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Ticket
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysWithActivity.map((day) => (
                      <tr key={day.date} className="border-b last:border-b-0">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDateBR(day.date)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {day.serviceItemCount}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatPriceBRL(
                            ticketAverageCents(
                              day.totalCents,
                              day.serviceItemCount
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>

          {report.professionals.length > 0 && (
            <Section title="Ticket médio por barbeiro">
              <Card className="overflow-hidden">
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
              <Card>
                <CardContent className="pt-5">
                  <VerticalBarChart
                    items={dayEvolutionServices}
                    height={180}
                    formatValue={formatCount}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Por dia da semana">
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart
                  items={weekdayServices}
                  height={160}
                  formatValue={formatCount}
                />
              </CardContent>
            </Card>
          </Section>

          {topServicesByQty.length > 0 && (
            <Section title="Serviços mais feitos">
              <Card>
                <CardContent className="pt-5">
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
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Barbeiro</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Serviços
                        </th>
                        <th className="w-10 px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.professionals]
                        .sort(
                          (a, b) => b.serviceItemCount - a.serviceItemCount
                        )
                        .map((pro) => (
                          <tr
                            key={pro.professionalId}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {pro.professionalNickname}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {pro.serviceItemCount}
                            </td>
                            <td className="px-2 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                asChild
                              >
                                <Link
                                  href={`/admin/financeiro/comissoes?from=${from}&to=${to}&professionalId=${pro.professionalId}`}
                                  aria-label={`Comissões de ${pro.professionalNickname}`}
                                >
                                  <ArrowRight className="size-4" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Section>
          )}
        </>
      )}

      {metric === "comissoes" && (
        <>
          <Section title="Divisão do faturamento">
            <Card>
              <CardContent className="pt-5">
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
                  centerLabel="Comissão"
                  centerValue={formatPriceBRL(report.totals.commissionCents)}
                />
              </CardContent>
            </Card>
          </Section>

          <Section title="Comissão por dia">
            {dayEvolutionCommission.length > 0 ? (
              <Card>
                <CardContent className="pt-5">
                  <VerticalBarChart
                    items={dayEvolutionCommission}
                    height={180}
                  />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          {report.professionals.length > 0 && (
            <Section title="Por barbeiro">
              <Card className="overflow-hidden">
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

          <Button variant="outline" size="sm" className="w-fit" asChild>
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
              <Card>
                <CardContent className="pt-5">
                  <HorizontalBarChart items={paymentItems} />
                </CardContent>
              </Card>
            ) : (
              <EmptyBlock />
            )}
          </Section>

          <Section title="Tabela">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Forma</th>
                      <th className="px-4 py-3 font-medium text-right">Valor</th>
                      <th className="px-4 py-3 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          Sem entradas neste período.
                        </td>
                      </tr>
                    ) : (
                      paymentItems.map((item) => {
                        const pct =
                          report.totals.cashInflowCents > 0
                            ? Math.round(
                                (item.value / report.totals.cashInflowCents) *
                                  100
                              )
                            : 0;
                        return (
                          <tr
                            key={item.label}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {item.label}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {formatPriceBRL(item.value)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
              <Card className="overflow-hidden">
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
              <Card>
                <CardContent className="pt-5">
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
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart items={weekdayGross} height={180} />
              </CardContent>
            </Card>
          </Section>

          <Section title="Serviços por dia da semana">
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart
                  items={weekdayServices}
                  height={160}
                  formatValue={formatCount}
                />
              </CardContent>
            </Card>
          </Section>

          <Section title="Entradas no caixa">
            <Card>
              <CardContent className="pt-5">
                <VerticalBarChart
                  items={report.weekdayBreakdown.map((row) => ({
                    label: row.label.slice(0, 3),
                    value: row.cashInflowCents,
                  }))}
                  height={160}
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
              <Card>
                <CardContent className="pt-5">
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
              <Card>
                <CardContent className="pt-5">
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
    </div>
  );
}

function EmptyBlock() {
  return (
    <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      Sem dados neste período.
    </p>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[400px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Barbeiro</th>
            <th className="px-4 py-3 font-medium text-right">Valor</th>
            <th className="w-10 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0">
              <td className="px-4 py-3">
                <p className="font-medium">{row.name}</p>
                {row.sub ? (
                  <p className="text-xs text-muted-foreground">{row.sub}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatPriceBRL(row.value)}
              </td>
              <td className="px-2 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  asChild
                >
                  <Link
                    href={`/admin/financeiro/comissoes?from=${from}&to=${to}&professionalId=${row.id}`}
                    aria-label={`Detalhar ${row.name}`}
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
