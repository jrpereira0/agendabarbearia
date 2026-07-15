"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  const maxCommission = useMemo(
    () =>
      Math.max(
        ...report.professionals.map((row) => row.summary.commissionCents),
        0
      ),
    [report.professionals]
  );

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={isOwner ? "Comissões" : "Minhas comissões"}
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
        extraFields={
          isOwner ? (
            <Select value={selectedPro} onValueChange={setSelectedPro}>
              <SelectTrigger
                aria-label="Barbeiro"
                className="h-10 w-full bg-background sm:h-8 sm:w-[10.5rem]"
              >
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
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
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${to}`}>
                {isOwner ? "Abrir agenda" : "Ver minha agenda"}
              </Link>
            </Button>
          }
        />
      ) : showDetail && activeProfessional ? (
        <div className="flex flex-col gap-3">
          {isOwner && (
            <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
              <Link href={buildQuery(from, to)}>
                <ArrowLeft className="size-4" />
                Todos os barbeiros
              </Link>
            </Button>
          )}

          <CommissionBarberSelfView
            professional={activeProfessional}
            from={from}
            to={to}
            viewer={isOwner ? "owner" : "self"}
            payouts={payouts}
            buildDayHref={(date) => buildQuery(date, date, professionalId)}
          />
        </div>
      ) : isOwner ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total a pagar</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatPriceBRL(report.summary.commissionCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {report.summary.serviceItemCount} atendimento
                {report.summary.serviceItemCount === 1 ? "" : "s"}
                {" · "}
                {formatPriceBRL(serviceRevenueCents)} em serviços
                {report.summary.tipCents > 0
                  ? ` · ${formatPriceBRL(report.summary.tipCents)} gorjeta`
                  : ""}
              </p>
            </div>
            <div className="w-full sm:max-w-xs">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar barbeiro…"
              />
            </div>
          </div>

          <Card className="overflow-hidden">
            {/* Mobile: cards */}
            <div className="flex flex-col divide-y md:hidden">
              {filteredProfessionals.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum barbeiro para &ldquo;{search}&rdquo;.
                </p>
              ) : (
                filteredProfessionals.map((row) => {
                  const detailHref = buildQuery(
                    from,
                    to,
                    row.professionalId
                  );
                  return (
                    <div
                      key={row.professionalId}
                      className="flex flex-col gap-3 p-4 active:bg-muted/40"
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(detailHref)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(detailHref);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {row.professionalNickname}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.commissionPercent}% · {row.summary.serviceItemCount}{" "}
                            atendimento
                            {row.summary.serviceItemCount === 1 ? "" : "s"}
                            {row.summary.tipCents > 0 &&
                              ` · gorjeta ${formatPriceBRL(row.summary.tipCents)}`}
                          </p>
                          <div className="mt-2 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{
                                width: `${
                                  maxCommission > 0
                                    ? Math.round(
                                        (row.summary.commissionCents /
                                          maxCommission) *
                                          100
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Comissão</p>
                          <p className="text-base font-semibold tabular-nums">
                            {formatPriceBRL(row.summary.commissionCents)}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <PayCommissionButton
                          from={from}
                          to={to}
                          professionalId={row.professionalId}
                          professionalNickname={row.professionalNickname}
                          amountCents={row.summary.commissionCents}
                          className="h-10 flex-1"
                        />
                        <Button
                          variant="outline"
                          className="h-10 flex-1"
                          asChild
                        >
                          <Link href={detailHref}>
                            Detalhes
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Barbeiro</th>
                    <th className="px-3 py-2.5 font-medium text-right">Qtd</th>
                    <th className="px-3 py-2.5 font-medium text-right">
                      Comissão
                    </th>
                    <th className="px-3 py-2.5 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfessionals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        Nenhum barbeiro para &ldquo;{search}&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    filteredProfessionals.map((row) => {
                      const detailHref = buildQuery(
                        from,
                        to,
                        row.professionalId
                      );
                      return (
                        <tr
                          key={row.professionalId}
                          className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40"
                          onClick={() => router.push(detailHref)}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium">
                              {row.professionalNickname}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.commissionPercent}%
                              {row.summary.tipCents > 0 &&
                                ` · gorjeta ${formatPriceBRL(row.summary.tipCents)}`}
                            </p>
                            <div className="mt-1.5 h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full bg-foreground/70"
                                )}
                                style={{
                                  width: `${
                                    maxCommission > 0
                                      ? Math.round(
                                          (row.summary.commissionCents /
                                            maxCommission) *
                                            100
                                        )
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {row.summary.serviceItemCount}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">
                            {formatPriceBRL(row.summary.commissionCents)}
                          </td>
                          <td
                            className="px-3 py-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <PayCommissionButton
                                from={from}
                                to={to}
                                professionalId={row.professionalId}
                                professionalNickname={row.professionalNickname}
                                amountCents={row.summary.commissionCents}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                asChild
                              >
                                <Link
                                  href={detailHref}
                                  aria-label={`Detalhar ${row.professionalNickname}`}
                                >
                                  <ArrowRight className="size-4" />
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
