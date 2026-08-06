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
  "cancelamentos",
  "clientes",
  "ocupacao",
] as const;

export type FinanceMetricId = (typeof FINANCE_METRIC_IDS)[number];

export type FinanceMetricOption = {
  id: FinanceMetricId;
  label: string;
};

export const FINANCE_METRIC_OPTIONS: FinanceMetricOption[] = [
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
  { id: "cancelamentos", label: "Cancelamentos" },
  { id: "clientes", label: "Novos vs. recorrentes" },
  { id: "ocupacao", label: "Ocupação da agenda" },
];

/** Grupos do seletor de métricas (ordem de leitura do dono). */
export const FINANCE_METRIC_GROUPS: {
  label: string | null;
  options: FinanceMetricOption[];
}[] = [
  {
    label: null,
    options: [{ id: "geral", label: "Visão geral" }],
  },
  {
    label: "Dinheiro",
    options: [
      { id: "faturamento", label: "Faturamento" },
      { id: "caixa", label: "Entradas no caixa" },
      { id: "saidas", label: "Saídas" },
      { id: "comissoes", label: "Comissões" },
      { id: "pagamentos", label: "Formas de pagamento" },
    ],
  },
  {
    label: "Atendimento",
    options: [
      { id: "servicos", label: "Serviços realizados" },
      { id: "ticket", label: "Ticket médio" },
      { id: "produtos", label: "Produtos vendidos" },
      { id: "clientes", label: "Novos vs. recorrentes" },
      { id: "ocupacao", label: "Ocupação da agenda" },
      { id: "cancelamentos", label: "Cancelamentos" },
    ],
  },
  {
    label: "Comparativos",
    options: [
      { id: "barbeiros", label: "Por barbeiro" },
      { id: "semana", label: "Dia da semana" },
      { id: "ranking", label: "Ranking de serviços" },
    ],
  },
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
  return `/admin/metricas?${params.toString()}`;
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
    case "cancelamentos":
      return `${report.cancellation.ratePercent}%`;
    case "clientes":
      return String(report.retention.newCount);
    case "ocupacao":
      return `${report.occupancy.ratePercent}%`;
  }
}

export type FinanceTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

/** Selo de tendência a partir de uma variação percentual (ex.: faturamento, serviços). */
export function trendFromPercent(percent: number | null): FinanceTrend | undefined {
  if (percent === null) return undefined;
  if (percent === 0) return { direction: "flat", label: "0%" };
  return {
    direction: percent > 0 ? "up" : "down",
    label: `${Math.abs(percent)}%`,
  };
}

/** Selo de tendência a partir de uma variação em pontos percentuais (ex.: taxa de cancelamento). */
export function trendFromPoints(points: number | null): FinanceTrend | undefined {
  if (points === null) return undefined;
  if (points === 0) return { direction: "flat", label: "0 p.p." };
  return {
    direction: points > 0 ? "up" : "down",
    label: `${Math.abs(points)} p.p.`,
  };
}
