"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  MessageCircle,
  Pencil,
  Receipt,
  RotateCcw,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminCustomerFields } from "@/components/admin/admin-customer-fields";
import { CancelAppointmentDialog } from "@/components/admin/cancel-appointment-dialog";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  STATUS_LABELS,
} from "@/lib/appointment-status";
import { agendaAppointmentClass } from "@/lib/agenda-colors";
import {
  cancelAppointment,
  cancelAppointmentService,
  updateAppointment,
} from "@/app/admin/(panel)/agenda/actions";
import { getCustomerAgendaSummary } from "@/app/admin/(panel)/agenda/lookup-customer-action";
import {
  loadComandaForAppointment,
  reopenComandaAction,
} from "@/app/admin/(panel)/comandas/actions";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import {
  buildConfirmationWhatsappUrl,
  DEFAULT_CONFIRMATION_WHATSAPP_MESSAGE,
} from "@/lib/confirmation-message";
import { cn } from "@/lib/utils";
import type { ProfessionalPermissions } from "@/lib/professional-permissions";

type AppointmentActionsDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  permissions: ProfessionalPermissions;
  sessionProfessionalId: string | null;
  onOpenComanda: () => void;
  onEditAppointment: () => void;
  /** Índice do serviço do card clicado (quando há vários no mesmo horário). */
  focusedServiceIndex?: number | null;
  /** Modelo da mensagem de confirmação (com tags). */
  confirmationWhatsappMessage?: string;
  /** Quando false, esconde o botão Confirmar no WhatsApp. */
  confirmationWhatsappEnabled?: boolean;
  /** Nome da loja pra tag {{loja}}. */
  shopName?: string;
  /** Remove o card da grade na hora (cancelamento completo). */
  onCancelled?: (appointmentId: string) => void;
  /** Atualiza o card na hora ao cancelar só um serviço. */
  onServiceRemoved?: (appointmentId: string, serviceIndex: number) => void;
};

type SubView = "main" | "cancel" | "changeClient";

function DetailCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function canManageAppointment(
  appointment: AppointmentItem,
  isOwner: boolean,
  sessionProfessionalId: string | null
): boolean {
  if (isOwner) return true;
  return appointment.professionalId === sessionProfessionalId;
}

export function AppointmentActionsDialog({
  appointment,
  open,
  onOpenChange,
  isOwner,
  permissions,
  sessionProfessionalId,
  onOpenComanda,
  onEditAppointment,
  focusedServiceIndex = null,
  confirmationWhatsappMessage = DEFAULT_CONFIRMATION_WHATSAPP_MESSAGE,
  confirmationWhatsappEnabled = true,
  shopName = "",
  onCancelled,
  onServiceRemoved,
}: AppointmentActionsDialogProps) {
  const router = useRouter();
  // Estado reinicia a cada agendamento aberto — ver `key` no componente-pai.
  const [subView, setSubView] = useState<SubView>("main");
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [firstName, setFirstName] = useState(
    () => appointment?.customerFirstName ?? ""
  );
  const [lastName, setLastName] = useState(
    () => appointment?.customerLastName ?? ""
  );
  const [whatsapp, setWhatsapp] = useState(() =>
    appointment ? formatWhatsapp(appointment.customerWhatsapp) : ""
  );
  const [comandaClosed, setComandaClosed] = useState(
    () => appointment?.status === "done"
  );
  const [confirmCreditShortfallCents, setConfirmCreditShortfallCents] = useState<
    number | null
  >(null);
  const [reopenComandaId, setReopenComandaId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(
    () => appointment?.customerId ?? null
  );
  const [creditBalanceCents, setCreditBalanceCents] = useState(0);
  const [customerSummaryLoading, setCustomerSummaryLoading] = useState(false);
  const [customerSummaryKey, setCustomerSummaryKey] = useState<string | null>(
    null
  );

  const nextCustomerSummaryKey =
    open && appointment ? appointment.id : null;

  if (customerSummaryKey !== nextCustomerSummaryKey) {
    setCustomerSummaryKey(nextCustomerSummaryKey);
    if (open && appointment) {
      setCustomerId(appointment.customerId ?? null);
      setCreditBalanceCents(0);
      // Sem WhatsApp não há ficha pra buscar — já libera o loading.
      setCustomerSummaryLoading(Boolean(appointment.customerWhatsapp));
    } else {
      setCustomerSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !appointment?.customerWhatsapp) return;

    let cancelled = false;

    void getCustomerAgendaSummary(appointment.customerWhatsapp).then(
      (result) => {
        if (cancelled) return;
        setCustomerSummaryLoading(false);
        if (!result.ok) {
          if (!appointment.customerId) setCustomerId(null);
          setCreditBalanceCents(0);
          return;
        }
        setCustomerId(result.customerId ?? appointment.customerId ?? null);
        setCreditBalanceCents(result.creditBalanceCents);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [open, appointment]);

  if (!appointment) return null;

  const isActive = (
    ACTIVE_APPOINTMENT_STATUSES as readonly string[]
  ).includes(appointment.status);
  const canManage = canManageAppointment(
    appointment,
    isOwner,
    sessionProfessionalId
  );
  const canCancel =
    isActive && canManage && (isOwner || permissions.canCancelAppointments);
  const canChangeClient = isActive && canManage;
  const canEdit =
    isActive && canManage && (isOwner || permissions.canEditAppointments);
  const canOpenComanda = isOwner || permissions.canOpenComanda;
  const focusedService =
    focusedServiceIndex != null
      ? appointment.services[focusedServiceIndex] ?? null
      : null;
  const cancelOnlyFocusedService =
    Boolean(focusedService) && appointment.services.length > 1;
  const totalPrice = cancelOnlyFocusedService
    ? focusedService!.priceCents
    : appointment.services.reduce(
        (sum, service) => sum + service.priceCents,
        0
      );
  const totalMinutes = cancelOnlyFocusedService
    ? focusedService!.durationMinutes
    : appointment.services.reduce(
        (sum, service) => sum + service.durationMinutes,
        0
      );
  const whatsappLink =
    buildConfirmationWhatsappUrl(
      appointment.customerWhatsapp,
      confirmationWhatsappMessage || DEFAULT_CONFIRMATION_WHATSAPP_MESSAGE,
      {
        customerFirstName: appointment.customerFirstName,
        customerLastName: appointment.customerLastName,
        professionalNickname: appointment.professionalNickname,
        date: appointment.date,
        startTime: appointment.startTime,
        serviceNames: appointment.services.map((service) => service.name),
        shopName,
      }
    ) ?? `https://wa.me/${appointment.customerWhatsapp.replace(/\D/g, "")}`;
  const customerName = `${appointment.customerFirstName} ${appointment.customerLastName}`;
  const serviceNames = cancelOnlyFocusedService
    ? focusedService!.name
    : appointment.services.map((service) => service.name).join(" · ");
  const cancelSuccessMessage = cancelOnlyFocusedService
    ? "Serviço cancelado."
    : "Agendamento cancelado.";

  async function handleCancel() {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }

    setBusy(true);
    const result =
      cancelOnlyFocusedService && focusedServiceIndex != null
        ? await cancelAppointmentService({
            appointmentId: appointment!.id,
            serviceIndex: focusedServiceIndex,
            reason,
          })
        : await cancelAppointment({
            appointmentId: appointment!.id,
            reason,
          });
    setBusy(false);

    if (result.ok) {
      toast.success(cancelSuccessMessage);
      onOpenChange(false);
      if (cancelOnlyFocusedService && focusedServiceIndex != null) {
        onServiceRemoved?.(appointment!.id, focusedServiceIndex);
      } else {
        onCancelled?.(appointment!.id);
      }
    } else {
      toast.error(result.error);
    }
  }

  async function handleReopenComanda(confirmCreditShortfall = false) {
    setBusy(true);
    try {
      let comandaId = reopenComandaId;
      if (!comandaId) {
        const loaded = await loadComandaForAppointment(appointment!.id);
        if (!loaded.ok) {
          toast.error(loaded.error);
          return;
        }
        comandaId = loaded.comanda.id;
        setReopenComandaId(comandaId);
      }

      const result = await reopenComandaAction(comandaId, {
        confirmCreditShortfall,
      });
      if (result.ok) {
        setConfirmCreditShortfallCents(null);
        setReopenComandaId(null);
        toast.success("Comanda reaberta.");
        setComandaClosed(false);
        onOpenChange(false);
        router.refresh();
      } else if (
        result.code === "credit_shortfall" &&
        result.shortfallCents != null &&
        !confirmCreditShortfall
      ) {
        setConfirmCreditShortfallCents(result.shortfallCents);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(
        "Não foi possível reabrir a comanda. Verifique a internet e tente de novo."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeClient(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !whatsapp.replace(/\D/g, "")) {
      toast.error("Preencha os dados do cliente.");
      return;
    }

    setBusy(true);
    const result = await updateAppointment({
      appointmentId: appointment!.id,
      professionalId: appointment!.professionalId,
      date: appointment!.date,
      startTime: appointment!.startTime,
      serviceIds: appointment!.services.map((service) => service.id),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsapp: whatsapp.replace(/\D/g, ""),
    });
    setBusy(false);

    if (result.ok) {
      toast.success("Cliente atualizado.");
      setSubView("main");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Dialog open={open && subView === "main"} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog flex max-h-[min(92dvh,700px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-lg"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOpenChange(false)}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>

          <DialogHeader className="booking-header shrink-0 gap-1 border-b px-4 pb-3 pt-5 pr-14 sm:pl-6 sm:pr-14 sm:pt-6">
            <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
              O que deseja fazer?
            </DialogTitle>
            <DialogDescription>
              {formatDateBR(appointment.date)} ·{" "}
              {formatTime(appointment.startTime)} –{" "}
              {formatTime(appointment.endTime)}
              {appointment.isComandaExtra
                ? " · serviço extra"
                : appointment.isSqueezeIn
                  ? " · encaixe"
                  : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="booking-context space-y-3 rounded-xl px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="truncate text-base font-medium">{customerName}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {appointment.customerWhatsapp
                      ? formatWhatsapp(appointment.customerWhatsapp)
                      : "Sem cadastro"}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "mt-0.5 shrink-0",
                    agendaAppointmentClass({
                      status: appointment.status,
                      isSqueezeIn: appointment.isSqueezeIn,
                      isComandaExtra: appointment.isComandaExtra,
                    })
                  )}
                >
                  {STATUS_LABELS[appointment.status]}
                </Badge>
              </div>

              {!customerSummaryLoading && creditBalanceCents > 0 ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-[rgb(236_241_94_/_28%)] bg-[rgb(236_241_94_/_8%)] px-3 py-2 text-sm">
                  <Wallet className="size-4 shrink-0 text-[var(--booking-accent,#ecf15e)]" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Crédito disponível
                    </p>
                    <p className="font-semibold tabular-nums text-[var(--booking-accent,#ecf15e)]">
                      {formatPriceBRL(creditBalanceCents)}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {confirmationWhatsappEnabled && appointment.customerWhatsapp ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="booking-btn-ghost h-8"
                    asChild
                  >
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-3.5" />
                      Confirmar no WhatsApp
                    </a>
                  </Button>
                ) : null}
                {customerId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="booking-btn-ghost h-8"
                    asChild
                  >
                    <Link href={`/admin/clientes/${customerId}`}>
                      <UserRound className="size-3.5" />
                      Ver cliente
                    </Link>
                  </Button>
                ) : null}
                {canChangeClient && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="booking-btn-ghost h-8"
                    onClick={() => setSubView("changeClient")}
                  >
                    <UserRound className="size-3.5" />
                    Trocar cliente
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
              <DetailCell label="Barbeiro">
                <p className="truncate font-medium">
                  {appointment.professionalNickname}
                </p>
              </DetailCell>
              <DetailCell label="Duração">
                <p>{formatDuration(totalMinutes)}</p>
              </DetailCell>
              <DetailCell label="Serviços" className="col-span-2">
                {cancelOnlyFocusedService ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 leading-snug">{serviceNames}</p>
                    <p className="shrink-0 font-medium tabular-nums">
                      {formatPriceBRL(totalPrice)}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {appointment.services.map((service, index) => (
                      <li
                        key={`${service.id}-${index}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0 leading-snug">
                          {service.name}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {formatDuration(service.durationMinutes)}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatPriceBRL(service.priceCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailCell>
              <DetailCell label="Valor total" className="col-span-2">
                <p className="text-base font-semibold tabular-nums">
                  {formatPriceBRL(totalPrice)}
                </p>
              </DetailCell>
            </div>
          </div>

          <div className="booking-footer shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
            <div className="flex flex-wrap gap-2">
              {canOpenComanda && (
                <Button
                  type="button"
                  size="sm"
                  className="booking-btn-primary h-9 flex-1 sm:flex-none"
                  disabled={busy}
                  onClick={() => {
                    onOpenChange(false);
                    onOpenComanda();
                  }}
                >
                  <Receipt className="size-4" />
                  {comandaClosed
                    ? "Ver comanda"
                    : isActive
                      ? "Abrir comanda"
                      : "Ver comanda"}
                </Button>
              )}

              {isOwner && comandaClosed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="booking-btn-ghost h-9"
                  disabled={busy}
                  onClick={() => void handleReopenComanda()}
                >
                  <RotateCcw className="size-4" />
                  Reabrir comanda
                </Button>
              )}

              {canEdit && isActive && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="booking-btn-ghost h-9"
                  onClick={() => {
                    onOpenChange(false);
                    onEditAppointment();
                  }}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
              )}

              {canCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="booking-btn-danger h-9"
                  onClick={() => setSubView("cancel")}
                >
                  <X className="size-4" />
                  {cancelOnlyFocusedService
                    ? "Cancelar este serviço"
                    : "Cancelar"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CancelAppointmentDialog
        open={open && subView === "cancel"}
        onOpenChange={(next) => {
          if (!next) setSubView("main");
        }}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={() => void handleCancel()}
        busy={busy}
        customerName={customerName}
        professionalNickname={appointment.professionalNickname}
        startTime={appointment.startTime}
        endTime={appointment.endTime}
        serviceLabel={serviceNames}
        dateLabel={formatDateBR(appointment.date)}
        detailNote={
          cancelOnlyFocusedService
            ? "Só este serviço será removido. Os outros do mesmo horário continuam."
            : null
        }
        kind={
          cancelOnlyFocusedService
            ? "service"
            : appointment.isComandaExtra
              ? "extra"
              : appointment.isSqueezeIn
                ? "squeeze"
                : "normal"
        }
      />

      <Dialog
        open={open && subView === "changeClient"}
        onOpenChange={(next) => {
          if (!next) setSubView("main");
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog flex max-h-[min(92dvh,700px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setSubView("main")}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
          <DialogHeader className="booking-header shrink-0 gap-1 border-b px-4 pb-3 pt-5 pr-14 sm:pl-6 sm:pr-14 sm:pt-6">
            <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
              Trocar cliente
            </DialogTitle>
            <DialogDescription>
              Busque um cadastro ou registre alguém novo neste horário.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleChangeClient}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <AdminCustomerFields
                firstName={firstName}
                lastName={lastName}
                whatsapp={whatsapp}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onWhatsappChange={setWhatsapp}
                enabled={open && subView === "changeClient"}
                idPrefix="changeClient"
                hint="O cliente atual fica selecionado. Use Buscar outro para trocar."
              />
            </div>
            <div className="booking-footer flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:py-4">
              <Button
                type="button"
                variant="outline"
                className="booking-btn-ghost"
                onClick={() => setSubView("main")}
                disabled={busy}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                className="booking-btn-primary"
                disabled={busy}
              >
                {busy ? "Salvando..." : "Confirmar cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCreditShortfallCents !== null}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen && !busy) {
            setConfirmCreditShortfallCents(null);
            setReopenComandaId(null);
          }
        }}
      >
        <DialogContent className="admin-booking-dialog rounded-2xl ring-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="booking-display text-[#f5f5f5]">
              Crédito já foi usado
            </DialogTitle>
            <DialogDescription>
              Esta comanda gerou crédito e o cliente já usou{" "}
              <strong className="text-[#f5f5f5]">
                {formatPriceBRL(confirmCreditShortfallCents ?? 0)}
              </strong>{" "}
              em outro atendimento. Esse valor gasto não volta. Já o crédito
              usado como pagamento nesta comanda volta para o cliente. Continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="booking-btn-ghost"
              disabled={busy}
              onClick={() => {
                setConfirmCreditShortfallCents(null);
                setReopenComandaId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="booking-btn-primary"
              disabled={busy}
              onClick={() => void handleReopenComanda(true)}
            >
              Reabrir mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
