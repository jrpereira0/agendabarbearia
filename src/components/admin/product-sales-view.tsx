"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { Button } from "@/components/ui/button";
import type { ProductSalesReport } from "@/lib/product-sales-report";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatPriceBRL } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type ProductSalesViewProps = {
  from: string;
  to: string;
  today: string;
  report: ProductSalesReport;
  /** Título da página (vendas operacionais vs financeiro). */
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  basePath: string;
};

export function ProductSalesView({
  from,
  to,
  today,
  report,
  title = "Vendas de produtos",
  description,
  backHref = "/admin/produtos",
  backLabel = "Produtos",
  basePath,
}: ProductSalesViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [applied, setApplied] = useState({ from, to });

  if (applied.from !== from || applied.to !== to) {
    setApplied({ from, to });
    setFromDate(from);
    setToDate(to);
  }

  const hasData = report.saleLineCount > 0;
  const periodLabel = useMemo(
    () => formatPeriodLabel(from, to),
    [from, to]
  );

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
          title={title}
          description={
            description ??
            `${periodLabel} · só produtos vendidos em comandas fechadas`
          }
          backHref={backHref}
          backLabel={backLabel}
          action={
            <Button asChild variant="outline" size="sm" className={ADMIN_SURFACE.btnGhost}>
              <Link href="/admin/produtos">Ver catálogo</Link>
            </Button>
          }
        />

        <FinancePeriodFilter
          today={today}
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          onSubmit={(event) => {
            event.preventDefault();
            const params = new URLSearchParams({ from: fromDate, to: toDate });
            router.push(`${basePath}?${params.toString()}`);
          }}
          onPreset={(nextFrom, nextTo) => {
            setFromDate(nextFrom);
            setToDate(nextTo);
            router.push(`${basePath}?from=${nextFrom}&to=${nextTo}`);
          }}
          tone="dark"
          mobilePresetsFirst
        />

        {!hasData ? (
          <EmptyState
            icon={ShoppingBag}
            className="border-white/10 text-[#f5f5f5]"
            title="Nenhuma venda de produto"
            description="Feche comandas com produtos neste período para ver o relatório."
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Faturamento"
                value={formatPriceBRL(report.totalRevenueCents)}
              />
              <MetricCard
                label="Unidades vendidas"
                value={String(report.totalQuantity)}
              />
              <MetricCard
                label="Comissão estimada"
                value={formatPriceBRL(report.totalCommissionCents)}
              />
            </div>

            <Section title="Por produto">
              <ul className="divide-y divide-white/10">
                {report.byProduct.map((row) => (
                  <li
                    key={row.productId}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#f5f5f5]">
                        {row.productName}
                      </p>
                      <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                        {row.categoryName} · {row.quantitySold} un. ·{" "}
                        {row.saleCount} venda{row.saleCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        ADMIN_SURFACE.accent
                      )}
                    >
                      {formatPriceBRL(row.revenueCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Por barbeiro">
              <ul className="divide-y divide-white/10">
                {report.byProfessional.map((row) => (
                  <li
                    key={row.professionalId ?? "__none__"}
                    className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#f5f5f5]">
                        {row.professionalNickname}
                      </p>
                      <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                        {row.quantitySold} un. · comissão{" "}
                        {formatPriceBRL(row.commissionCents)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        ADMIN_SURFACE.accent
                      )}
                    >
                      {formatPriceBRL(row.revenueCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>

            {report.byDay.length > 0 ? (
              <Section title="Por dia">
                <ul className="divide-y divide-white/10">
                  {report.byDay.map((row) => {
                    const [, month, day] = row.date.split("-");
                    return (
                      <li
                        key={row.date}
                        className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[#f5f5f5]">
                            {day}/{month}
                          </p>
                          <p
                            className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}
                          >
                            {row.quantitySold} un.
                          </p>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            ADMIN_SURFACE.accent
                          )}
                        >
                          {formatPriceBRL(row.revenueCents)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(ADMIN_SURFACE.panel, "px-4 py-4")}>
      <p className={cn("text-xs uppercase tracking-wide", ADMIN_SURFACE.muted)}>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[#f5f5f5]">
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Package className={cn("size-4", ADMIN_SURFACE.accent)} />
        <p className={ADMIN_SURFACE.sectionLabel}>{title}</p>
      </div>
      <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>{children}</div>
    </section>
  );
}
