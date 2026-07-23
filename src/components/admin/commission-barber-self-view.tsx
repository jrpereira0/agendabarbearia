"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayCommissionButton } from "@/components/admin/pay-commission-button";
import { CommissionPayoutHistory } from "@/components/admin/commission-payout-history";
import {
  commissionServiceRevenueCents,
  type CommissionComandaDetail,
  type CommissionDayRow,
  type CommissionProfessionalReport,
  type CommissionServiceBreakdownRow,
} from "@/lib/finance-reports";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import {
  formatDateBR,
  formatPriceBRL,
  formatWhatsapp,
} from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type CommissionBarberSelfViewProps = {
  professional: CommissionProfessionalReport;
  from: string;
  to: string;
  /** "self" = barbeiro vendo a própria comissão; "owner" = dono detalhando. */
  viewer?: "self" | "owner";
  payouts?: CommissionPayout[];
  /** Quando o PageHeader já mostra nome e CTA de pagamento. */
  hideIdentityHeader?: boolean;
  /** Dentro do painel lista+detalhe: tipografia e listas mais limpas. */
  embedded?: boolean;
  /** No celular: esconde grade de métricas e abas extras. */
  mobileSimple?: boolean;
};

const tabTriggerClass =
  "shrink-0 rounded-lg px-3 py-2 text-xs text-[#8b8d93] hover:!bg-white/[0.04] hover:!text-[#c8c9cd] data-[state=active]:!bg-[#1a1b1e] data-[state=active]:!text-[#ecf15e] data-[state=active]:shadow-none sm:text-sm";

type MetricItem = {
  label: string;
  value: string;
  hint?: string;
};

function MetricCell({ label, value, hint }: MetricItem) {
  return (
    <div className="bg-[#151618] px-4 py-3.5">
      <p
        className={cn(
          "text-[10px] font-medium uppercase tracking-[0.12em]",
          ADMIN_SURFACE.muted
        )}
      >
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[#f5f5f5]">
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-0.5 text-[11px] leading-snug", ADMIN_SURFACE.muted)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** No celular: valor à direita, sem grade com buraco. */
function MetricRow({ label, value, hint }: MetricItem) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.12em]",
            ADMIN_SURFACE.muted
          )}
        >
          {label}
        </p>
        {hint ? (
          <p className={cn("mt-1 text-[11px] leading-snug", ADMIN_SURFACE.muted)}>
            {hint}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-[1.05rem] font-semibold tabular-nums tracking-tight text-[#f5f5f5]">
        {value}
      </p>
    </div>
  );
}

function MetricsBlock({
  items,
  className,
}: {
  items: MetricItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  const desktopCols =
    items.length >= 4
      ? "sm:grid-cols-4"
      : items.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border border-white/10 sm:hidden">
        <div className="divide-y divide-white/10 bg-[#151618]">
          {items.map((item) => (
            <MetricRow key={item.label} {...item} />
          ))}
        </div>
      </div>

      <div
        className={cn(
          "hidden gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid",
          desktopCols
        )}
      >
        {items.map((item) => (
          <MetricCell key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

function ServicesBreakdown({
  rows,
  isOwnerView,
}: {
  rows: CommissionServiceBreakdownRow[];
  isOwnerView: boolean;
}) {
  const services = rows.filter((row) => !row.isTip);
  const tips = rows.filter((row) => row.isTip);
  const tipTotalCents = tips.reduce((sum, row) => sum + row.commissionCents, 0);
  const commissionTotalCents = services.reduce(
    (sum, row) => sum + row.commissionCents,
    0
  );
  const timesTotal = services.reduce((sum, row) => sum + row.quantity, 0);

  if (services.length === 0 && tips.length === 0) {
    return (
      <p className={cn("px-1 py-8 text-center text-sm", ADMIN_SURFACE.muted)}>
        Nenhum serviço no período.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={ADMIN_SURFACE.sectionLabel}>Serviços</p>
          {services.length > 0 ? (
            <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
              {services.length} tipo{services.length === 1 ? "" : "s"}
              {" · "}
              {timesTotal} vez{timesTotal === 1 ? "" : "es"}
            </p>
          ) : null}
        </div>
        {services.length > 0 ? (
          <p
            className={cn(
              "shrink-0 text-lg font-semibold tabular-nums",
              ADMIN_SURFACE.accent
            )}
          >
            {formatPriceBRL(commissionTotalCents)}
          </p>
        ) : null}
      </div>

      {services.length > 0 ? (
        <ul className="divide-y divide-white/10">
          {services.map((row, index) => {
            const sharePct =
              commissionTotalCents > 0
                ? Math.round((row.commissionCents / commissionTotalCents) * 100)
                : 0;
            const avgGross =
              row.quantity > 0
                ? Math.round(row.grossCents / row.quantity)
                : 0;

            return (
              <li key={`svc:${row.serviceName}`} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                      <span className={cn("mr-2 tabular-nums", ADMIN_SURFACE.muted)}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {row.serviceName}
                    </p>
                    <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                      {row.quantity}×
                      {avgGross > 0 ? ` · méd. ${formatPriceBRL(avgGross)}` : ""}
                      {" · "}
                      {sharePct}%
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      ADMIN_SURFACE.accent
                    )}
                  >
                    {formatPriceBRL(row.commissionCents)}
                  </p>
                </div>
                <div
                  className={cn(
                    "mt-2 h-1 overflow-hidden rounded-full",
                    ADMIN_SURFACE.progress
                  )}
                >
                  <div
                    className={cn("h-full rounded-full", ADMIN_SURFACE.progressBar)}
                    style={{ width: `${sharePct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {tipTotalCents > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f5f5f5]">Gorjetas</p>
            <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
              {isOwnerView ? "100% para o barbeiro" : "100% seu"}
              {tips.reduce((s, t) => s + t.quantity, 0) > 0
                ? ` · ${tips.reduce((s, t) => s + t.quantity, 0)}×`
                : ""}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              ADMIN_SURFACE.accent
            )}
          >
            {formatPriceBRL(tipTotalCents)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AtendimentoRow({
  comanda,
  receiveLabel,
  hideDate = false,
}: {
  comanda: CommissionComandaDetail;
  receiveLabel: string;
  hideDate?: boolean;
}) {
  const customerLabel =
    comanda.customerName?.trim() ||
    formatWhatsapp(comanda.customerWhatsapp) ||
    "Cliente";

  const metaParts: string[] = [];
  if (!hideDate) metaParts.push(formatDateBR(comanda.serviceDate));
  if (comanda.serviceItemCount > 0) {
    metaParts.push(
      `${comanda.serviceItemCount} serviço${
        comanda.serviceItemCount === 1 ? "" : "s"
      }`
    );
  }

  return (
    <li className="px-0 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
            {customerLabel}
          </p>
          {metaParts.length > 0 ? (
            <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-[10px] uppercase tracking-wide",
              ADMIN_SURFACE.muted
            )}
          >
            {receiveLabel}
          </p>
          <p className={cn("text-base font-semibold tabular-nums", ADMIN_SURFACE.accent)}>
            {formatPriceBRL(comanda.commissionCents)}
          </p>
        </div>
      </div>

      {comanda.items.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 border-l border-white/10 pl-3">
          {comanda.items.map((item, index) => (
            <li
              key={`${item.serviceName}-${index}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className={cn("min-w-0 truncate", ADMIN_SURFACE.muted)}>
                {item.serviceName}
                {item.isTip ? " · gorjeta" : ""}
              </span>
              <span className="shrink-0 tabular-nums text-[#f5f5f5]">
                {formatPriceBRL(item.commissionCents)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type ComandaDayGroup = {
  date: string;
  comandas: CommissionComandaDetail[];
  totalCents: number;
};

function groupComandasByDay(
  comandas: CommissionComandaDetail[]
): ComandaDayGroup[] {
  const map = new Map<string, CommissionComandaDetail[]>();
  for (const comanda of comandas) {
    const list = map.get(comanda.serviceDate) ?? [];
    list.push(comanda);
    map.set(comanda.serviceDate, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayComandas]) => ({
      date,
      comandas: dayComandas,
      totalCents: dayComandas.reduce(
        (sum, row) => sum + row.commissionCents,
        0
      ),
    }));
}

function AtendimentosList({
  comandas,
  receiveLabel,
  isSingleDay,
  singleDayLabel,
}: {
  comandas: CommissionComandaDetail[];
  receiveLabel: string;
  isSingleDay: boolean;
  singleDayLabel?: string;
}) {
  const dayGroups = useMemo(() => groupComandasByDay(comandas), [comandas]);
  const [showAllDays, setShowAllDays] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const comandasKey = useMemo(
    () => comandas.map((comanda) => comanda.comandaId).join("|"),
    [comandas]
  );
  const [appliedComandasKey, setAppliedComandasKey] = useState(comandasKey);

  if (appliedComandasKey !== comandasKey) {
    setAppliedComandasKey(comandasKey);
    setShowAllDays(false);
    setDayIndex(0);
  }

  if (comandas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
        <ClipboardList className={cn("size-5", ADMIN_SURFACE.muted)} />
        <p className={cn("text-sm", ADMIN_SURFACE.muted)}>
          Nenhum atendimento neste período.
        </p>
      </div>
    );
  }

  const hasMultipleDays = !isSingleDay && dayGroups.length > 1;
  const activeGroup = dayGroups[Math.min(dayIndex, dayGroups.length - 1)]!;
  const canGoOlder = dayIndex < dayGroups.length - 1;
  const canGoNewer = dayIndex > 0;

  if (showAllDays && hasMultipleDays) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={ADMIN_SURFACE.sectionLabel}>Todos os dias</p>
            <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
              {dayGroups.length} dias · {comandas.length} atendimento
              {comandas.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ADMIN_SURFACE.btnGhost}
            onClick={() => setShowAllDays(false)}
          >
            Ver um dia
          </Button>
        </div>

        {dayGroups.map((group) => (
          <section key={group.date} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2">
              <p className={cn("text-sm font-medium", ADMIN_SURFACE.accent)}>
                {formatDateBR(group.date)}
              </p>
              <p className={cn("text-xs tabular-nums", ADMIN_SURFACE.muted)}>
                {group.comandas.length} atendimento
                {group.comandas.length === 1 ? "" : "s"}
                {" · "}
                <span className={cn("font-medium", ADMIN_SURFACE.accent)}>
                  {formatPriceBRL(group.totalCents)}
                </span>
              </p>
            </div>
            <ul className="divide-y divide-white/10">
              {group.comandas.map((comanda) => (
                <AtendimentoRow
                  key={comanda.comandaId}
                  comanda={comanda}
                  receiveLabel={receiveLabel}
                  hideDate
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  const headerLabel = isSingleDay
    ? (singleDayLabel ?? formatDateBR(activeGroup.date))
    : formatDateBR(activeGroup.date);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={ADMIN_SURFACE.sectionLabel}>{headerLabel}</p>
          <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
            {activeGroup.comandas.length} atendimento
            {activeGroup.comandas.length === 1 ? "" : "s"}
            {" · "}
            <span className={cn("font-medium", ADMIN_SURFACE.accent)}>
              {formatPriceBRL(activeGroup.totalCents)}
            </span>
          </p>
        </div>

        {hasMultipleDays ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(ADMIN_SURFACE.btnGhost, "size-8")}
              disabled={!canGoOlder}
              onClick={() => setDayIndex((i) => Math.min(i + 1, dayGroups.length - 1))}
              aria-label="Dia anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className={cn("min-w-[3.5rem] text-center text-xs tabular-nums", ADMIN_SURFACE.muted)}>
              {dayIndex + 1}/{dayGroups.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(ADMIN_SURFACE.btnGhost, "size-8")}
              disabled={!canGoNewer}
              onClick={() => setDayIndex((i) => Math.max(i - 1, 0))}
              aria-label="Próximo dia"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <ul className="divide-y divide-white/10">
        {activeGroup.comandas.map((comanda) => (
          <AtendimentoRow
            key={comanda.comandaId}
            comanda={comanda}
            receiveLabel={receiveLabel}
            hideDate
          />
        ))}
      </ul>

      {hasMultipleDays ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(ADMIN_SURFACE.btnGhost, "w-full sm:w-auto")}
            onClick={() => setShowAllDays(true)}
          >
            Ver mais · {dayGroups.length - 1} outro
            {dayGroups.length - 1 === 1 ? "" : "s"} dia
            {dayGroups.length - 1 === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DaysBreakdown({ rows }: { rows: CommissionDayRow[] }) {
  const totalCents = rows.reduce((sum, row) => sum + row.commissionCents, 0);
  const totalComandas = rows.reduce((sum, row) => sum + row.comandaCount, 0);

  if (rows.length === 0) {
    return (
      <p className={cn("px-1 py-8 text-center text-sm", ADMIN_SURFACE.muted)}>
        Nenhum dia com atendimento no período.
      </p>
    );
  }

  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={ADMIN_SURFACE.sectionLabel}>Por dia</p>
          <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
            {sorted.length} dia{sorted.length === 1 ? "" : "s"}
            {" · "}
            {totalComandas} atendimento{totalComandas === 1 ? "" : "s"}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-lg font-semibold tabular-nums",
            ADMIN_SURFACE.accent
          )}
        >
          {formatPriceBRL(totalCents)}
        </p>
      </div>

      <ul className="divide-y divide-white/10">
        {sorted.map((row) => (
          <li
            key={row.date}
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                {formatDateBR(row.date)}
              </p>
              <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                {row.comandaCount} atendimento
                {row.comandaCount === 1 ? "" : "s"}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 text-base font-semibold tabular-nums",
                ADMIN_SURFACE.accent
              )}
            >
              {formatPriceBRL(row.commissionCents)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommissionBarberSelfView({
  professional,
  from,
  to,
  viewer = "self",
  payouts = [],
  hideIdentityHeader = false,
  embedded = false,
  mobileSimple = false,
}: CommissionBarberSelfViewProps) {
  const isOwnerView = viewer === "owner";
  const isSingleDay = from === to;
  const dayRows = professional.byDay.filter((row) => row.serviceItemCount > 0);
  const activeDay = isSingleDay
    ? professional.byDay.find((day) => day.date === from)
    : null;
  const comandas = isSingleDay
    ? professional.comandas.filter((comanda) => comanda.serviceDate === from)
    : professional.comandas;

  const receiveLabel = isOwnerView ? "Comissão" : "Você recebe";
  const tipHint = isOwnerView ? "100% para o barbeiro" : "100% seu";
  const heroHint = isOwnerView
    ? `${professional.commissionPercent}% nos serviços · ${tipHint}`
    : `Sua comissão · ${professional.commissionPercent}% nos serviços`;

  const serviceRows = useMemo(() => {
    if (!isSingleDay) {
      return [...professional.serviceBreakdown].sort(
        (a, b) => b.commissionCents - a.commissionCents
      );
    }

    const map = new Map<string, CommissionServiceBreakdownRow>();
    for (const comanda of comandas) {
      for (const item of comanda.items) {
        const key = `${item.isTip ? "tip" : "svc"}:${item.serviceName}`;
        const existing = map.get(key) ?? {
          serviceName: item.serviceName,
          isTip: item.isTip,
          quantity: 0,
          grossCents: 0,
          commissionCents: 0,
        };
        existing.quantity += 1;
        existing.grossCents += item.chargedPriceCents;
        existing.commissionCents += item.commissionCents;
        map.set(key, existing);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.commissionCents - a.commissionCents
    );
  }, [comandas, isSingleDay, professional.serviceBreakdown]);

  const summary = professional.summary;
  const serviceRevenueCents = commissionServiceRevenueCents(summary);

  const bestDay = useMemo(() => {
    if (dayRows.length === 0) return null;
    return [...dayRows].sort(
      (a, b) => b.commissionCents - a.commissionCents
    )[0];
  }, [dayRows]);

  return (
    <div className="flex flex-col gap-5">
      {!hideIdentityHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
              {professional.professionalNickname}
            </p>
            <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
              {heroHint}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div>
              <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
                {isOwnerView ? "A pagar" : "Você recebe"}
              </p>
              <p className={cn("text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl", ADMIN_SURFACE.accent)}>
                {formatPriceBRL(summary.commissionCents)}
              </p>
            </div>
            {isOwnerView ? (
              <PayCommissionButton
                from={from}
                to={to}
                professionalId={professional.professionalId}
                professionalNickname={professional.professionalNickname}
                amountCents={summary.commissionCents}
                label="Registrar pagamento"
                className={cn(
                  ADMIN_SURFACE.btnPrimary,
                  "h-10 w-full sm:h-9 sm:w-auto"
                )}
              />
            ) : null}
          </div>
        </div>
      ) : mobileSimple ? null : (
        <div className="hidden lg:block">
          <p className={ADMIN_SURFACE.sectionLabel}>
            {isOwnerView ? "A pagar no período" : "Você recebe"}
          </p>
          <p
            className={cn(
              "mt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl",
              ADMIN_SURFACE.accent
            )}
          >
            {formatPriceBRL(summary.commissionCents)}
          </p>
          <p className={cn("mt-1.5 text-xs", ADMIN_SURFACE.muted)}>{heroHint}</p>
        </div>
      )}

      <MetricsBlock
        className={cn(mobileSimple && "hidden lg:block")}
        items={[
          {
            label: "Atendimentos",
            value: String(summary.comandaCount),
            hint:
              !isSingleDay && dayRows.length > 0
                ? `em ${dayRows.length} dia${dayRows.length === 1 ? "" : "s"}`
                : undefined,
          },
          {
            label: "Em serviços",
            value: formatPriceBRL(serviceRevenueCents),
            hint:
              summary.comandaCount > 0
                ? `média ${formatPriceBRL(
                    Math.round(serviceRevenueCents / summary.comandaCount)
                  )}`
                : undefined,
          },
          ...(summary.tipCents > 0
            ? [
                {
                  label: "Gorjetas",
                  value: formatPriceBRL(summary.tipCents),
                  hint: isOwnerView ? "100% do barbeiro" : "100% suas",
                },
              ]
            : []),
          ...(bestDay && !isSingleDay
            ? [
                {
                  label: "Melhor dia",
                  value: formatPriceBRL(bestDay.commissionCents),
                  hint: formatDateBR(bestDay.date),
                },
              ]
            : []),
        ]}
      />

      {isSingleDay && activeDay ? (
        <div className={cn(mobileSimple && "hidden lg:block")}>
          <Button
            variant="outline"
            size="sm"
            className={ADMIN_SURFACE.btnGhost}
            asChild
          >
            <Link href={`/admin?date=${from}`}>
              <CalendarDays className="size-4" />
              {isOwnerView
                ? "Ver agenda neste dia"
                : "Ver sua agenda neste dia"}
            </Link>
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="atendimentos" className="w-full">
        <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto w-max min-w-full gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            <TabsTrigger value="atendimentos" className={tabTriggerClass}>
              Atendimentos
            </TabsTrigger>
            <TabsTrigger
              value="servicos"
              className={cn(
                tabTriggerClass,
                mobileSimple && "hidden lg:inline-flex"
              )}
            >
              Serviços
            </TabsTrigger>
            {!isSingleDay ? (
              <TabsTrigger
                value="dias"
                className={cn(
                  tabTriggerClass,
                  mobileSimple && "hidden lg:inline-flex"
                )}
              >
                Por dia
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="pagamentos" className={tabTriggerClass}>
              Pagamentos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="atendimentos" className="mt-4">
          <AtendimentosList
            comandas={comandas}
            receiveLabel={receiveLabel}
            isSingleDay={isSingleDay}
            singleDayLabel={isSingleDay ? formatDateBR(from) : undefined}
          />
        </TabsContent>

        <TabsContent value="servicos" className="mt-4">
          <ServicesBreakdown rows={serviceRows} isOwnerView={isOwnerView} />
        </TabsContent>

        {!isSingleDay ? (
          <TabsContent value="dias" className="mt-4">
            <DaysBreakdown rows={dayRows} />
          </TabsContent>
        ) : null}

        <TabsContent value="pagamentos" className="mt-4">
          <section className="space-y-2">
            <p className={ADMIN_SURFACE.sectionLabel}>
              {isOwnerView ? "Repasses registrados" : "Seus repasses"}
            </p>
            <CommissionPayoutHistory
              payouts={payouts}
              viewer={isOwnerView ? "owner" : "self"}
              embedded={embedded}
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
