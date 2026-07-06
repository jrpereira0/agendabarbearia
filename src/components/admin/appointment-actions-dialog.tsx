"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageCircle,
  Pencil,
  Receipt,
  RotateCcw,
  Scissors,
  UserRound,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminCustomerFields } from "@/components/admin/admin-customer-fields";
import { DialogSection } from "@/components/admin/dialog-section";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  STATUS_LABELS,
} from "@/lib/appointment-status";
import { agendaAppointmentClass } from "@/lib/agenda-colors";
import {
  cancelAppointment,
  updateAppointment,
} from "@/app/admin/(panel)/agenda/actions";
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
import { cn } from "@/lib/utils";

type AppointmentActionsDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  sessionProfessionalId: string | null;
  onOpenComanda: () => void;
  onEditAppointment: () => void;
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
  sessionProfessionalId,
  onOpenComanda,
  onEditAppointment,
}: AppointmentActionsDialogProps) {
  const router = useRouter();
  const [subView, setSubView] = useState<SubView>("main");
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [comandaClosed, setComandaClosed] = useState(false);

  useEffect(() => {
    if (!open || !appointment) return;
    setSubView("main");
    setBusy(false);
    setCancelReason("");
    setFirstName(appointment.customerFirstName);
    setLastName(appointment.customerLastName);
    setWhatsapp(formatWhatsapp(appointment.customerWhatsapp));
    setComandaClosed(appointment.status === "done");
  }, [open, appointment?.id, appointment?.status, appointment]);

  if (!appointment) return null;

  const isActive = (
    ACTIVE_APPOINTMENT_STATUSES as readonly string[]
  ).includes(appointment.status);
  const canManage = canManageAppointment(
    appointment,
    isOwner,
    sessionProfessionalId
  );
  const canCancel = isActive && canManage;
  const canChangeClient = isActive && canManage;
  const canEdit = canManage;
  const totalPrice = appointment.services.reduce(
    (sum, service) => sum + service.priceCents,
    0
  );
  const totalMinutes = appointment.services.reduce(
    (sum, service) => sum + service.durationMinutes,
    0
  );
  const whatsappLink = `https://wa.me/55${appointment.customerWhatsapp}`;
  const customerName = `${appointment.customerFirstName} ${appointment.customerLastName}`;
  const serviceNames = appointment.services
    .map((service) => service.name)
    .join(" · ");

  async function handleCancel() {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }

    setBusy(true);
    const result = await cancelAppointment({
      appointmentId: appointment!.id,
      reason,
    });
    setBusy(false);

    if (result.ok) {
      toast.success("Agendamento cancelado.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleReopenComanda() {
    setBusy(true);
    const loaded = await loadComandaForAppointment(appointment!.id);
    if (!loaded.ok) {
      toast.error(loaded.error);
      setBusy(false);
      return;
    }

    const result = await reopenComandaAction(loaded.comanda.id);
    setBusy(false);

    if (result.ok) {
      toast.success("Comanda reaberta.");
      setComandaClosed(false);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleChangeClient(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !whatsapp.replace(/\D/g, "")) {
      toast.error("Preencha os dados do cliente.");
      return;
    }

    setBusy(true);
    const result = await updateAppointment({
      appointmentId: appointment!.id,
      professionalId: appointment!.professionalId,
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
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="gap-1 border-b px-4 pb-3 pt-5 pr-12 sm:px-6 sm:pt-6">
            <DialogTitle>O que deseja fazer?</DialogTitle>
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
            <DialogSection icon={UserRound} title="Cliente">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <p className="min-w-0 flex-1 truncate text-base font-medium">
                    {customerName}
                  </p>
                  {canChangeClient && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => setSubView("changeClient")}
                    >
                      <UserRound className="size-3.5" />
                      Trocar cliente
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatWhatsapp(appointment.customerWhatsapp)}
                  </span>
                  <Button variant="outline" size="sm" className="h-8" asChild>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-3.5" />
                      Abrir WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </DialogSection>

            <DialogSection
              icon={Scissors}
              title="Atendimento"
              description="Serviço, profissional e valores deste horário."
            >
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3">
                <DetailCell label="Barbeiro">
                  <p className="truncate">{appointment.professionalNickname}</p>
                </DetailCell>

                <DetailCell label="Status">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "w-fit",
                      agendaAppointmentClass({
                        status: appointment.status,
                        isSqueezeIn: appointment.isSqueezeIn,
                        isComandaExtra: appointment.isComandaExtra,
                      })
                    )}
                  >
                    {STATUS_LABELS[appointment.status]}
                  </Badge>
                </DetailCell>

                <DetailCell label="Serviço" className="sm:col-span-2">
                  <p className="line-clamp-2 leading-snug">{serviceNames}</p>
                  <p className="text-muted-foreground">
                    {formatDuration(totalMinutes)}
                  </p>
                </DetailCell>

                <DetailCell label="Valor">
                  <p className="text-base font-semibold tabular-nums">
                    {formatPriceBRL(totalPrice)}
                  </p>
                </DetailCell>
              </div>
            </DialogSection>
          </div>

          <div className="border-t bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={busy}
                  onClick={() => {
                    onOpenChange(false);
                    onOpenComanda();
                  }}
                >
                  <Receipt className="size-4" />
                  {comandaClosed ? "Ver comanda fechada" : isActive ? "Abrir comanda" : "Ver comanda"}
                </Button>

                {isOwner && comandaClosed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
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
                    className="h-9"
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
                    className="h-9 text-destructive hover:text-destructive"
                    onClick={() => setSubView("cancel")}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open && subView === "cancel"}
        onOpenChange={(next) => {
          if (!next) setSubView("main");
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b px-4 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
            <DialogTitle>Cancelar agendamento?</DialogTitle>
            <DialogDescription>
              O horário some da agenda. Nenhum valor entra no caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <DialogSection
              icon={X}
              title="Motivo"
              description="Obrigatório para registrar o cancelamento."
            >
              <div className="space-y-2">
                <Label htmlFor="cancel-reason-actions" className="sr-only">
                  Motivo do cancelamento
                </Label>
                <Textarea
                  id="cancel-reason-actions"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex.: cliente desmarcou, não veio..."
                  rows={3}
                  disabled={busy}
                />
              </div>
            </DialogSection>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
            <Button
              variant="outline"
              onClick={() => setSubView("main")}
              disabled={busy}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={busy || cancelReason.trim().length < 3}
            >
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open && subView === "changeClient"}
        onOpenChange={(next) => {
          if (!next) setSubView("main");
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b px-4 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
            <DialogTitle>Trocar cliente</DialogTitle>
            <DialogDescription>
              Atualiza nome e WhatsApp deste agendamento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangeClient}>
            <div className="px-4 py-4 sm:px-6 sm:py-5">
              <DialogSection
                icon={UserRound}
                title="Dados do cliente"
                description="Busque pelo WhatsApp ou preencha manualmente."
              >
                <AdminCustomerFields
                  firstName={firstName}
                  lastName={lastName}
                  whatsapp={whatsapp}
                  onFirstNameChange={setFirstName}
                  onLastNameChange={setLastName}
                  onWhatsappChange={setWhatsapp}
                  enabled={open && subView === "changeClient"}
                  idPrefix="changeClient"
                />
              </DialogSection>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSubView("main")}
                disabled={busy}
              >
                Voltar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
