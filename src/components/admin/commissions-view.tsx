"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Percent,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CommissionBarberDetail } from "@/components/admin/commission-barber-detail";
import { CommissionBarberSelfView } from "@/components/admin/commission-barber-self-view";
import {
  commissionServiceRevenueCents,
  type CommissionReport,
} from "@/lib/finance-reports";
import { formatDateBR, formatPriceBRL } from "@/lib/format";
import { shiftDate, monthStart, formatPeriodLabel } from "@/lib/date-range";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

export type CommissionProfessionalOption = {
  id: string;
  nickname: string;
  commissionPercent: number;
};

type CommissionsViewProps = {
  from: string;
  to: string;
  today: string;
  professionalId: string | null;
  report: CommissionReport;
  professionals: CommissionProfessionalOption[];
  isOwner?: boolean;
};

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

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
  isOwner = true,
}: CommissionsViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [selectedPro, setSelectedPro] = useState(
    professionalId ?? (isOwner ? "all" : professionals[0]?.id ?? "all")
  );
  const [search, setSearch] = useState("");

  const activeProfessional =
    professionalId != null
      ? report.professionals.find((row) => row.professionalId === professionalId)
      : null;

  const showDetail =
    !isOwner ||
    (professionalId != null && activeProfessional != null);
  const isSingleDay = from === to;
  const isToday = isSingleDay && from === today;
  const hasData = report.professionals.length > 0;

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

  const dayRows = useMemo(() => {
    const rows = report.byDay;
    return rows.filter((row) => row.serviceItemCount > 0);
  }, [report.byDay]);

  const serviceRevenueCents = useMemo(
    () => commissionServiceRevenueCents(report.summary),
    [report.summary]
  );

  const commissionRate =
    serviceRevenueCents > 0
      ? Math.round(
          ((report.summary.commissionCents - report.summary.tipCents) /
            serviceRevenueCents) *
            100
        )
      : 0;

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
    router.push(
      buildQuery(
        presetFrom,
        presetTo,
        professionalId
      )
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={isOwner ? "Comissões" : "Minhas comissões"}
        description={
          isOwner
            ? "Quanto cada barbeiro tem a receber pelos serviços no período."
            : "Acompanhe sua comissão, serviços e desempenho no período."
        }
        action={
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/financeiro?from=${from}&to=${to}`}>
                  <Wallet className="size-4" />
                  Financeiro
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${to}`}>
                <CalendarDays className="size-4" />
                Agenda
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={applyFilter} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {formatPeriodLabel(from, to)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {isToday
                    ? "Hoje · "
                    : isSingleDay
                      ? "Um dia · "
                      : ""}
                  {isOwner
                    ? "Pelo dia do atendimento (caixa)"
                    : "Pelo dia em que você atendeu"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(today, today)}
                >
                  Hoje
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(shiftDate(today, -6), today)}
                >
                  7 dias
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(monthStart(today), today)}
                >
                  Este mês
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-4 sm:grid-cols-2",
                isOwner
                  ? "lg:grid-cols-[1fr_1fr_1fr_auto]"
                  : "lg:grid-cols-[1fr_1fr_auto]"
              )}
            >
              <div className="space-y-2">
                <Label htmlFor="comm-from">Data inicial</Label>
                <Input
                  id="comm-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comm-to">Data final</Label>
                <Input
                  id="comm-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              {isOwner && (
                <div className="space-y-2">
                  <Label htmlFor="comm-pro">Barbeiro</Label>
                  <Select value={selectedPro} onValueChange={setSelectedPro}>
                    <SelectTrigger id="comm-pro" className="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os barbeiros</SelectItem>
                      {professionals.map((pro) => (
                        <SelectItem key={pro.id} value={pro.id}>
                          {pro.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto">
                  Analisar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {!hasData ? (
        <EmptyState
          icon={Percent}
          title={isOwner ? "Nenhuma comissão no período" : "Nada a receber neste período"}
          description={
            isOwner
              ? "Não há serviços finalizados neste intervalo. Ajuste as datas ou finalize atendimentos na agenda."
              : "Você não teve atendimentos finalizados neste intervalo. Tente outras datas ou confira sua agenda."
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
        <>
          {isOwner && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" className="-ml-2" asChild>
                <Link href={buildQuery(from, to)}>
                  <ArrowLeft className="size-4" />
                  Todos os barbeiros
                </Link>
              </Button>
            </div>
          )}

          <CommissionBarberSelfView
            professional={activeProfessional}
            from={from}
            to={to}
            buildDayHref={(date) => buildQuery(date, date, professionalId)}
          />
        </>
      ) : isOwner ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total a pagar"
              value={formatPriceBRL(report.summary.commissionCents)}
              hint={`${report.professionals.length} barbeiro${report.professionals.length === 1 ? "" : "s"}`}
            />
            <MetricCard
              label="Faturamento"
              value={formatPriceBRL(serviceRevenueCents)}
              hint={
                report.summary.tipCents > 0
                  ? `+ ${formatPriceBRL(report.summary.tipCents)} em gorjetas`
                  : `${report.summary.serviceItemCount} serviços no período`
              }
            />
            <MetricCard
              label="Serviços"
              value={String(report.summary.serviceItemCount)}
              hint="Cortes, barbas e demais serviços"
            />
            <MetricCard
              label="Taxa média"
              value={`${commissionRate}%`}
              hint="Comissão sobre serviços (gorjeta à parte)"
            />
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <Users className="size-4" />
                  Por barbeiro
                </h2>
                <p className="text-xs text-muted-foreground">
                  Serviços, faturamento e comissão de cada um
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Barbeiro</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Serviços
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Faturamento
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Comissão
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfessionals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          Nenhum barbeiro para &ldquo;{search}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredProfessionals.map((row) => {
                        const serviceRevenue = commissionServiceRevenueCents(
                          row.summary
                        );
                        return (
                          <tr
                            key={row.professionalId}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3.5">
                              <p className="font-medium">
                                {row.professionalNickname}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {row.commissionPercent}% nos serviços
                                {row.summary.tipCents > 0 &&
                                  ` · gorjeta ${formatPriceBRL(row.summary.tipCents)}`}
                              </p>
                              <div className="mt-1.5 h-1 w-full max-w-[10rem] overflow-hidden rounded-full bg-muted">
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
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {row.summary.serviceItemCount}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {formatPriceBRL(serviceRevenue)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                              {formatPriceBRL(row.summary.commissionCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                asChild
                              >
                                <Link
                                  href={buildQuery(
                                    from,
                                    to,
                                    row.professionalId
                                  )}
                                >
                                  Detalhar
                                  <ArrowRight className="size-4" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {report.summary.serviceItemCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(serviceRevenueCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.summary.commissionCents)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </section>

          {dayRows.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-medium">Evolução diária</h2>
                <p className="text-xs text-muted-foreground">
                  Comissões de todos os barbeiros por dia
                </p>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Dia</th>
                          <th className="px-4 py-3 font-medium text-right">
                            Serviços
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            Faturamento
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            Comissão
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows.map((row) => (
                          <tr
                            key={row.date}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3.5 font-medium">
                              {formatDateBR(row.date)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {row.serviceItemCount}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatPriceBRL(
                                row.servicesGrossCents - row.tipCents
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                              {formatPriceBRL(row.commissionCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
