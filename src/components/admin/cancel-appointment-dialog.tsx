"use client";

import { CalendarX2, X } from "lucide-react";
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
import { DialogSection } from "@/components/admin/dialog-section";
import { QUICK_CANCELLATION_REASONS } from "@/lib/cancellation-reasons";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUICK_REASONS = QUICK_CANCELLATION_REASONS;

const MIN_REASON_LENGTH = 3;

export type CancelAppointmentKind = "normal" | "squeeze" | "extra" | "service";

type CancelAppointmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  busy?: boolean;
  kind?: CancelAppointmentKind;
  customerName?: string | null;
  professionalNickname?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  serviceLabel?: string | null;
  dateLabel?: string | null;
  detailNote?: string | null;
};

function titleForKind(kind: CancelAppointmentKind): string {
  if (kind === "extra") return "Cancelar serviço extra?";
  if (kind === "squeeze") return "Cancelar encaixe?";
  if (kind === "service") return "Cancelar este serviço?";
  return "Cancelar agendamento?";
}

export function CancelAppointmentDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onConfirm,
  busy = false,
  kind = "normal",
  customerName,
  professionalNickname,
  startTime,
  endTime,
  serviceLabel,
  dateLabel,
  detailNote,
}: CancelAppointmentDialogProps) {
  const trimmed = reason.trim();
  const canConfirm = trimmed.length >= MIN_REASON_LENGTH && !busy;
  const charsLeft = Math.max(0, MIN_REASON_LENGTH - trimmed.length);

  const hasSummary =
    Boolean(customerName) ||
    Boolean(professionalNickname) ||
    Boolean(startTime) ||
    Boolean(serviceLabel) ||
    Boolean(dateLabel);

  function handleClose() {
    if (busy) return;
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="admin-booking-dialog flex max-h-[min(92dvh,720px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:w-full sm:max-w-md"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={handleClose}
          className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
        <DialogHeader className="booking-header shrink-0 border-b px-4 pb-3 pt-5 pr-14 sm:pl-6 sm:pr-14 sm:pb-4 sm:pt-6">
          <DialogTitle className="booking-display text-[#f5f5f5]">
            {titleForKind(kind)}
          </DialogTitle>
          <DialogDescription>
            O horário some da agenda e nenhum valor entra no caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:space-y-4 sm:px-6 sm:py-5">
          {detailNote ? (
            <p className="booking-notice rounded-xl px-4 py-3 text-sm">
              {detailNote}
            </p>
          ) : null}

          {hasSummary && (
            <div className="booking-context rounded-xl px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                O que será cancelado
              </p>
              <div className="mt-1.5 space-y-1 text-sm">
                {customerName ? (
                  <p className="truncate font-medium">{customerName}</p>
                ) : null}
                {(dateLabel || startTime) && (
                  <p className="tabular-nums text-muted-foreground">
                    {[
                      dateLabel,
                      startTime
                        ? endTime
                          ? `${formatTime(startTime)} – ${formatTime(endTime)}`
                          : formatTime(startTime)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {professionalNickname ? (
                  <p className="text-muted-foreground">
                    Barbeiro: {professionalNickname}
                    {kind === "extra"
                      ? " · serviço extra"
                      : kind === "squeeze"
                        ? " · encaixe"
                        : ""}
                  </p>
                ) : null}
                {serviceLabel ? (
                  <p className="line-clamp-2 text-muted-foreground">
                    Serviço: {serviceLabel}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <DialogSection
            icon={CalendarX2}
            title="Motivo"
            description="Obrigatório. Ajuda a saber depois por que o horário saiu."
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((quick) => {
                  const selected = reason === quick;
                  return (
                    <button
                      key={quick}
                      type="button"
                      disabled={busy}
                      onClick={() => onReasonChange(quick)}
                      className={cn(
                        "h-8 rounded-lg border px-2.5 text-left text-xs sm:h-9 sm:px-3 sm:text-sm",
                        "transition-colors focus-visible:outline-none",
                        selected
                          ? "booking-pick-active border-[rgb(236_241_94_/_55%)]"
                          : "booking-pick",
                        busy && "opacity-50"
                      )}
                    >
                      {quick}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancel-appointment-reason">
                  Descreva o motivo
                </Label>
                <Textarea
                  id="cancel-appointment-reason"
                  value={reason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  placeholder="Ou escreva outro motivo…"
                  rows={2}
                  disabled={busy}
                  className="min-h-16 resize-none text-base sm:min-h-20 sm:text-sm"
                  autoFocus
                />
                <p
                  className={cn(
                    "text-xs",
                    canConfirm || trimmed.length === 0
                      ? "text-muted-foreground"
                      : "text-[#f87171]"
                  )}
                >
                  {charsLeft > 0
                    ? `Faltam ${charsLeft} caractere${charsLeft === 1 ? "" : "s"} para confirmar.`
                    : "Motivo ok. Pode confirmar o cancelamento."}
                </p>
              </div>
            </div>
          </DialogSection>
        </div>

        <div className="booking-footer flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            className="booking-btn-ghost h-11 sm:h-9"
            onClick={handleClose}
            disabled={busy}
          >
            Voltar
          </Button>
          <Button
            type="button"
            className="booking-btn-danger-solid h-11 sm:h-9"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {busy ? "Cancelando…" : "Confirmar cancelamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
