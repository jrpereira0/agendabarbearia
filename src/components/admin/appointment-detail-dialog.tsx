"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  MessageCircle,
  Pencil,
  RotateCcw,
  Scissors,
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
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { agendaAppointmentClass } from "@/lib/agenda-colors";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  STATUS_LABELS,
} from "@/lib/appointment-status";
import {
  cancelAppointment,
  markAppointmentDone,
  reopenAppointment,
} from "@/app/admin/(panel)/agenda/actions";
import type { AppointmentItem } from "@/components/admin/appointment-item";

type AppointmentDetailDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showProfessional: boolean;
  professionalPhotoUrl?: string | null;
  onEdit?: () => void;
};

function StatusBadge({ appointment }: { appointment: AppointmentItem }) {
  const colorClass =
    appointment.status === "cancelled"
      ? "bg-muted text-muted-foreground"
      : agendaAppointmentClass(appointment);

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
      <Badge
        variant="secondary"
        className={cn("border-0 font-normal", colorClass)}
      >
        {STATUS_LABELS[appointment.status]}
      </Badge>
      {appointment.isSqueezeIn &&
        (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(
          appointment.status
        ) && (
        <Badge
          variant="outline"
          className="border-dashed border-[#c41e3a] bg-white font-normal text-[#9f1239]"
        >
          Encaixe
        </Badge>
      )}
    </div>
  );
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  showProfessional,
  professionalPhotoUrl = null,
  onEdit,
}: AppointmentDetailDialogProps) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!appointment) return null;

  const totalMinutes = appointment.services.reduce(
    (s, svc) => s + svc.durationMinutes,
    0
  );
  const totalPrice = appointment.services.reduce(
    (s, svc) => s + svc.priceCents,
    0
  );
  const whatsappLink = `https://wa.me/55${appointment.customerWhatsapp}`;
  const isActive = (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(
    appointment.status
  );
  const isDone = appointment.status === "done";
  const canAct = isActive || isDone;
  const customerName = `${appointment.customerFirstName} ${appointment.customerLastName}`;

  async function handleDone() {
    setBusy(true);
    const result = await markAppointmentDone(appointment!.id);
    if (result.ok) {
      toast.success("Marcado como atendido.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleReopen() {
    setBusy(true);
    const result = await reopenAppointment(appointment!.id);
    if (result.ok) {
      toast.success("Atendimento reaberto.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleCancel() {
    setBusy(true);
    const result = await cancelAppointment(appointment!.id);
    if (result.ok) {
      toast.success("Agendamento cancelado.");
      setConfirmCancel(false);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <>
      <Dialog open={open && !confirmCancel} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90dvh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>{customerName}</DialogTitle>
            <DialogDescription>
              Agendamento das {formatTime(appointment.startTime)} às{" "}
              {formatTime(appointment.endTime)}
            </DialogDescription>
          </DialogHeader>

          {/* Cabeçalho */}
          <div className="border-b bg-muted/25 px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {formatTime(appointment.startTime)}
                  <span className="mx-1.5 font-normal text-muted-foreground">
                    –
                  </span>
                  {formatTime(appointment.endTime)}
                </p>
                <p className="mt-1 truncate text-base font-medium">
                  {customerName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateBR(appointment.date)}
                </p>
              </div>
              <StatusBadge appointment={appointment} />
            </div>

            {showProfessional && appointment.professionalNickname !== "—" && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg border bg-background/80 px-3 py-2">
                <ProfessionalAvatar
                  photoUrl={professionalPhotoUrl}
                  name={appointment.professionalNickname}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {appointment.professionalNickname}
                  </p>
                  <p className="text-xs text-muted-foreground">Barbeiro</p>
                </div>
              </div>
            )}
          </div>

          {/* Conteúdo */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-4">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background">
                  <MessageCircle className="size-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    WhatsApp
                  </span>
                  <span className="block text-sm font-medium tabular-nums">
                    {formatWhatsapp(appointment.customerWhatsapp)}
                  </span>
                </span>
              </a>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Scissors className="size-3.5" />
                  Serviços
                </div>
                <ul className="overflow-hidden rounded-lg border">
                  {appointment.services.map((svc, index) => (
                    <li
                      key={svc.id}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3 py-2.5 text-sm",
                        index > 0 && "border-t"
                      )}
                    >
                      <span className="font-medium">{svc.name}</span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {formatDuration(svc.durationMinutes)}
                        <span className="mx-1">·</span>
                        {formatPriceBRL(svc.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatDuration(totalMinutes)}
                  <span className="mx-1.5 font-normal text-muted-foreground">
                    ·
                  </span>
                  {formatPriceBRL(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {canAct && (
            <div className="shrink-0 border-t bg-muted/20 px-5 pt-4 pb-5 sm:pb-6">
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit?.();
                  }}
                  disabled={busy || !onEdit}
                  className="w-full"
                >
                  <Pencil />
                  Editar agendamento
                </Button>
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmCancel(true)}
                    disabled={busy}
                    className="w-full"
                  >
                    <X />
                    Cancelar
                  </Button>
                  {isActive ? (
                    <Button
                      onClick={handleDone}
                      disabled={busy}
                      className="w-full"
                    >
                      <Check />
                      Marcar atendido
                    </Button>
                  ) : (
                    <Button
                      onClick={handleReopen}
                      disabled={busy}
                      className="w-full"
                    >
                      <RotateCcw />
                      Reabrir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
          <div className="px-5 pt-5 pb-4">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle>Cancelar agendamento?</DialogTitle>
              <DialogDescription>
                Essa ação libera o horário na agenda. O cliente não é avisado
                automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 rounded-lg border bg-muted/25 px-3.5 py-3">
              <p className="text-sm font-medium tabular-nums">
                {formatTime(appointment.startTime)}
                <span className="mx-1.5 font-normal text-muted-foreground">
                  ·
                </span>
                {formatDateBR(appointment.date)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {customerName}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t bg-muted/20 px-5 pt-4 pb-5 sm:flex-row sm:justify-end sm:pb-6">
            <Button
              variant="outline"
              onClick={() => setConfirmCancel(false)}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {busy ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
