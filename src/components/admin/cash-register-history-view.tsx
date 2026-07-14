"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Lock,
  MoreVertical,
  Percent,
  Plus,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { SearchInput } from "@/components/admin/search-input";
import { FinancePeriodFilter } from "@/components/admin/finance-period-filter";
import { closeCashRegisterAction } from "@/app/admin/(panel)/financeiro/actions";
import {
  OpenCashRegisterDialog,
  type CashRegisterResponsibleOption,
} from "@/components/admin/open-cash-register-dialog";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import { formatDateBR, formatDateTimeBR, formatPriceBRL } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/date-range";
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

  const hasSearchNoResults = sessions.length > 0 && filtered.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Caixas"
        description={formatPeriodLabel(from, to)}
        action={
          <Button
            type="button"
            size="sm"
            disabled={Boolean(openCashRegister)}
            onClick={() => startOpenCash(today, "open")}
          >
            <Plus className="size-4" />
            Abrir caixa
          </Button>
        }
      />

      {openCashRegister && (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
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
          </p>
          <p className="text-xs text-muted-foreground">
            Feche este caixa antes de abrir outro dia.
          </p>
        </div>
      )}

      <FinancePeriodFilter
        today={today}
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onSubmit={applyFilter}
        onPreset={applyPreset}
      />

      {sessions.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {filtered.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Entradas no caixa</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatPriceBRL(periodCashInflowCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {filtered.length} caixa{filtered.length === 1 ? "" : "s"}
                {" · "}
                média {formatPriceBRL(avgPerSession)}
                {periodServiceCents < periodCashInflowCents
                  ? ` · ${formatPriceBRL(periodServiceCents)} em serviços`
                  : ""}
                {" · "}
                {openCount > 0
                  ? `${openCount} aberto${openCount === 1 ? "" : "s"}`
                  : `${closedCount} fechado${closedCount === 1 ? "" : "s"}`}
                {openCount > 0 && closedCount > 0
                  ? ` · ${closedCount} fechado${closedCount === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          ) : (
            <div />
          )}
          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar data ou responsável…"
            />
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
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
      ) : hasSearchNoResults ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum resultado"
          description="Nenhum caixa combina com essa busca. Tente outro nome ou data."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
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
                  const detailHref = `/admin/financeiro/caixas/${session.serviceDate}?from=${from}&to=${to}`;

                  return (
                    <tr
                      key={session.id}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/40"
                      onClick={() => router.push(detailHref)}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                        {formatDateBR(session.serviceDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              isOpen
                                ? "bg-emerald-500"
                                : "bg-muted-foreground/40"
                            )}
                            aria-hidden
                          />
                          <span className="text-sm">
                            {isOpen ? "Aberto" : "Fechado"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {operator}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        <div>{formatPriceBRL(session.cashInflowCents)}</div>
                        {session.creditDepositsCents > 0 && (
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                            +{formatPriceBRL(session.creditDepositsCents)}{" "}
                            crédito
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
                      <td
                        className="px-4 py-3.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Mais ações"
                                disabled={busy}
                              >
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={detailHref}>
                                  <Wallet />
                                  Ver detalhes
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin?date=${session.serviceDate}`}>
                                  <CalendarDays />
                                  Ver na agenda
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/admin/financeiro/comissoes?from=${session.serviceDate}&to=${session.serviceDate}`}
                                >
                                  <Percent />
                                  Comissões do dia
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
