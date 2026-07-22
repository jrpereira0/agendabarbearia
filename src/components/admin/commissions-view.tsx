"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Percent, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { SearchInput } from "@/components/admin/search-input";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { CommissionBarberSelfView } from "@/components/admin/commission-barber-self-view";
import { PayCommissionButton } from "@/components/admin/pay-commission-button";
import {
  commissionServiceRevenueCents,
  type CommissionProfessionalReport,
  type CommissionReport,
} from "@/lib/finance-reports";
import type { CommissionPayout } from "@/lib/commission-payout-service";
import { formatPriceBRL } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/date-range";
import { matchesSearch } from "@/lib/text";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type CommissionProfessionalOption = {
  id: string;
  nickname: string;
  commissionPercent: number;
};

function emptyProfessionalReport(
  option: CommissionProfessionalOption
): CommissionProfessionalReport {
  return {
    professionalId: option.id,
    professionalNickname: option.nickname,
    commissionPercent: option.commissionPercent,
    summary: {
      servicesGrossCents: 0,
      commissionCents: 0,
      itemCount: 0,
      comandaCount: 0,
      tipCents: 0,
      serviceItemCount: 0,
      shopCents: 0,
    },
    byPaymentMethod: {
      pix: 0,
      cash: 0,
      debit: 0,
      credit: 0,
      store_credit: 0,
    },
    byDay: [],
    serviceBreakdown: [],
    comandas: [],
  };
}

type CommissionsViewProps = {
  from: string;
  to: string;
  today: string;
  professionalId: string | null;
  report: CommissionReport;
  professionals: CommissionProfessionalOption[];
  payoutsByProfessionalId?: Record<string, CommissionPayout[]>;
  /** @deprecated use payoutsByProfessionalId */
  payouts?: CommissionPayout[];
  isOwner?: boolean;
};

function buildQuery(
  from: string,
  to: string,
  professionalId?: string | null
): string {
  const params = new URLSearchParams({ from, to });
  if (professionalId) params.set("professionalId", professionalId);
  return `/admin/financeiro/comissoes?${params.toString()}`;
}

function BarberListItem({
  row,
  selected,
  onSelect,
}: {
  row: CommissionProfessionalReport;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors sm:px-3.5",
        selected
          ? "border-[#ecf15e] bg-[rgb(236_241_94_/_10%)]"
          : "border-transparent hover:bg-white/[0.03]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium tracking-tight",
            selected ? "text-[#ecf15e]" : "text-[#f5f5f5]"
          )}
        >
          {row.professionalNickname}
        </p>
        <p className={cn("mt-0.5 truncate text-xs", ADMIN_SURFACE.muted)}>
          {row.summary.comandaCount} atendimento
          {row.summary.comandaCount === 1 ? "" : "s"}
          {" · "}
          {row.commissionPercent}%
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          selected ? "text-[#ecf15e]" : "text-[#f5f5f5]"
        )}
      >
        {formatPriceBRL(row.summary.commissionCents)}
      </p>
    </button>
  );
}

export function CommissionsView({
  from,
  to,
  today,
  professionalId,
  report,
  professionals,
  payoutsByProfessionalId = {},
  payouts = [],
  isOwner = true,
}: CommissionsViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(professionalId);

  useEffect(() => {
    setFromDate(from);
    setToDate(to);
    setSelectedId(professionalId);
  }, [from, to, professionalId]);

  const sortedProfessionals = useMemo(
    () =>
      [...report.professionals].sort((a, b) =>
        a.professionalNickname.localeCompare(b.professionalNickname, "pt-BR", {
          sensitivity: "base",
        })
      ),
    [report.professionals]
  );

  const filteredProfessionals = useMemo(() => {
    if (!search.trim()) return sortedProfessionals;
    return sortedProfessionals.filter((row) =>
      matchesSearch(row.professionalNickname, search)
    );
  }, [sortedProfessionals, search]);

  const activeProfessional = useMemo(() => {
    if (!selectedId) return null;
    const fromReport = report.professionals.find(
      (row) => row.professionalId === selectedId
    );
    if (fromReport) return fromReport;
    const option = professionals.find((pro) => pro.id === selectedId);
    return option ? emptyProfessionalReport(option) : null;
  }, [selectedId, report.professionals, professionals]);

  const activePayouts = useMemo(() => {
    if (!selectedId) return [];
    if (payoutsByProfessionalId[selectedId]) {
      return payoutsByProfessionalId[selectedId];
    }
    return payouts;
  }, [selectedId, payoutsByProfessionalId, payouts]);

  const hasData = report.professionals.length > 0 || Boolean(activeProfessional);
  const serviceRevenueCents = useMemo(
    () => commissionServiceRevenueCents(report.summary),
    [report.summary]
  );

  function selectBarber(id: string) {
    setSelectedId(id);
    router.replace(buildQuery(from, to, id), { scroll: false });
  }

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildQuery(fromDate, toDate, selectedId));
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    router.push(buildQuery(presetFrom, presetTo, selectedId));
  }

  if (!isOwner) {
    const self =
      activeProfessional ??
      (professionals[0] ? emptyProfessionalReport(professionals[0]) : null);

    return (
      <div
        className={cn(
          "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
          ADMIN_SURFACE.page
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
          <PageHeader
            tone="dark"
            title="Minhas comissões"
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
            tone="dark"
          />
          {!hasData || !self ? (
            <EmptyState
              icon={Percent}
              className="border-white/10 text-[#f5f5f5]"
              title="Nada a receber neste período"
              description="Você não teve atendimentos em aberto neste intervalo. Tente outras datas ou confira sua agenda."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className={ADMIN_SURFACE.btnGhost}
                  asChild
                >
                  <Link href={`/admin?date=${to}`}>Ver minha agenda</Link>
                </Button>
              }
            />
          ) : (
            <div className={cn(ADMIN_SURFACE.panel, "p-4 sm:p-5")}>
              <CommissionBarberSelfView
                professional={self}
                from={from}
                to={to}
                viewer="self"
                payouts={activePayouts}
              />
            </div>
          )}
        </div>
      </div>
    );
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
          title="Comissões"
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
          tone="dark"
        />

        {!hasData ? (
          <EmptyState
            icon={Percent}
            className="border-white/10 text-[#f5f5f5]"
            title="Nenhuma comissão em aberto"
            description="Não há comissão em aberto neste intervalo. Pode ser que já tenha sido paga, ou ainda não há atendimentos finalizados."
            action={
              <Button
                variant="outline"
                size="sm"
                className={ADMIN_SURFACE.btnGhost}
                asChild
              >
                <Link href={`/admin?date=${to}`}>Abrir agenda</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start">
            <aside
              className={cn(
                ADMIN_SURFACE.panel,
                "flex max-h-[min(28rem,60dvh)] flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5.5rem)]"
              )}
            >
              <div className="shrink-0 border-b border-white/10 px-3.5 py-3.5 sm:px-4">
                <p className={ADMIN_SURFACE.sectionLabel}>Barbeiros</p>
                <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
                  {formatPriceBRL(report.summary.commissionCents)} a pagar no
                  período
                </p>
                <div className="mt-3">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar…"
                    inputClassName={ADMIN_SURFACE.input}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
                {filteredProfessionals.length === 0 ? (
                  <p
                    className={cn(
                      "px-4 py-10 text-center text-sm",
                      ADMIN_SURFACE.muted
                    )}
                  >
                    Nenhum barbeiro para &ldquo;{search}&rdquo;.
                  </p>
                ) : (
                  <ul>
                    {filteredProfessionals.map((row) => (
                      <li key={row.professionalId}>
                        <BarberListItem
                          row={row}
                          selected={selectedId === row.professionalId}
                          onSelect={() => selectBarber(row.professionalId)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-px border-t border-white/10 bg-white/10">
                <div className="bg-[#151618] px-3.5 py-3">
                  <p
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      ADMIN_SURFACE.muted
                    )}
                  >
                    Atendimentos
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-[#f5f5f5]">
                    {report.summary.comandaCount}
                  </p>
                </div>
                <div className="bg-[#151618] px-3.5 py-3">
                  <p
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      ADMIN_SURFACE.muted
                    )}
                  >
                    Em serviços
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-[#f5f5f5]">
                    {formatPriceBRL(serviceRevenueCents)}
                  </p>
                </div>
                {report.summary.tipCents > 0 ? (
                  <div className="col-span-2 bg-[#151618] px-3.5 py-3">
                    <p
                      className={cn(
                        "text-[10px] uppercase tracking-wide",
                        ADMIN_SURFACE.muted
                      )}
                    >
                      Gorjetas
                    </p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-[#f5f5f5]">
                      {formatPriceBRL(report.summary.tipCents)}
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>

            <section className={cn(ADMIN_SURFACE.panel, "min-w-0")}>
              {activeProfessional ? (
                <>
                  <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-medium tracking-tight text-[#f5f5f5]">
                        {activeProfessional.professionalNickname}
                      </p>
                      <p className={cn("mt-0.5 text-xs", ADMIN_SURFACE.muted)}>
                        {activeProfessional.commissionPercent}% nos serviços ·{" "}
                        {formatPeriodLabel(from, to)}
                      </p>
                    </div>
                    <PayCommissionButton
                      from={from}
                      to={to}
                      professionalId={activeProfessional.professionalId}
                      professionalNickname={
                        activeProfessional.professionalNickname
                      }
                      amountCents={activeProfessional.summary.commissionCents}
                      label="Registrar pagamento"
                      className={cn(
                        ADMIN_SURFACE.btnPrimary,
                        "h-10 w-full sm:h-9 sm:w-auto"
                      )}
                    />
                  </div>
                  <div className="p-4 sm:p-5">
                    <CommissionBarberSelfView
                      professional={activeProfessional}
                      from={from}
                      to={to}
                      viewer="owner"
                      payouts={activePayouts}
                      hideIdentityHeader
                      embedded
                    />
                  </div>
                </>
              ) : (
                <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1b1e]">
                    <UserRound className="size-5 text-[#ecf15e]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">
                      Escolha um barbeiro
                    </p>
                    <p
                      className={cn(
                        "mx-auto mt-1 max-w-xs text-sm",
                        ADMIN_SURFACE.muted
                      )}
                    >
                      Clique na lista ao lado para ver o detalhe e registrar o
                      pagamento — os outros continuam visíveis.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
