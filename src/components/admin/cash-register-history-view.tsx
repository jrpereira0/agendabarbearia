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
import { formatDateBR, formatPriceBRL } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/date-range";
import { matchesSearch } from "@/lib/text";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
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
  const [appliedRange, setAppliedRange] = useState({ from, to });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (appliedRange.from !== from || appliedRange.to !== to) {
    setAppliedRange({ from, to });
    setFromDate(from);
    setToDate(to);
  }

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

  const openCount = useMemo(
    () => filtered.filter((s) => s.status === "open").length,
    [filtered]
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
  const showSearch = sessions.length > 5 || search.trim().length > 0;

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
          title="Caixas"
          description={formatPeriodLabel(from, to)}
          action={
            <Button
              type="button"
              size="sm"
              className={ADMIN_SURFACE.btnPrimary}
              disabled={Boolean(openCashRegister)}
              onClick={() => startOpenCash(today, "open")}
            >
              <Plus className="size-4" />
              Abrir caixa
            </Button>
          }
        />

        {openCashRegister ? (
          <div
            className={cn(
              ADMIN_SURFACE.panel,
              "border-dashed px-4 py-3 text-sm"
            )}
          >
            <p className={ADMIN_SURFACE.muted}>
              Caixa aberto em{" "}
              <Link
                href={`/admin/financeiro/caixas/${openCashRegister.serviceDate}`}
                className={cn(
                  "font-medium underline-offset-4 hover:underline",
                  ADMIN_SURFACE.accent
                )}
              >
                {formatDateBR(openCashRegister.serviceDate)}
              </Link>
              {openCashRegister.responsibleName
                ? ` · ${openCashRegister.responsibleName}`
                : ""}
              . Feche antes de abrir outro.
            </p>
          </div>
        ) : null}

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

        {sessions.length > 0 && filtered.length > 0 ? (
          <div
            className={cn(
              ADMIN_SURFACE.panel,
              "flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            )}
          >
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  ADMIN_SURFACE.muted
                )}
              >
                Entradas no período
              </p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-semibold tabular-nums",
                  ADMIN_SURFACE.accent
                )}
              >
                {formatPriceBRL(periodCashInflowCents)}
              </p>
            </div>
            <p className={cn("shrink-0 text-xs", ADMIN_SURFACE.muted)}>
              {filtered.length} caixa{filtered.length === 1 ? "" : "s"}
              {openCount > 0
                ? ` · ${openCount} aberto${openCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        ) : null}

        {showSearch ? (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar data ou responsável…"
            inputClassName={ADMIN_SURFACE.input}
          />
        ) : null}

        {sessions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            className="border-white/10 text-[#f5f5f5]"
            title="Nenhum caixa neste período"
            description="Abra o caixa na agenda ou ajuste o intervalo de datas."
            action={
              <Button
                type="button"
                size="sm"
                className={ADMIN_SURFACE.btnPrimary}
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
            className="border-white/10 text-[#f5f5f5]"
            title="Nenhum resultado"
            description="Nenhum caixa combina com essa busca. Tente outro nome ou data."
          />
        ) : (
          <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
            <ul className="divide-y divide-white/10">
              {filtered.map((session) => {
                const isOpen = session.status === "open";
                const busy = busyDate === session.serviceDate || pending;
                const operator =
                  session.responsibleName ?? session.openedByName ?? "—";
                const detailHref = `/admin/financeiro/caixas/${session.serviceDate}?from=${from}&to=${to}`;

                return (
                  <li key={session.id}>
                    <div
                      role="link"
                      tabIndex={0}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] sm:px-5"
                      onClick={() => router.push(detailHref)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(detailHref);
                        }
                      }}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          isOpen ? "bg-emerald-400" : "bg-white/25"
                        )}
                        aria-hidden
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                          {formatDateBR(session.serviceDate)}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-xs",
                            ADMIN_SURFACE.muted
                          )}
                        >
                          {isOpen ? "Aberto" : "Fechado"}
                          {" · "}
                          {operator}
                        </p>
                      </div>

                      <p
                        className={cn(
                          "shrink-0 text-[15px] font-semibold tabular-nums",
                          ADMIN_SURFACE.accent
                        )}
                      >
                        {formatPriceBRL(session.cashInflowCents)}
                      </p>

                      <div
                        className="shrink-0"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-[#8b8d93] hover:bg-white/5 hover:text-[#f5f5f5]"
                              aria-label="Mais ações"
                              disabled={busy}
                            >
                              <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className={ADMIN_SURFACE.popover}
                          >
                            {isOpen ? (
                              <DropdownMenuItem
                                disabled={busy}
                                onClick={() =>
                                  setConfirmCloseDate(session.serviceDate)
                                }
                              >
                                <Lock />
                                Fechar caixa
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={busy || Boolean(openCashRegister)}
                                onClick={() =>
                                  startOpenCash(
                                    session.serviceDate,
                                    "reopen",
                                    session
                                  )
                                }
                              >
                                <RotateCcw />
                                Reabrir caixa
                              </DropdownMenuItem>
                            )}
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <OpenCashRegisterDialog
          key={`${openDialog}-${openMode}-${dialogDate ?? today}`}
          open={openDialog}
          onOpenChange={setOpenDialog}
          serviceDate={dialogDate ?? today}
          today={today}
          mode={openMode}
          lockServiceDate={openMode === "reopen"}
          responsibleOptions={responsibleOptions}
          defaultResponsibleId={defaultResponsibleId}
          defaultOpeningBalanceCents={dialogSession?.openingBalanceCents ?? 0}
          tone="dark"
          onSuccess={() => {
            window.setTimeout(() => refreshSoon(), 0);
          }}
        />

        <Dialog
          open={confirmCloseDate != null}
          onOpenChange={(open) => !open && setConfirmCloseDate(null)}
        >
          <DialogContent
            className={cn(
              "max-w-sm border-white/10 bg-[#151618] text-[#f5f5f5]"
            )}
          >
            <DialogHeader>
              <DialogTitle className="text-[#f5f5f5]">
                Encerrar caixa?
              </DialogTitle>
              <DialogDescription className={ADMIN_SURFACE.muted}>
                {confirmCloseDate ? (
                  <>
                    Caixa de {formatDateBR(confirmCloseDate)}. Depois de
                    encerrar, não será possível finalizar novas comandas neste
                    dia.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className={ADMIN_SURFACE.btnGhost}
                onClick={() => setConfirmCloseDate(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className={ADMIN_SURFACE.btnPrimary}
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
    </div>
  );
}
