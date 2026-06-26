"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SearchInput } from "@/components/admin/search-input";
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
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/comanda-types";
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
    <div className="rounded-lg border bg-background px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function PaymentChip({ method }: { method: PaymentMethod }) {
  return (
    <span className="inline-flex rounded-md border bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {formatPaymentMethodLabel(method)}
    </span>
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

  const isCashOpen = cashSession?.status === "open";
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
    () => PAYMENT_METHODS.filter((method) => cash.byPaymentMethod[method] > 0),
    [cash.byPaymentMethod]
  );

  const cashInDrawer = cash.byPaymentMethod.cash;

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  function startOpenCash(mode: "open" | "reopen") {
    setOpenMode(mode);
    setOpenDialog(true);
  }

  async function handleCloseCash() {
    const result = await closeCashRegisterAction(date);
    if (result.ok) {
      toast.success("Caixa encerrado.");
      setConfirmClose(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
  }

  function handleComandaClick(appointmentId: string) {
    onComandaClick?.(appointmentId);
    setOpen(false);
  }

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group fixed right-0 top-[42%] z-40 flex -translate-y-1/2 flex-col items-center gap-2",
            "rounded-l-lg border border-r-0 bg-background px-2 py-3 shadow-md",
            "transition-colors hover:bg-muted/40"
          )}
          aria-label="Abrir caixa do dia"
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isCashOpen ? "bg-emerald-500" : "bg-muted-foreground/40"
            )}
            aria-hidden
          />
          <span
            className="text-[11px] font-semibold tracking-widest text-foreground"
            style={{ writingMode: "vertical-rl" }}
          >
            CAIXA
          </span>
          {cash.totalCents > 0 && (
            <span
              className="text-[10px] font-medium tabular-nums text-muted-foreground"
              style={{ writingMode: "vertical-rl" }}
            >
              {formatPriceBRL(cash.totalCents)}
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

          {/* Cabeçalho */}
          <header className="shrink-0 border-b bg-muted/20 px-4 pb-4 pt-4 pr-12">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                <Wallet className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">Caixa do dia</h2>
                  <Badge
                    variant={isCashOpen ? "default" : "secondary"}
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {isCashOpen ? "Aberto" : "Fechado"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
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
                className="shrink-0"
                disabled={pending}
                onClick={handleRefresh}
                aria-label="Atualizar caixa"
              >
                <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              </Button>
            </div>

            {otherDayOpen && (
              <p className="mt-3 rounded-lg border border-dashed bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
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

            <div className="mt-4">
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
            </div>
          </header>

          {/* Métricas */}
          <div className="grid shrink-0 grid-cols-3 gap-2 border-b px-4 py-3">
            <MetricCard
              label="Entradas"
              value={formatPriceBRL(cash.totalCents)}
              hint={
                cash.comandaCount > 0
                  ? `${cash.comandaCount} comanda${cash.comandaCount === 1 ? "" : "s"}`
                  : "Nenhuma ainda"
              }
            />
            <MetricCard
              label="Dinheiro"
              value={formatPriceBRL(cashInDrawer)}
              hint={
                cashSession
                  ? `Inicial ${formatPriceBRL(cashSession.openingBalanceCents)}`
                  : undefined
              }
            />
            <MetricCard
              label="Comissões"
              value={formatPriceBRL(cash.commissionCents)}
              hint={`Barbearia ${formatPriceBRL(cash.shopCents)}`}
            />
          </div>

          {/* Lista de comandas */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-3 px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Comandas fechadas</h3>
                {cash.comandas.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {filteredComandas.length} de {cash.comandas.length}
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {!isCashOpen && cash.comandas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/30">
                    <Wallet className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Caixa fechado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Abra o caixa para finalizar comandas neste dia.
                    </p>
                  </div>
                </div>
              ) : cash.comandas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/30">
                    <Wallet className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nenhuma comanda ainda</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Feche comandas na agenda e elas aparecem aqui.
                    </p>
                  </div>
                </div>
              ) : filteredComandas.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para &ldquo;{search}&rdquo;.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filteredComandas.map((comanda) => {
                    const closedTime = formatClosedTime(comanda.closedAt);
                    const clickable = Boolean(onComandaClick);

                    return (
                      <li key={comanda.id}>
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() =>
                            handleComandaClick(comanda.appointmentId)
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors",
                            clickable && "hover:bg-muted/40 active:bg-muted/60"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate font-medium leading-snug">
                                {comanda.customerName}
                              </p>
                              <p className="shrink-0 text-sm font-semibold tabular-nums">
                                {formatPriceBRL(comanda.totalCents)}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {comanda.professionalNickname}
                              {closedTime && <> · {closedTime}</>}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {comanda.payments.map((p, i) => (
                                <PaymentChip key={`${comanda.id}-${i}`} method={p.method} />
                              ))}
                            </div>
                          </div>
                          {clickable && (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Rodapé */}
          <footer className="shrink-0 border-t bg-background px-4 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Saldo do dia
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {formatPriceBRL(cash.totalCents)}
                </p>
              </div>
              {activePaymentMethods.length > 0 && (
                <ul className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                  {activePaymentMethods.map((method) => (
                    <li key={method} className="tabular-nums">
                      {formatPaymentMethodLabel(method)}{" "}
                      <span className="font-medium text-foreground">
                        {formatPriceBRL(cash.byPaymentMethod[method])}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator className="my-3" />

            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/admin/financeiro?date=${date}`}>
                Ver financeiro completo
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
          if (openedDate !== date) {
            router.push(`/admin?date=${openedDate}`);
          } else {
            startTransition(() => router.refresh());
          }
        }}
      />
    </>
  );
}
