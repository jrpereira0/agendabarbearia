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
  Trash2,
  Wallet,
  type LucideIcon,
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
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { SearchInput } from "@/components/admin/search-input";
import { ComandaDialog } from "@/components/admin/comanda-dialog";
import {
  OpenCashRegisterDialog,
  type CashRegisterResponsibleOption,
} from "@/components/admin/open-cash-register-dialog";
import { closeCashRegisterAction } from "@/app/admin/(panel)/financeiro/actions";
import {
  deleteOpenWalkInComandaAction,
  loadAppointmentItemAction,
} from "@/app/admin/(panel)/comandas/actions";
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
import type { AppointmentItem } from "@/components/admin/appointment-item";
import type { ServiceOption } from "@/components/admin/new-appointment-dialog";
import type { ProductOption } from "@/lib/product-types";
import { formatDateBR, formatPriceBRL, formatTime } from "@/lib/format";
import { matchesSearch } from "@/lib/text";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type ComandaProfessionalOption = {
  id: string;
  nickname: string;
  photoUrl: string | null;
  photoPosition?: string | null;
  serviceIds: string[];
  commissionPercent: number;
};

type CashRegisterDetailViewProps = {
  date: string;
  today: string;
  backHref: string;
  cash: CashRegisterSummary;
  cashSession: CashRegisterSession | null;
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
  servicesCatalog: ServiceOption[];
  productsCatalog: ProductOption[];
  professionals: ComandaProfessionalOption[];
  isOwner?: boolean;
  initialCashRegisterOpen?: boolean;
  initialOpenCashRegisterDate?: string | null;
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

const EMPTY_APPOINTMENTS: AppointmentItem[] = [];

export function CashRegisterDetailView({
  date,
  today,
  backHref,
  cash,
  cashSession,
  openCashRegister,
  responsibleOptions,
  servicesCatalog,
  productsCatalog,
  professionals,
  isOwner = true,
  initialCashRegisterOpen = false,
  initialOpenCashRegisterDate = null,
}: CashRegisterDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mountedRef = useRef(true);
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [openMode, setOpenMode] = useState<"open" | "reopen">("open");
  const [confirmClose, setConfirmClose] = useState(false);
  const [deleteWalkInId, setDeleteWalkInId] = useState<string | null>(null);
  const [deletingWalkIn, setDeletingWalkIn] = useState(false);
  const [comandaOpen, setComandaOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentItem | null>(null);
  const [walkInComandaId, setWalkInComandaId] = useState<string | null>(null);
  const [openingComandaId, setOpeningComandaId] = useState<string | null>(null);

  const dialogAppointments = useMemo(
    () => (selectedAppointment ? [selectedAppointment] : EMPTY_APPOINTMENTS),
    [selectedAppointment]
  );

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

  async function handleDeleteWalkIn() {
    if (!deleteWalkInId || deletingWalkIn) return;
    setDeletingWalkIn(true);
    try {
      const result = await deleteOpenWalkInComandaAction(deleteWalkInId);
      if (!mountedRef.current) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Venda rápida excluída.");
      setDeleteWalkInId(null);
      window.setTimeout(() => refreshSoon(), 0);
    } catch {
      if (mountedRef.current) {
        toast.error("Não foi possível excluir a venda rápida.");
      }
    } finally {
      if (mountedRef.current) setDeletingWalkIn(false);
    }
  }

  async function openComanda(
    appointmentId: string | null,
    comandaId: string
  ) {
    setOpeningComandaId(comandaId);
    if (!appointmentId) {
      setSelectedAppointment(null);
      setWalkInComandaId(comandaId);
      setOpeningComandaId(null);
      setComandaOpen(true);
      return;
    }
    const result = await loadAppointmentItemAction(appointmentId);
    if (!mountedRef.current) return;
    setOpeningComandaId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setWalkInComandaId(null);
    setSelectedAppointment(result.appointment);
    setComandaOpen(true);
  }

  const statusLabel = !cashSession
    ? "Sem sessão"
    : isCashOpen
      ? "Aberto"
      : "Fechado";

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
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={ADMIN_SURFACE.btnGhost}
                  disabled={pending || cash.openComandas.length > 0}
                  onClick={() => setConfirmClose(true)}
                >
                  <Lock className="size-4" />
                  Fechar caixa
                </Button>
                {cash.openComandas.length > 0 ? (
                  <p className={cn("max-w-[16rem] text-right text-[11px]", ADMIN_SURFACE.accent)}>
                    Finalize as comandas em aberto antes de encerrar.
                  </p>
                ) : null}
              </div>
            ) : cashSession ? (
              <Button
                type="button"
                size="sm"
                className={ADMIN_SURFACE.btnPrimary}
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
                className={ADMIN_SURFACE.btnPrimary}
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

        {otherDayOpen ? (
          <div
            className={cn(
              ADMIN_SURFACE.panel,
              "border-dashed px-4 py-3 text-sm",
              ADMIN_SURFACE.muted
            )}
          >
            Já existe um caixa aberto em{" "}
            <Link
              href={`/admin/financeiro/caixas/${otherDayOpen.serviceDate}`}
              className={cn(
                "font-medium underline-offset-4 hover:underline",
                ADMIN_SURFACE.accent
              )}
            >
              {formatDateBR(otherDayOpen.serviceDate)}
            </Link>
            . Feche-o antes de abrir este dia.
          </div>
        ) : null}

        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    isCashOpen ? "bg-emerald-400" : "bg-white/25"
                  )}
                  aria-hidden
                />
                <p className={ADMIN_SURFACE.sectionLabel}>Total do dia</p>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
                  ADMIN_SURFACE.accent
                )}
              >
                {formatPriceBRL(cash.cashInflowCents)}
              </p>
              <p className={cn("mt-1 text-xs sm:text-sm", ADMIN_SURFACE.muted)}>
                {cash.comandaCount} comanda
                {cash.comandaCount === 1 ? "" : "s"}
                {cash.creditDepositsCents > 0
                  ? ` · ${formatPriceBRL(cash.creditDepositsCents)} em créditos`
                  : ""}
              </p>
            </div>
          </div>

          {activePaymentMethods.length > 0 ? (
            <ul className="divide-y divide-white/10 border-t border-white/10">
              {activePaymentMethods.map((method) => {
                const Icon = PAYMENT_ICONS[method];
                return (
                  <li
                    key={method}
                    className="flex items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3"
                  >
                    <Icon
                      className={cn(
                        "hidden size-4 shrink-0 sm:block",
                        ADMIN_SURFACE.muted
                      )}
                    />
                    <span className="min-w-0 flex-1 text-sm text-[#f5f5f5]">
                      {formatPaymentMethodLabel(method)}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums sm:text-base",
                        ADMIN_SURFACE.accent
                      )}
                    >
                      {formatPriceBRL(paymentMethodTotal(cash, method))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : cash.comandaCount === 0 ? (
            <p
              className={cn(
                "border-t border-white/10 px-4 py-4 text-center text-sm sm:px-5",
                ADMIN_SURFACE.muted
              )}
            >
              Nenhuma entrada ainda neste dia.
            </p>
          ) : null}
        </div>

        {cash.openComandas.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <p className={ADMIN_SURFACE.sectionLabel}>Em aberto</p>
              <span className={cn("text-xs", ADMIN_SURFACE.accent)}>
                {cash.openComandas.length}
              </span>
            </div>
            <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
              <ul className="divide-y divide-white/10">
                {cash.openComandas.map((row) => (
                  <li key={row.id}>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        disabled={openingComandaId === row.id}
                        onClick={() =>
                          void openComanda(row.appointmentId, row.id)
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-60 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                            {row.customerName}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 truncate text-xs",
                              ADMIN_SURFACE.muted
                            )}
                          >
                            {row.itemPreview} ·{" "}
                            <span className={ADMIN_SURFACE.accent}>
                              Toque para finalizar
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            ADMIN_SURFACE.accent
                          )}
                        >
                          {formatPriceBRL(row.totalCents)}
                        </span>
                        <ChevronRight
                          className={cn("size-4 shrink-0", ADMIN_SURFACE.muted)}
                          aria-hidden
                        />
                      </button>
                      {row.isWalkIn ? (
                        <button
                          type="button"
                          aria-label="Excluir venda rápida"
                          onClick={() => setDeleteWalkInId(row.id)}
                          className="flex shrink-0 items-center border-l border-white/10 px-3.5 text-[#f87171] transition-colors hover:bg-white/[0.03]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline gap-2">
              <p className={ADMIN_SURFACE.sectionLabel}>Comandas fechadas</p>
              {cash.comandas.length > 0 ? (
                <span className={cn("text-xs", ADMIN_SURFACE.muted)}>
                  {filteredComandas.length}
                  {search.trim() ? ` de ${cash.comandas.length}` : ""}
                </span>
              ) : null}
            </div>
            {cash.comandas.length > 3 ? (
              <div className="w-full sm:max-w-xs">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar cliente ou barbeiro…"
                  inputClassName={ADMIN_SURFACE.input}
                />
              </div>
            ) : null}
          </div>

          {!cashSession &&
          cash.comandas.length === 0 &&
          cash.openComandas.length === 0 ? (
            <EmptyState
              icon={Wallet}
              className="border-white/10 text-[#f5f5f5]"
              title="Sem caixa neste dia"
              description="Abra o caixa para registrar o movimento do dia."
              action={
                <Button
                  type="button"
                  size="sm"
                  className={ADMIN_SURFACE.btnPrimary}
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
              className="border-white/10 text-[#f5f5f5]"
              title="Nenhuma comanda fechada ainda"
              description={
                cash.openComandas.length > 0
                  ? "Finalize as comandas em aberto acima para entrar no caixa."
                  : "Feche comandas na agenda e elas aparecem aqui."
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className={ADMIN_SURFACE.btnGhost}
                  asChild
                >
                  <Link href={`/admin?date=${date}`}>Abrir agenda</Link>
                </Button>
              }
            />
          ) : filteredComandas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-[#8b8d93]">
              Nenhum resultado para &ldquo;{search}&rdquo;.
            </div>
          ) : (
            <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden")}>
              <ul className="divide-y divide-white/10">
                {filteredComandas.map((comanda) => {
                  const closedTime = formatClosedTime(comanda.closedAt);
                  const paymentSummary =
                    comanda.payments.length === 0
                      ? null
                      : comanda.payments.length === 1
                        ? formatPaymentMethodLabel(comanda.payments[0]!.method)
                        : `${comanda.payments.length} formas`;

                  const meta = [
                    comanda.professionalNickname,
                    closedTime || null,
                    paymentSummary,
                    comanda.creditDepositCents > 0
                      ? `${formatPriceBRL(comanda.creditDepositCents)} em crédito`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <li key={comanda.id}>
                      <button
                        type="button"
                        disabled={openingComandaId === comanda.id}
                        onClick={() =>
                          void openComanda(comanda.appointmentId, comanda.id)
                        }
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-60 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                            {comanda.customerName}
                          </p>
                          {meta ? (
                            <p
                              className={cn(
                                "mt-0.5 truncate text-xs",
                                ADMIN_SURFACE.muted
                              )}
                            >
                              {meta}
                            </p>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums sm:text-base",
                            ADMIN_SURFACE.accent
                          )}
                        >
                          {formatPriceBRL(comanda.paidCents)}
                        </p>
                        <ChevronRight
                          className={cn("size-4 shrink-0", ADMIN_SURFACE.muted)}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
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
          tone="dark"
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

        <ComandaDialog
          appointment={selectedAppointment}
          initialComandaId={walkInComandaId}
          open={comandaOpen}
          onOpenChange={(open) => {
            setComandaOpen(open);
            if (!open) {
              setSelectedAppointment(null);
              setWalkInComandaId(null);
              window.setTimeout(() => refreshSoon(), 0);
            }
          }}
          servicesCatalog={servicesCatalog}
          productsCatalog={productsCatalog}
          professionals={professionals}
          appointments={dialogAppointments}
          isOwnerHint={isOwner}
          initialCashRegisterOpen={initialCashRegisterOpen}
          initialOpenCashRegisterDate={initialOpenCashRegisterDate}
        />

        <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
          <DialogContent className="max-w-sm border-white/10 bg-[#151618] text-[#f5f5f5]">
            <DialogHeader>
              <DialogTitle className="text-[#f5f5f5]">
                Encerrar caixa?
              </DialogTitle>
              <DialogDescription className={ADMIN_SURFACE.muted}>
                Depois de encerrar, não será possível finalizar novas comandas
                neste dia até reabrir o caixa.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className={ADMIN_SURFACE.btnGhost}
                onClick={() => setConfirmClose(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className={ADMIN_SURFACE.btnPrimary}
                disabled={pending}
                onClick={() => void handleCloseCash()}
              >
                Encerrar caixa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={deleteWalkInId !== null}
          onOpenChange={(next) => {
            if (!next && !deletingWalkIn) setDeleteWalkInId(null);
          }}
        >
          <DialogContent className="max-w-sm border-white/10 bg-[#151618] text-[#f5f5f5]">
            <DialogHeader>
              <DialogTitle className="text-[#f5f5f5]">
                Excluir venda rápida?
              </DialogTitle>
              <DialogDescription className={ADMIN_SURFACE.muted}>
                Os produtos desta comanda serão removidos. Isso não dá para
                desfazer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className={ADMIN_SURFACE.btnGhost}
                disabled={deletingWalkIn}
                onClick={() => setDeleteWalkInId(null)}
              >
                Manter
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingWalkIn}
                onClick={() => void handleDeleteWalkIn()}
              >
                {deletingWalkIn ? "Excluindo…" : "Excluir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
