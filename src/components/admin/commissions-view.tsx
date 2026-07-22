"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Percent,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  href,
}: {
  row: CommissionProfessionalReport;
  selected: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 border-l-2 px-3 py-3 transition-colors sm:px-3.5",
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
          {row.summary.serviceItemCount} atendimento
          {row.summary.serviceItemCount === 1 ? "" : "s"}
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
    </Link>
  );
}

export function CommissionsView({
  from,
  to,
  today,
  professionalId,
  report,
  professionals,
  payouts = [],
  isOwner = true,
}: CommissionsViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [selectedPro, setSelectedPro] = useState(
    professionalId ?? (isOwner ? "all" : professionals[0]?.id ?? "all")
  );
  const [search, setSearch] = useState("");

  const activeProfessional = useMemo(() => {
    if (professionalId == null) return null;
    const fromReport = report.professionals.find(
      (row) => row.professionalId === professionalId
    );
    if (fromReport) return fromReport;
    const option = professionals.find((pro) => pro.id === professionalId);
    return option ? emptyProfessionalReport(option) : null;
  }, [professionalId, report.professionals, professionals]);

  const showDetail =
    !isOwner || (professionalId != null && activeProfessional != null);
  const hasData = report.professionals.length > 0 || showDetail;
  const ownerWorkspace = isOwner && hasData;

  const sortedProfessionals = useMemo(
    () =>
      [...report.professionals].sort(
        (a, b) => b.summary.commissionCents - a.summary.commissionCents
      ),
    [report.professionals]
  );

  const filteredProfessionals = useMemo(() => {
    if (!search.trim()) return sortedProfessionals;
    return sortedProfessionals.filter((row) =>
      matchesSearch(row.professionalNickname, search)
    );
  }, [sortedProfessionals, search]);

  const serviceRevenueCents = useMemo(
    () => commissionServiceRevenueCents(report.summary),
    [report.summary]
  );

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      buildQuery(
        fromDate,
        toDate,
        isOwner && selectedPro !== "all" ? selectedPro : professionalId
      )
    );
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    router.push(buildQuery(presetFrom, presetTo, professionalId));
  }

  const listHref = buildQuery(from, to);
  const ownerDetail = Boolean(isOwner && showDetail && activeProfessional);

  const barberSidebar = ownerWorkspace ? (
    <aside
      className={cn(
        ADMIN_SURFACE.panel,
        "flex min-h-0 flex-col overflow-hidden",
        ownerDetail ? "hidden lg:flex" : "flex"
      )}
    >
      <div className="border-b border-white/10 px-3.5 py-3.5 sm:px-4">
        <p className={ADMIN_SURFACE.sectionLabel}>Barbeiros</p>
        <p className={cn("mt-1 text-xs", ADMIN_SURFACE.muted)}>
          {formatPriceBRL(report.summary.commissionCents)} a pagar no período
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filteredProfessionals.length === 0 ? (
          <p className={cn("px-4 py-10 text-center text-sm", ADMIN_SURFACE.muted)}>
            Nenhum barbeiro para &ldquo;{search}&rdquo;.
          </p>
        ) : (
          <ul>
            {filteredProfessionals.map((row) => (
              <li key={row.professionalId}>
                <BarberListItem
                  row={row}
                  selected={professionalId === row.professionalId}
                  href={buildQuery(from, to, row.professionalId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10">
        <div className="bg-[#151618] px-3.5 py-3">
          <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
            Atendimentos
          </p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-[#f5f5f5]">
            {report.summary.serviceItemCount}
          </p>
        </div>
        <div className="bg-[#151618] px-3.5 py-3">
          <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
            Em serviços
          </p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-[#f5f5f5]">
            {formatPriceBRL(serviceRevenueCents)}
          </p>
        </div>
        {report.summary.tipCents > 0 ? (
          <div className="col-span-2 bg-[#151618] px-3.5 py-3">
            <p className={cn("text-[10px] uppercase tracking-wide", ADMIN_SURFACE.muted)}>
              Gorjetas
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-[#f5f5f5]">
              {formatPriceBRL(report.summary.tipCents)}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  ) : null;

  return (
    <div
      className={cn(
        "admin-page -m-4 flex min-h-full flex-col p-4 md:-m-8 md:p-8",
        ADMIN_SURFACE.page
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        <PageHeader
          tone="dark"
          title={
            ownerDetail
              ? activeProfessional!.professionalNickname
              : isOwner
                ? "Comissões"
                : "Minhas comissões"
          }
          description={
            ownerDetail
              ? `${formatPeriodLabel(from, to)} · ${activeProfessional!.commissionPercent}% nos serviços`
              : formatPeriodLabel(from, to)
          }
          backHref={ownerDetail ? listHref : undefined}
          backLabel="Todos os barbeiros"
          action={
            ownerDetail ? (
              <PayCommissionButton
                from={from}
                to={to}
                professionalId={activeProfessional!.professionalId}
                professionalNickname={activeProfessional!.professionalNickname}
                amountCents={activeProfessional!.summary.commissionCents}
                label="Registrar pagamento"
                className={cn(
                  ADMIN_SURFACE.btnPrimary,
                  "h-10 w-full sm:h-9 sm:w-auto"
                )}
              />
            ) : undefined
          }
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
          extraFields={
            isOwner ? (
              <Select value={selectedPro} onValueChange={setSelectedPro}>
                <SelectTrigger
                  aria-label="Barbeiro"
                  className={cn(
                    ADMIN_SURFACE.input,
                    "h-10 w-full sm:h-8 sm:w-[10.5rem]"
                  )}
                >
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className={ADMIN_SURFACE.popover}>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined
          }
        />

        {!hasData ? (
          <EmptyState
            icon={Percent}
            className="border-white/10 text-[#f5f5f5]"
            title={
              isOwner
                ? "Nenhuma comissão em aberto"
                : "Nada a receber neste período"
            }
            description={
              isOwner
                ? "Não há comissão em aberto neste intervalo. Pode ser que já tenha sido paga, ou ainda não há atendimentos finalizados."
                : "Você não teve atendimentos em aberto neste intervalo. Tente outras datas ou confira sua agenda."
            }
            action={
              <Button
                variant="outline"
                size="sm"
                className={ADMIN_SURFACE.btnGhost}
                asChild
              >
                <Link href={`/admin?date=${to}`}>
                  {isOwner ? "Abrir agenda" : "Ver minha agenda"}
                </Link>
              </Button>
            }
          />
        ) : ownerWorkspace ? (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(15.5rem,19rem)_minmax(0,1fr)] lg:items-start">
            {barberSidebar}

            <div
              className={cn(
                ADMIN_SURFACE.panel,
                "min-h-[22rem] overflow-hidden",
                !ownerDetail && "hidden lg:block"
              )}
            >
              {ownerDetail && activeProfessional ? (
                <div className="p-4 sm:p-5">
                  <CommissionBarberSelfView
                    professional={activeProfessional}
                    from={from}
                    to={to}
                    viewer="owner"
                    payouts={payouts}
                    hideIdentityHeader
                    buildDayHref={(date) =>
                      buildQuery(date, date, professionalId)
                    }
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1b1e]">
                    <UserRound className="size-5 text-[#ecf15e]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">
                      Escolha um barbeiro
                    </p>
                    <p className={cn("mx-auto mt-1 max-w-xs text-sm", ADMIN_SURFACE.muted)}>
                      Veja o detalhe da comissão, os atendimentos e registre o
                      pagamento por aqui.
                    </p>
                  </div>
                  {sortedProfessionals[0] ? (
                    <Button
                      className={cn(ADMIN_SURFACE.btnPrimary, "mt-2")}
                      asChild
                    >
                      <Link
                        href={buildQuery(
                          from,
                          to,
                          sortedProfessionals[0].professionalId
                        )}
                      >
                        <Banknote className="size-4" />
                        Abrir {sortedProfessionals[0].professionalNickname}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : showDetail && activeProfessional ? (
          <div className={cn(ADMIN_SURFACE.panel, "p-4 sm:p-5")}>
            <CommissionBarberSelfView
              professional={activeProfessional}
              from={from}
              to={to}
              viewer="self"
              payouts={payouts}
              buildDayHref={(date) => buildQuery(date, date, professionalId)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
