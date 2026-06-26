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
import {
  formatPaymentMethodLabel,
  type CommissionReport,
} from "@/lib/finance-reports";
import { PAYMENT_METHODS } from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL } from "@/lib/format";
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
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function formatPeriodLabel(from: string, to: string): string {
  if (from === to) return formatDateBR(from);
  return `${formatDateBR(from)} a ${formatDateBR(to)}`;
}

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

function BarRow({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatPriceBRL(value)}
          {suffix && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/80"
          style={{ width: `${pct}%` }}
        />
      </div>
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
}: CommissionsViewProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [selectedPro, setSelectedPro] = useState(professionalId ?? "all");
  const [search, setSearch] = useState("");

  const activeProfessional =
    professionalId != null
      ? report.professionals.find((row) => row.professionalId === professionalId)
      : null;

  const showDetail = professionalId != null && activeProfessional != null;
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

  const paymentRows = showDetail
    ? activeProfessional!.byPaymentMethod
    : report.byPaymentMethod;

  const activePaymentMethods = useMemo(
    () => PAYMENT_METHODS.filter((method) => paymentRows[method] > 0),
    [paymentRows]
  );

  const paymentTotal = useMemo(
    () =>
      activePaymentMethods.reduce((sum, method) => sum + paymentRows[method], 0),
    [activePaymentMethods, paymentRows]
  );

  const dayRows = useMemo(() => {
    const rows = showDetail ? activeProfessional!.byDay : report.byDay;
    return rows.filter((row) => row.comandaCount > 0);
  }, [showDetail, activeProfessional, report.byDay]);

  const maxDayCommission = useMemo(
    () => Math.max(...dayRows.map((day) => day.commissionCents), 0),
    [dayRows]
  );

  const commissionRate =
    report.summary.servicesGrossCents > 0
      ? Math.round(
          (report.summary.commissionCents / report.summary.servicesGrossCents) *
            100
        )
      : 0;

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      buildQuery(
        fromDate,
        toDate,
        selectedPro !== "all" ? selectedPro : null
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
        title="Comissões"
        description="Quanto cada barbeiro tem a receber pelos serviços no período."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/financeiro?from=${from}&to=${to}`}>
                <Wallet className="size-4" />
                Financeiro
              </Link>
            </Button>
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
                  Pelo dia do atendimento (caixa)
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
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
          title="Nenhuma comissão no período"
          description="Não há serviços finalizados neste intervalo. Ajuste as datas ou feche comandas na agenda."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${to}`}>Abrir agenda</Link>
            </Button>
          }
        />
      ) : showDetail && activeProfessional ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" className="-ml-2" asChild>
              <Link href={buildQuery(from, to)}>
                <ArrowLeft className="size-4" />
                Todos os barbeiros
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border px-5 py-4">
            <p className="text-lg font-semibold">
              {activeProfessional.professionalNickname}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {activeProfessional.commissionPercent}% de comissão ·{" "}
              {activeProfessional.summary.comandaCount} comanda
              {activeProfessional.summary.comandaCount === 1 ? "" : "s"} ·{" "}
              {activeProfessional.summary.itemCount} serviço
              {activeProfessional.summary.itemCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Comissão a pagar"
              value={formatPriceBRL(activeProfessional.summary.commissionCents)}
              hint="Valor do repasse no período"
            />
            <MetricCard
              label="Faturamento dos serviços"
              value={formatPriceBRL(activeProfessional.summary.servicesGrossCents)}
              hint={`${activeProfessional.commissionPercent}% sobre os serviços`}
            />
            <MetricCard
              label="Ticket médio"
              value={formatPriceBRL(
                activeProfessional.summary.comandaCount > 0
                  ? Math.round(
                      activeProfessional.summary.commissionCents /
                        activeProfessional.summary.comandaCount
                    )
                  : 0
              )}
              hint="Comissão por comanda"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-medium">Dia a dia</h2>
                <p className="text-xs text-muted-foreground">
                  Comissão por dia do caixa
                </p>
              </div>
              <Card>
                <CardContent className="p-0">
                  {dayRows.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Sem movimentação diária.
                    </p>
                  ) : (
                    <div className="max-h-[20rem] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 border-b bg-background">
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="px-4 py-2.5 font-medium">Dia</th>
                            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                              Comandas
                            </th>
                            <th className="px-4 py-2.5 font-medium text-right">
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
                              <td className="px-4 py-3">
                                <p className="font-medium">
                                  {formatDateBR(row.date)}
                                </p>
                                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-foreground/70"
                                    style={{
                                      width: `${
                                        maxDayCommission > 0
                                          ? Math.round(
                                              (row.commissionCents /
                                                maxDayCommission) *
                                                100
                                            )
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                                {row.comandaCount}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                {formatPriceBRL(row.commissionCents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-medium">Pagamentos proporcionais</h2>
                <p className="text-xs text-muted-foreground">
                  Parte dos recebimentos atribuída a este barbeiro
                </p>
              </div>
              <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                  {activePaymentMethods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem dados de pagamento.
                    </p>
                  ) : (
                    activePaymentMethods.map((method) => {
                      const amount = paymentRows[method];
                      const pct =
                        paymentTotal > 0
                          ? Math.round((amount / paymentTotal) * 100)
                          : 0;
                      return (
                        <BarRow
                          key={method}
                          label={formatPaymentMethodLabel(method)}
                          value={amount}
                          max={paymentTotal}
                          suffix={`${pct}%`}
                        />
                      );
                    })
                  )}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                A comissão é calculada sobre o valor do serviço, não sobre a
                forma de pagamento. Os valores acima são apenas informativos.
              </p>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total a pagar"
              value={formatPriceBRL(report.summary.commissionCents)}
              hint={`${report.professionals.length} barbeiro${report.professionals.length === 1 ? "" : "s"}`}
            />
            <MetricCard
              label="Faturamento serviços"
              value={formatPriceBRL(report.summary.servicesGrossCents)}
              hint={`${report.summary.comandaCount} comandas`}
            />
            <MetricCard
              label="Serviços realizados"
              value={String(report.summary.itemCount)}
              hint="Itens nas comandas"
            />
            <MetricCard
              label="Taxa média"
              value={`${commissionRate}%`}
              hint="Comissão sobre faturamento"
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
                  Clique em detalhar para ver o dia a dia de cada um
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
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Barbeiro</th>
                      <th className="px-4 py-3 font-medium text-right">%</th>
                      <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">
                        Comandas
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Faturamento
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Comissão
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Part.
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfessionals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          Nenhum barbeiro para &ldquo;{search}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredProfessionals.map((row) => {
                        const share =
                          report.summary.commissionCents > 0
                            ? Math.round(
                                (row.summary.commissionCents /
                                  report.summary.commissionCents) *
                                  100
                              )
                            : 0;
                        return (
                          <tr
                            key={row.professionalId}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3.5">
                              <p className="font-medium">
                                {row.professionalNickname}
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
                            <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                              {row.commissionPercent}%
                            </td>
                            <td className="hidden px-4 py-3.5 text-right tabular-nums sm:table-cell">
                              {row.summary.comandaCount}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              {formatPriceBRL(row.summary.servicesGrossCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                              {formatPriceBRL(row.summary.commissionCents)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                              {share}%
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
                      <td className="px-4 py-3" colSpan={2}>
                        Total
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                        {report.summary.comandaCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.summary.servicesGrossCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPriceBRL(report.summary.commissionCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">100%</td>
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
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Dia</th>
                          <th className="px-4 py-3 font-medium text-right">
                            Comandas
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
                              {row.comandaCount}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatPriceBRL(row.servicesGrossCents)}
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
      )}
    </div>
  );
}
