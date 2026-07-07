"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Lock,
  Percent,
  Plus,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { SearchInput } from "@/components/admin/search-input";
import { closeCashRegisterAction } from "@/app/admin/(panel)/financeiro/actions";
import {
  OpenCashRegisterDialog,
  type CashRegisterResponsibleOption,
} from "@/components/admin/open-cash-register-dialog";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import { formatDateBR, formatDateTimeBR, formatPriceBRL } from "@/lib/format";
import { shiftDate, monthStart, formatPeriodLabel } from "@/lib/date-range";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

type CashRegisterHistoryViewProps = {
  from: string;
  to: string;
  today: string;
  sessions: CashRegisterSession[];
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
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
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function CashRegisterHistoryView({
  from,
  to,
  today,
  sessions,
  openCashRegister,
  responsibleOptions,
}: CashRegisterHistoryViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mountedRef = useRef(true);
  const [fromDate, setFromDate] = useState(from);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFromDate(from);
    setToDate(to);
  }, [from, to]);
  const [toDate, setToDate] = useState(to);
  const [search, setSearch] = useState("");
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openMode, setOpenMode] = useState<"open" | "reopen">("open");
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [dialogSession, setDialogSession] = useState<CashRegisterSession | null>(
    null
  );
  const [confirmCloseDate, setConfirmCloseDate] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    return sessions.filter((session) =>
      matchesSearch(
        [
          formatDateBR(session.serviceDate),
          session.status === "open" ? "aberto" : "fechado",
          session.openedByName ?? "",
          session.responsibleName ?? "",
          session.closedByName ?? "",
        ].join(" "),
        search
      )
    );
  }, [sessions, search]);

  const periodCashInflowCents = useMemo(
    () => filtered.reduce((sum, row) => sum + row.cashInflowCents, 0),
    [filtered]
  );

  const periodServiceCents = useMemo(
    () => filtered.reduce((sum, row) => sum + row.totalCents, 0),
    [filtered]
  );

  const openCount = useMemo(
    () => filtered.filter((s) => s.status === "open").length,
    [filtered]
  );

  const closedCount = filtered.length - openCount;

  const avgPerSession = useMemo(
    () =>
      filtered.length > 0
        ? Math.round(periodCashInflowCents / filtered.length)
        : 0,
    [filtered.length, periodCashInflowCents]
  );

  const defaultResponsibleId = dialogSession
    ? responsibleOptions.find(
        (option) => option.label === dialogSession.responsibleName
      )?.id
    : undefined;

  function refreshSoon() {
    if (!mountedRef.current) return;
    startTransition(() => router.refresh());
  }

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/financeiro/caixas?from=${fromDate}&to=${toDate}`);
  }

  function applyPreset(presetFrom: string, presetTo: string) {
    setFromDate(presetFrom);
    setToDate(presetTo);
    router.push(`/admin/financeiro/caixas?from=${presetFrom}&to=${presetTo}`);
  }

  async function runClose(serviceDate: string) {
    setBusyDate(serviceDate);
    const result = await closeCashRegisterAction(serviceDate);
    setBusyDate(null);
    if (!mountedRef.current) return;

    if (result.ok) {
      toast.success("Caixa encerrado.");
      setConfirmCloseDate(null);
      window.setTimeout(() => refreshSoon(), 0);
    } else {
      toast.error(result.error);
    }
  }

  function startOpenCash(
    serviceDate: string,
    mode: "open" | "reopen",
    session?: CashRegisterSession
  ) {
    setDialogDate(serviceDate);
    setDialogSession(session ?? null);
    setOpenMode(mode);
    setOpenDialog(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Caixas"
        description="Histórico de abertura e fechamento por dia."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={Boolean(openCashRegister)}
              onClick={() => startOpenCash(today, "open")}
            >
              <Plus className="size-4" />
              Abrir caixa
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/financeiro?from=${from}&to=${to}`}>
                <Wallet className="size-4" />
                Financeiro
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin?date=${today}`}>
                <CalendarDays className="size-4" />
                Agenda
              </Link>
            </Button>
          </div>
        }
      />

      {openCashRegister && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Caixa aberto em{" "}
          <Link
            href={`/admin?date=${openCashRegister.serviceDate}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {formatDateBR(openCashRegister.serviceDate)}
          </Link>
          {openCashRegister.responsibleName && (
            <> · {openCashRegister.responsibleName}</>
          )}
          . Feche este caixa antes de abrir outro dia.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={applyFilter} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {formatPeriodLabel(from, to)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Sessões de caixa no período
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="from-date">Data inicial</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">Data final</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto">
                  Pesquisar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Entradas no caixa"
            value={formatPriceBRL(periodCashInflowCents)}
            hint={
              periodServiceCents < periodCashInflowCents
                ? `${formatPriceBRL(periodServiceCents)} em serviços · ${filtered.length} caixa${filtered.length === 1 ? "" : "s"}`
                : `${filtered.length} caixa${filtered.length === 1 ? "" : "s"}`
            }
          />
          <MetricCard
            label="Média por caixa"
            value={formatPriceBRL(avgPerSession)}
            hint="Entradas por dia fechado"
          />
          <MetricCard
            label="Status"
            value={`${openCount} aberto${openCount === 1 ? "" : "s"}`}
            hint={`${closedCount} fechado${closedCount === 1 ? "" : "s"}`}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por data ou responsável…"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum caixa neste período"
          description="Abra o caixa na agenda ou ajuste o intervalo de datas."
          action={
            <Button
              type="button"
              size="sm"
              disabled={Boolean(openCashRegister)}
              onClick={() => startOpenCash(today, "open")}
            >
              <Plus className="size-4" />
              Abrir caixa de hoje
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Dia</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Responsável</th>
                  <th className="px-4 py-3 font-medium text-right">Entradas</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Aberto
                  </th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Fechado
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => {
                  const isOpen = session.status === "open";
                  const busy = busyDate === session.serviceDate || pending;
                  const operator =
                    session.responsibleName ??
                    session.openedByName ??
                    "—";

                  return (
                    <tr key={session.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                        {formatDateBR(session.serviceDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              isOpen
                                ? "bg-emerald-500"
                                : "bg-muted-foreground/40"
                            )}
                            aria-hidden
                          />
                          <Badge
                            variant={isOpen ? "default" : "secondary"}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            {isOpen ? "Aberto" : "Fechado"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {operator}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        <div>{formatPriceBRL(session.cashInflowCents)}</div>
                        {session.creditDepositsCents > 0 && (
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                            +{formatPriceBRL(session.creditDepositsCents)} crédito
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                        {session.openedAt
                          ? formatDateTimeBR(session.openedAt)
                          : "—"}
                      </td>
                      <td className="hidden px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                        {session.closedAt
                          ? formatDateTimeBR(session.closedAt)
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            asChild
                          >
                            <Link href={`/admin?date=${session.serviceDate}`}>
                              Agenda
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            asChild
                          >
                            <Link
                              href={`/admin/financeiro/comissoes?from=${session.serviceDate}&to=${session.serviceDate}`}
                            >
                              <Percent className="size-3.5" />
                            </Link>
                          </Button>
                          {isOpen ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={busy}
                              onClick={() =>
                                setConfirmCloseDate(session.serviceDate)
                              }
                            >
                              <Lock className="size-3.5" />
                              Fechar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={busy || Boolean(openCashRegister)}
                              onClick={() =>
                                startOpenCash(
                                  session.serviceDate,
                                  "reopen",
                                  session
                                )
                              }
                            >
                              <RotateCcw className="size-3.5" />
                              Reabrir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <OpenCashRegisterDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        serviceDate={dialogDate ?? today}
        today={today}
        mode={openMode}
        lockServiceDate={openMode === "reopen"}
        responsibleOptions={responsibleOptions}
        defaultResponsibleId={defaultResponsibleId}
        defaultOpeningBalanceCents={dialogSession?.openingBalanceCents ?? 0}
        onSuccess={() => {
          window.setTimeout(() => refreshSoon(), 0);
        }}
      />

      <Dialog
        open={confirmCloseDate != null}
        onOpenChange={(open) => !open && setConfirmCloseDate(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encerrar caixa?</DialogTitle>
            <DialogDescription>
              {confirmCloseDate && (
                <>
                  Caixa de {formatDateBR(confirmCloseDate)}. Depois de encerrar,
                  não será possível finalizar novas comandas neste dia.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCloseDate(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={busyDate != null}
              onClick={() =>
                confirmCloseDate && void runClose(confirmCloseDate)
              }
            >
              Encerrar caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
