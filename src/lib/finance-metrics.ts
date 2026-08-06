import type { FinanceMetricsReport } from "@/lib/finance-reports";
import type { ExpensesReport } from "@/lib/expense-service";
import { formatPriceBRL } from "@/lib/format";

export const FINANCE_METRIC_IDS = [
  "geral",
  "faturamento",
  "caixa",
  "ticket",
  "servicos",
  "produtos",
  "saidas",
  "comissoes",
  "pagamentos",
  "barbeiros",
  "semana",
  "ranking",
] as const;

export type FinanceMetricId = (typeof FINANCE_METRIC_IDS)[number];

export const FINANCE_METRIC_OPTIONS: {
  id: FinanceMetricId;
  label: string;
}[] = [
  { id: "geral", label: "Visão geral" },
  { id: "faturamento", label: "Faturamento" },
  { id: "caixa", label: "Entradas no caixa" },
  { id: "ticket", label: "Ticket médio" },
  { id: "servicos", label: "Serviços realizados" },
  { id: "produtos", label: "Produtos vendidos" },
  { id: "saidas", label: "Saídas" },
  { id: "comissoes", label: "Comissões" },
  { id: "pagamentos", label: "Formas de pagamento" },
  { id: "barbeiros", label: "Por barbeiro" },
  { id: "semana", label: "Dia da semana" },
  { id: "ranking", label: "Ranking de serviços" },
];

export function parseFinanceMetric(
  value: string | undefined
): FinanceMetricId {
  if (value && (FINANCE_METRIC_IDS as readonly string[]).includes(value)) {
    return value as FinanceMetricId;
  }
  return "geral";
}

export function financeMetricLabel(id: FinanceMetricId): string {
  return (
    FINANCE_METRIC_OPTIONS.find((option) => option.id === id)?.label ??
    "Visão geral"
  );
}

/** Ticket médio em centavos (0 se sem serviços). */
export function ticketAverageCents(
  grossCents: number,
  serviceItemCount: number
): number {
  if (serviceItemCount <= 0) return 0;
  return Math.round(grossCents / serviceItemCount);
}

export function buildFinanceQuery(input: {
  from: string;
  to: string;
  metric?: FinanceMetricId;
}): string {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.metric && input.metric !== "geral") {
    params.set("metric", input.metric);
  }
  return `/admin/financeiro?${params.toString()}`;
}

export function financeHeroValue(
  report: FinanceMetricsReport,
  metric: Exclude<FinanceMetricId, "geral">,
  expensesReport?: ExpensesReport
): string {
  const { totals, averageServiceCents } = report;
  switch (metric) {
    case "faturamento":
      return formatPriceBRL(totals.servicesGrossCents);
    case "caixa":
      return formatPriceBRL(totals.cashInflowCents);
    case "ticket":
      return formatPriceBRL(averageServiceCents);
    case "servicos":
      return String(totals.serviceItemCount);
    case "produtos":
      return formatPriceBRL(report.productSales.totalRevenueCents);
    case "saidas":
      return formatPriceBRL(expensesReport?.totalCents ?? 0);
    case "comissoes":
      return formatPriceBRL(totals.commissionCents);
    case "pagamentos":
      return formatPriceBRL(totals.cashInflowCents);
    case "barbeiros":
      return String(report.professionals.length);
    case "semana":
      return formatPriceBRL(totals.servicesGrossCents);
    case "ranking":
      return String(
        report.serviceBreakdown.filter((row) => !row.isTip).length
      );
  }
}
