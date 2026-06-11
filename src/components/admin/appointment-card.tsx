"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  MessageCircle,
  MoreVertical,
  Pencil,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export type AppointmentItem = {
  id: string;
  date: string;
  professionalId: string;
  professionalNickname: string;
  customerFirstName: string;
  customerLastName: string;
  customerWhatsapp: string;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "done";
  isSqueezeIn?: boolean;
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
};

type AppointmentCardProps = {
  appointment: AppointmentItem;
  showProfessional: boolean;
  onEdit?: () => void;
};

const STATUS_LABEL: Record<AppointmentItem["status"], string> = {
  confirmed: "Confirmado",
  done: "Atendido",
  cancelled: "Cancelado",
};

const STATUS_DOT: Record<AppointmentItem["status"], string> = {
  confirmed: "bg-emerald-500",
  done: "bg-muted-foreground",
  cancelled: "bg-destructive",
};

export function AppointmentCard({
  appointment: a,
  showProfessional,
  onEdit,
}: AppointmentCardProps) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalMinutes = a.services.reduce((s, svc) => s + svc.durationMinutes, 0);
  const totalPrice = a.services.reduce((s, svc) => s + svc.priceCents, 0);
  const whatsappLink = `https://wa.me/55${a.customerWhatsapp}`;

  async function handleDone() {
    setBusy(true);
    const result = await markAppointmentDone(a.id);
    if (result.ok) {
      toast.success("Marcado como atendido.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleCancel() {
    setBusy(true);
    const result = await cancelAppointment(a.id);
    if (result.ok) {
      toast.success("Agendamento cancelado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmCancel(false);
    setBusy(false);
  }

  const isPastActionable = a.status === "confirmed";

  return (
    <>
      <Card
        className={
          a.status === "cancelled"
            ? "opacity-50"
            : a.status === "done"
              ? "opacity-80"
              : ""
        }
      >
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold tabular-nums">
                  {formatTime(a.startTime)} – {formatTime(a.endTime)}
                </p>
                <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span
                    className={`size-2 rounded-full ${STATUS_DOT[a.status]}`}
                  />
                  {STATUS_LABEL[a.status]}
                  {a.isSqueezeIn && a.status === "confirmed" && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      Encaixe
                    </Badge>
                  )}
                </span>
              </div>
              {showProfessional && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {a.professionalNickname}
                </p>
              )}
            </div>

            {isPastActionable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit} disabled={busy}>
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDone} disabled={busy}>
                    <Check />
                    Marcar como atendido
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirmCancel(true)}
                    disabled={busy}
                  >
                    <X />
                    Cancelar agendamento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted">
              <User className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {a.customerFirstName} {a.customerLastName}
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="size-3.5" />
                {formatWhatsapp(a.customerWhatsapp)}
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {a.services.map((svc) => (
              <Badge key={svc.id} variant="secondary">
                {svc.name}
              </Badge>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar agendamento?</DialogTitle>
            <DialogDescription>
              O horário de {formatTime(a.startTime)} de {a.customerFirstName}{" "}
              {a.customerLastName} vai ficar livre de novo.
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
              Cancelar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
