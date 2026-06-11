"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Pencil } from "lucide-react";
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
import {
  formatDuration,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import {
  cancelAppointment,
  markAppointmentDone,
} from "@/app/admin/(panel)/agenda/actions";
import type { AppointmentItem } from "@/components/admin/appointment-card";

type AppointmentDetailDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showProfessional: boolean;
  onEdit?: () => void;
};

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  showProfessional,
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
  const canAct = appointment.status === "confirmed";

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {appointment.customerFirstName} {appointment.customerLastName}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span>
                {formatTime(appointment.startTime)} –{" "}
                {formatTime(appointment.endTime)}
                {showProfessional && ` · ${appointment.professionalNickname}`}
              </span>
              {appointment.isSqueezeIn && appointment.status === "confirmed" && (
                <Badge variant="outline">Encaixe</Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="size-4" />
              {formatWhatsapp(appointment.customerWhatsapp)}
            </a>

            <div className="flex flex-wrap gap-1.5">
              {appointment.services.map((svc) => (
                <Badge key={svc.id} variant="secondary">
                  {svc.name}
                </Badge>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
            </p>
          </div>

          {canAct && (
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEdit?.();
                }}
                disabled={busy || !onEdit}
                className="w-full sm:w-auto"
              >
                <Pencil />
                Editar
              </Button>
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setConfirmCancel(true)}
                  disabled={busy}
                >
                  Cancelar agendamento
                </Button>
                <Button onClick={handleDone} disabled={busy}>
                  Marcar atendido
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar agendamento?</DialogTitle>
            <DialogDescription>
              O horário de {formatTime(appointment.startTime)} vai ficar livre
              de novo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmCancel(false)}
              disabled={busy}
            >
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={busy}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
