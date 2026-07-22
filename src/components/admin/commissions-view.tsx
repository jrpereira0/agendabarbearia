"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Percent, UserRound } from "lucide-react";
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
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[0.05]",
        selected
          ? "bg-[rgb(236_241_94_/_10%)]"
          : "hover:bg-white/[0.03]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[15px] font-medium tracking-tight",
            selected ? "text-[#ecf15e]" : "text-[#f5f5f5]"
          )}
        >
          {row.professionalNickname}
        </p>
        <p className={cn("mt-0.5 truncate text-xs", ADMIN_SURFACE.muted)}>
          {row.summary.comandaCount} atendimento
          {row.summary.comandaCount === 1 ? "" : "s"}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-[15px] font-semibold tabular-nums",
          selected ? "text-[#ecf15e]" : "text-[#f5f5f5]"
        )}
      >
        {formatPriceBRL(row.summary.commissionCents)}
      </p>
    </button>
  );
}

function PeriodSummaryStrip({
  commissionCents,
  comandaCount,
}: {
  commissionCents: number;
  comandaCount: number;
  serviceRevenueCents?: number;
  tipCents?: number;
}) {
  return (
    <div
      className={cn(
        ADMIN_SURFACE.panel,
        "flex items-center justify-between gap-3 rounded-xl px-4 py-3 lg:hidden"
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "text-[10px] uppercase tracking-wide",
            ADMIN_SURFACE.muted
          )}
        >
          A pagar no período
        </p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#ecf15e]">
          {formatPriceBRL(commissionCents)}
        </p>
      </div>
      <p className={cn("shrink-0 text-xs", ADMIN_SURFACE.muted)}>
        {comandaCount} atendimento{comandaCount === 1 ? "" : "s"}
      </p>
    </div>
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
  const [appliedFilters, setAppliedFilters] = useState({
    from,
    to,
    professionalId,
  });

  if (
    appliedFilters.from !== from ||
    appliedFilters.to !== to ||
    appliedFilters.professionalId !== professionalId
  ) {
    setAppliedFilters({ from, to, professionalId });
    setFromDate(from);
    setToDate(to);
    setSelectedId(professionalId);
  }

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

  const hasData =
    report.professionals.length > 0 || Boolean(activeProfessional);
  const serviceRevenueCents = useMemo(
    () => commissionServiceRevenueCents(report.summary),
    [report.summary]
  );

  function selectBarber(id: string) {
    setSelectedId(id);
    router.replace(buildQuery(from, to, id), { scroll: false });
  }

  function clearBarber() {
    setSelectedId(null);
    router.replace(buildQuery(from, to, null), { scroll: false });
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
            mobilePresetsFirst
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

  const showListOnMobile = !selectedId;
  const showDetailOnMobile = Boolean(selectedId);

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className={cn(showDetailOnMobile && "hidden lg:block")}>
          <PageHeader
            tone="dark"
            title="Comissões"
            description={formatPeriodLabel(from, to)}
          />
        </div>

        <div className={cn(showDetailOnMobile && "hidden lg:block")}>
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
          />
        </div>

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
          <>
            {showListOnMobile ? (
              <PeriodSummaryStrip
                commissionCents={report.summary.commissionCents}
                comandaCount={report.summary.comandaCount}
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start">
              <aside
                className={cn(
                  ADMIN_SURFACE.panel,
                  "flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5.5rem)]",
                  showListOnMobile ? "flex" : "hidden lg:flex"
                )}
              >
                <div className="hidden shrink-0 border-b border-white/10 px-4 py-3.5 lg:block">
                  <p className={ADMIN_SURFACE.sectionLabel}>Barbeiros</p>
                  <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
                    {formatPriceBRL(report.summary.commissionCents)} a pagar no
                    período
                  </p>
                  {(sortedProfessionals.length > 5 || search) && (
                    <div className="mt-3">
                      <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar barbeiro…"
                        inputClassName={ADMIN_SURFACE.input}
                      />
                    </div>
                  )}
                </div>

                {(sortedProfessionals.length > 5 || search) && (
                  <div className="shrink-0 border-b border-white/10 px-4 py-3 lg:hidden">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Buscar barbeiro…"
                      inputClassName={ADMIN_SURFACE.input}
                    />
                  </div>
                )}

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
                    <ul className="divide-y divide-white/10">
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

                <div className="hidden shrink-0 grid-cols-2 gap-px border-t border-white/10 bg-white/10 lg:grid">
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

              <section
                className={cn(
                  ADMIN_SURFACE.panel,
                  "min-w-0",
                  showDetailOnMobile ? "block" : "hidden lg:block"
                )}
              >
                {activeProfessional ? (
                  <>
                    <div className="sticky top-0 z-10 border-b border-white/10 bg-[#151618]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#151618]/90 sm:static sm:px-5 sm:py-4 sm:backdrop-blur-none">
                      <button
                        type="button"
                        onClick={clearBarber}
                        className={cn(
                          "mb-2 inline-flex items-center gap-1 text-sm lg:hidden",
                          ADMIN_SURFACE.muted,
                          "hover:text-[#ecf15e]"
                        )}
                      >
                        <ChevronLeft className="size-4" />
                        Voltar
                      </button>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-base font-medium tracking-tight text-[#f5f5f5] sm:text-lg">
                            {activeProfessional.professionalNickname}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 text-xl font-semibold tabular-nums text-[#ecf15e] lg:hidden"
                            )}
                          >
                            {formatPriceBRL(
                              activeProfessional.summary.commissionCents
                            )}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 hidden text-xs lg:block",
                              ADMIN_SURFACE.muted
                            )}
                          >
                            {activeProfessional.commissionPercent}% nos
                            serviços · {formatPeriodLabel(from, to)}
                          </p>
                        </div>
                        <PayCommissionButton
                          from={from}
                          to={to}
                          professionalId={activeProfessional.professionalId}
                          professionalNickname={
                            activeProfessional.professionalNickname
                          }
                          amountCents={
                            activeProfessional.summary.commissionCents
                          }
                          label="Pagar"
                          className={cn(
                            ADMIN_SURFACE.btnPrimary,
                            "h-11 w-full sm:h-9 sm:w-auto"
                          )}
                        />
                      </div>
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
                        mobileSimple
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
                        Selecione na lista para ver o detalhe e registrar o
                        pagamento.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
