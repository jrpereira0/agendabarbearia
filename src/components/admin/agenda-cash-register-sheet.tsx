"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronRight,
  Lock,
  RefreshCw,
  RotateCcw,
  Unlock,
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
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SearchInput } from "@/components/admin/search-input";
import { EmptyState } from "@/components/admin/empty-state";
import {
  OpenCashRegisterDialog,
  type CashRegisterResponsibleOption,
} from "@/components/admin/open-cash-register-dialog";
import { closeCashRegisterAction } from "@/app/admin/(panel)/financeiro/actions";
import {
  formatPaymentMethodLabel,
  type CashRegisterSummary,
} from "@/lib/finance-reports";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import {
  PAYMENT_METHODS,
  CASH_INFLOW_PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL, formatTime } from "@/lib/format";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

type AgendaCashRegisterSheetProps = {
  date: string;
  today: string;
  cash: CashRegisterSummary;
  cashSession: CashRegisterSession | null;
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
  onComandaClick?: (appointmentId: string) => void;
};

function formatClosedTime(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return "";
  return formatTime(`${match[1]}:${match[2]}:00`);
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function PaymentBar({
  label,
  amountCents,
  totalCents,
}: {
  label: string;
  amountCents: number;
  totalCents: number;
}) {
  const pct =
    totalCents > 0 ? Math.max(2, Math.round((amountCents / totalCents) * 100)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
          {formatPriceBRL(amountCents)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AgendaCashRegisterSheet({
  date,
  today,
  cash,
  cashSession,
  openCashRegister,
  responsibleOptions,
  onComandaClick,
}: AgendaCashRegisterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [openMode, setOpenMode] = useState<"open" | "reopen">("open");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const wasOpenRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (wasOpenRef.current && !open) setSearch("");
    wasOpenRef.current = open;
  }, [open]);

  const otherDayOpen =
    openCashRegister && openCashRegister.serviceDate !== date
      ? openCashRegister
      : null;

  const defaultResponsibleId = responsibleOptions.find(
    (option) => option.label === cashSession?.responsibleName
  )?.id;

  const filteredComandas = useMemo(() => {
    if (!search.trim()) return cash.comandas;
    return cash.comandas.filter(
      (row) =>
        matchesSearch(row.customerName, search) ||
        matchesSearch(row.professionalNickname, search)
    );
  }, [cash.comandas, search]);

  const activePaymentMethods = useMemo(
    () =>
      PAYMENT_METHODS.filter((method) => {
        if (method === "store_credit") {
          return cash.byPaymentMethod.store_credit > 0;
        }
        const inflowMethod = method as (typeof CASH_INFLOW_PAYMENT_METHODS)[number];
        return (
          cash.byPaymentMethod[inflowMethod] > 0 ||
          cash.creditDepositsByMethod[inflowMethod] > 0
        );
      }),
    [cash.byPaymentMethod, cash.creditDepositsByMethod]
  );

  const paymentMethodTotal = (method: PaymentMethod): number => {
    if (method === "store_credit") return cash.byPaymentMethod.store_credit;
    const inflowMethod = method as (typeof CASH_INFLOW_PAYMENT_METHODS)[number];
    return (
      cash.byPaymentMethod[inflowMethod] +
      cash.creditDepositsByMethod[inflowMethod]
    );
  };

  const cashInDrawer = paymentMethodTotal("cash");
  const isCashOpen = cashSession?.status === "open";
  const balanceCents = cash.cashInflowCents;
  const comandaLabel =
    cash.comandaCount === 1
      ? "1 comanda"
      : `${cash.comandaCount} comandas`;

  function startOpenCash(mode: "open" | "reopen") {
    setOpenMode(mode);
    setOpenDialog(true);
  }

  function refreshSoon() {
    if (!mountedRef.current) return;
    startTransition(() => router.refresh());
  }

  async function handleCloseCash() {
    const result = await closeCashRegisterAction(date);
    if (!mountedRef.current) return;
    if (result.ok) {
      toast.success("Caixa encerrado.");
      setConfirmClose(false);
      window.setTimeout(() => refreshSoon(), 0);
    } else {
      toast.error(result.error);
    }
  }

  function handleComandaClick(appointmentId: string) {
    onComandaClick?.(appointmentId);
    setOpen(false);
  }

  function handleRefresh() {
    refreshSoon();
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group fixed right-0 top-[42%] z-40 flex -translate-y-1/2 flex-col items-center gap-2.5",
            "rounded-l-xl border border-r-0 bg-background/95 px-2.5 py-3.5 shadow-sm backdrop-blur-sm",
            "transition-colors hover:bg-muted/50"
          )}
          aria-label="Abrir caixa do dia"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              isCashOpen ? "bg-foreground" : "bg-muted-foreground/35"
            )}
            aria-hidden
          />
          <span
            className="text-[10px] font-semibold tracking-[0.18em] text-foreground"
            style={{ writingMode: "vertical-rl" }}
          >
            CAIXA
          </span>
          {balanceCents > 0 && (
            <span
              className="text-[10px] font-medium tabular-nums text-muted-foreground"
              style={{ writingMode: "vertical-rl" }}
            >
              {formatPriceBRL(balanceCents)}
            </span>
          )}
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md md:max-w-lg"
        >
          <SheetTitle className="sr-only">Caixa do dia</SheetTitle>

          {/* Cabeçalho + saldo hero */}
          <header className="shrink-0 border-b px-5 pb-5 pt-5 pr-14">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Caixa do dia
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      isCashOpen
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isCashOpen ? "bg-background" : "bg-muted-foreground/50"
                      )}
                      aria-hidden
                    />
                    {isCashOpen ? "Aberto" : "Fechado"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateBR(date)}
                  {cashSession?.responsibleName && (
                    <> · {cashSession.responsibleName}</>
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 shrink-0"
                disabled={pending}
                onClick={handleRefresh}
                aria-label="Atualizar caixa"
              >
                <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              </Button>
            </div>

            {otherDayOpen && (
              <p className="mt-4 rounded-xl border border-dashed bg-muted/20 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                O caixa de{" "}
                <Link
                  href={`/admin?date=${otherDayOpen.serviceDate}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {formatDateBR(otherDayOpen.serviceDate)}
                </Link>{" "}
                ainda está aberto. Feche-o antes de abrir este dia.
              </p>
            )}

            <div className="mt-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Saldo do dia
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-[2rem]">
                {formatPriceBRL(balanceCents)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cash.comandaCount > 0
                  ? `${comandaLabel} fechada${cash.comandaCount === 1 ? "" : "s"}`
                  : "Nenhuma comanda fechada ainda"}
                {cashInDrawer > 0 && (
                  <> · dinheiro {formatPriceBRL(cashInDrawer)}</>
                )}
              </p>
            </div>

            {/* Métricas secundárias */}
            <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
              <div className="bg-background px-3 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Entradas
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums leading-none">
                  {formatPriceBRL(cash.cashInflowCents)}
                </p>
              </div>
              <div className="bg-background px-3 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Comissões
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums leading-none">
                  {formatPriceBRL(cash.commissionCents)}
                </p>
              </div>
              <div className="bg-background px-3 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Barbearia
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums leading-none">
                  {formatPriceBRL(cash.shopCents)}
                </p>
              </div>
            </div>

            {/* Formas de pagamento */}
            {activePaymentMethods.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {activePaymentMethods.map((method) => (
                  <PaymentBar
                    key={method}
                    label={formatPaymentMethodLabel(method)}
                    amountCents={paymentMethodTotal(method)}
                    totalCents={balanceCents}
                  />
                ))}
              </div>
            )}
          </header>

          {/* Lista de comandas */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-3 px-5 pb-3 pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  Comandas fechadas
                </h3>
                {cash.comandas.length > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {filteredComandas.length === cash.comandas.length
                      ? cash.comandas.length
                      : `${filteredComandas.length} de ${cash.comandas.length}`}
                  </span>
                )}
              </div>
              {cash.comandas.length > 3 && (
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar cliente ou barbeiro…"
                />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {!isCashOpen && cash.comandas.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Caixa fechado"
                  description="Abra o caixa para finalizar comandas neste dia."
                />
              ) : cash.comandas.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nenhuma comanda ainda"
                  description="Feche comandas na agenda e elas aparecem aqui."
                />
              ) : filteredComandas.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum resultado para &ldquo;{search}&rdquo;.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-xl border">
                  {filteredComandas.map((comanda, index) => {
                    const closedTime = formatClosedTime(comanda.closedAt);
                    const clickable = Boolean(onComandaClick);
                    const paymentLabel = comanda.payments
                      .map((p) => formatPaymentMethodLabel(p.method))
                      .join(" · ");

                    return (
                      <li
                        key={comanda.id}
                        className={cn(index > 0 && "border-t")}
                      >
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() =>
                            handleComandaClick(comanda.appointmentId)
                          }
                          className={cn(
                            "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                            clickable &&
                              "hover:bg-muted/40 active:bg-muted/60"
                          )}
                        >
                          <div
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tracking-wide text-muted-foreground"
                            aria-hidden
                          >
                            {customerInitials(comanda.customerName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate text-sm font-medium leading-snug">
                                {comanda.customerName}
                              </p>
                              <p className="shrink-0 text-sm font-semibold tabular-nums">
                                {formatPriceBRL(comanda.totalCents)}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {comanda.professionalNickname}
                              {closedTime && <> · {closedTime}</>}
                              {paymentLabel && <> · {paymentLabel}</>}
                            </p>
                          </div>
                          {clickable && (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Rodapé de ações */}
          <footer className="shrink-0 space-y-2 border-t bg-background px-5 py-4">
            {isCashOpen ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => setConfirmClose(true)}
              >
                <Lock className="size-4" />
                Encerrar caixa
              </Button>
            ) : cashSession ? (
              <Button
                type="button"
                className="w-full"
                disabled={pending || Boolean(otherDayOpen)}
                onClick={() => startOpenCash("reopen")}
              >
                <RotateCcw className="size-4" />
                Reabrir caixa
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={pending || Boolean(otherDayOpen)}
                onClick={() => startOpenCash("open")}
              >
                <Unlock className="size-4" />
                Abrir caixa do dia
              </Button>
            )}

            <Button variant="ghost" size="sm" className="w-full" asChild>
              <Link
                href={`/admin/financeiro?from=${date}&to=${date}`}
                onClick={() => setOpen(false)}
              >
                Ver métricas do dia
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </footer>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encerrar caixa?</DialogTitle>
            <DialogDescription>
              Depois de encerrar, não será possível finalizar novas comandas
              neste dia até reabrir o caixa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmClose(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void handleCloseCash()}
            >
              Encerrar caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OpenCashRegisterDialog
        key={`${openDialog}-${openMode}`}
        open={openDialog}
        onOpenChange={setOpenDialog}
        serviceDate={date}
        today={today}
        mode={openMode}
        lockServiceDate={openMode === "reopen"}
        responsibleOptions={responsibleOptions}
        defaultResponsibleId={defaultResponsibleId}
        defaultOpeningBalanceCents={cashSession?.openingBalanceCents ?? 0}
        onSuccess={(openedDate) => {
          window.setTimeout(() => {
            if (!mountedRef.current) return;
            if (openedDate !== date) {
              router.push(`/admin?date=${openedDate}`);
            } else {
              refreshSoon();
            }
          }, 0);
        }}
      />
    </>
  );
}
