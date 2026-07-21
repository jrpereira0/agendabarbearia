"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Lock,
  QrCode,
  RotateCcw,
  Wallet,
  type LucideIcon,
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
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
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
import {
  CASH_INFLOW_PAYMENT_METHODS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL, formatTime } from "@/lib/format";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

type CashRegisterDetailViewProps = {
  date: string;
  today: string;
  backHref: string;
  cash: CashRegisterSummary;
  cashSession: CashRegisterSession | null;
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
};

const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  pix: QrCode,
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  store_credit: Wallet,
};

function formatClosedTime(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return "";
  return formatTime(`${match[1]}:${match[2]}:00`);
}

function paymentMethodTotal(
  cash: CashRegisterSummary,
  method: PaymentMethod
): number {
  if (method === "store_credit") return cash.byPaymentMethod.store_credit;
  const inflowMethod = method as (typeof CASH_INFLOW_PAYMENT_METHODS)[number];
  return (
    cash.byPaymentMethod[inflowMethod] +
    cash.creditDepositsByMethod[inflowMethod]
  );
}

export function CashRegisterDetailView({
  date,
  today,
  backHref,
  cash,
  cashSession,
  openCashRegister,
  responsibleOptions,
}: CashRegisterDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mountedRef = useRef(true);
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [openMode, setOpenMode] = useState<"open" | "reopen">("open");
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const activePaymentMethods = useMemo(() => {
    return PAYMENT_METHODS.filter(
      (method) => paymentMethodTotal(cash, method) > 0
    ).sort(
      (a, b) => paymentMethodTotal(cash, b) - paymentMethodTotal(cash, a)
    );
  }, [cash]);

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

  const statusLabel = !cashSession
    ? "Sem sessão"
    : isCashOpen
      ? "Aberto"
      : "Fechado";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={formatDateBR(date)}
        description={
          cashSession?.responsibleName
            ? `${statusLabel} · ${cashSession.responsibleName}`
            : statusLabel
        }
        backHref={backHref}
        backLabel="Voltar aos caixas"
        action={
          isCashOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmClose(true)}
            >
              <Lock className="size-4" />
              Fechar caixa
            </Button>
          ) : cashSession ? (
            <Button
              type="button"
              size="sm"
              disabled={pending || Boolean(otherDayOpen)}
              onClick={() => {
                setOpenMode("reopen");
                setOpenDialog(true);
              }}
            >
              <RotateCcw className="size-4" />
              Reabrir
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={pending || Boolean(otherDayOpen)}
              onClick={() => {
                setOpenMode("open");
                setOpenDialog(true);
              }}
            >
              Abrir caixa
            </Button>
          )
        }
      />

      {otherDayOpen && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Já existe um caixa aberto em{" "}
          <Link
            href={`/admin/financeiro/caixas/${otherDayOpen.serviceDate}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {formatDateBR(otherDayOpen.serviceDate)}
          </Link>
          . Feche-o antes de abrir este dia.
        </div>
      )}

      {/* 1. Total do dia */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-6">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  isCashOpen ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">Total do dia</p>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
              {formatPriceBRL(cash.cashInflowCents)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground sm:text-right">
            {cash.comandaCount} comanda
            {cash.comandaCount === 1 ? "" : "s"}
            {cash.creditDepositsCents > 0 && (
              <>
                <br className="hidden sm:block" />
                <span className="sm:hidden"> · </span>
                {formatPriceBRL(cash.creditDepositsCents)} em créditos
              </>
            )}
          </p>
        </div>
      </Card>

      {/* 2. Meios de pagamento */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-medium tracking-tight">
            Meios de pagamento
          </h2>
          {activePaymentMethods.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {activePaymentMethods.length} forma
              {activePaymentMethods.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {activePaymentMethods.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma entrada ainda neste dia.
          </div>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {activePaymentMethods.map((method) => {
                const Icon = PAYMENT_ICONS[method];
                return (
                  <li
                    key={method}
                    className="flex items-center gap-3 px-4 py-4 sm:px-5"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {formatPaymentMethodLabel(method)}
                    </span>
                    <span className="text-lg font-semibold tabular-nums tracking-tight">
                      {formatPriceBRL(paymentMethodTotal(cash, method))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* 3. Comandas */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-medium tracking-tight">Comandas</h2>
            {cash.comandas.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredComandas.length}
                {search.trim() ? ` de ${cash.comandas.length}` : ""}
              </span>
            )}
          </div>
          {cash.comandas.length > 3 && (
            <div className="w-full sm:max-w-xs">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar cliente ou barbeiro…"
              />
            </div>
          )}
        </div>

        {!cashSession && cash.comandas.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sem caixa neste dia"
            description="Abra o caixa para registrar o movimento do dia."
            action={
              <Button
                type="button"
                size="sm"
                disabled={pending || Boolean(otherDayOpen)}
                onClick={() => {
                  setOpenMode("open");
                  setOpenDialog(true);
                }}
              >
                Abrir caixa
              </Button>
            }
          />
        ) : cash.comandas.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhuma comanda ainda"
            description="Feche comandas na agenda e elas aparecem aqui."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin?date=${date}`}>Abrir agenda</Link>
              </Button>
            }
          />
        ) : filteredComandas.length === 0 ? (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Nenhum resultado para &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {filteredComandas.map((comanda) => {
                const closedTime = formatClosedTime(comanda.closedAt);
                return (
                  <li key={comanda.id}>
                    <Link
                      href={`/admin?date=${date}`}
                      className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium leading-snug">
                              {comanda.customerName}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {comanda.professionalNickname}
                              {closedTime && <> · {closedTime}</>}
                            </p>
                          </div>
                          <p className="shrink-0 text-base font-semibold tabular-nums tracking-tight">
                            {formatPriceBRL(comanda.totalCents)}
                          </p>
                        </div>
                        {comanda.payments.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {comanda.payments.map((p, i) => (
                              <span
                                key={`${comanda.id}-${i}`}
                                className="inline-flex items-center rounded-md border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {formatPaymentMethodLabel(p.method)}{" "}
                                <span className="ml-1 font-medium tabular-nums text-foreground">
                                  {formatPriceBRL(p.amountCents)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

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
              router.push(`/admin/financeiro/caixas/${openedDate}`);
            } else {
              refreshSoon();
            }
          }, 0);
        }}
      />

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
    </div>
  );
}
