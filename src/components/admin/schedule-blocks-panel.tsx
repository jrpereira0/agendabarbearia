"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Clock3, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration, formatTime } from "@/lib/format";
import { timeToMinutes } from "@/lib/availability";
import { encaixeTimeSlots } from "@/lib/encaixe";
import { cn } from "@/lib/utils";
import {
  createScheduleBlock,
  deleteScheduleBlock,
} from "@/app/admin/(panel)/agenda/actions";
import type { ScheduleBlockItem } from "@/lib/get-agenda-day";

const QUICK_REASONS = ["Almoço", "Folga", "Médico", "Pessoal"] as const;

type ScheduleBlocksPanelProps = {
  date: string;
  blocks: ScheduleBlockItem[];
  professionals: { id: string; nickname: string }[];
  isOwner: boolean;
  defaultProfessionalId: string | null;
  slotStepMinutes: number;
  canManage?: boolean;
  compact?: boolean;
};

export function ScheduleBlocksPanel({
  date,
  blocks,
  professionals,
  isOwner,
  defaultProfessionalId,
  slotStepMinutes,
  canManage = true,
  compact = false,
}: ScheduleBlocksPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const timeSlots = useMemo(
    () => encaixeTimeSlots(slotStepMinutes),
    [slotStepMinutes]
  );

  const [professionalId, setProfessionalId] = useState(
    defaultProfessionalId ?? professionals[0]?.id ?? ""
  );
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [note, setNote] = useState("");

  const selectedProfessional = professionals.find((p) => p.id === professionalId);
  const durationMinutes = Math.max(
    0,
    timeToMinutes(endTime) - timeToMinutes(startTime)
  );
  const rangeInvalid = startTime >= endTime;

  function resetForm() {
    setProfessionalId(defaultProfessionalId ?? professionals[0]?.id ?? "");
    setStartTime("12:00");
    setEndTime("13:00");
    setNote("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleStartChange(nextStart: string) {
    setStartTime(nextStart);
    if (nextStart >= endTime) {
      const idx = timeSlots.indexOf(nextStart);
      const fallback = timeSlots[idx + 1] ?? timeSlots[timeSlots.length - 1];
      if (fallback && fallback > nextStart) setEndTime(fallback);
    }
  }

  async function handleCreate() {
    if (!professionalId) {
      toast.error("Escolha o profissional.");
      return;
    }
    if (rangeInvalid) {
      toast.error("O horário de fim precisa ser depois do início.");
      return;
    }

    setBusy(true);
    const result = await createScheduleBlock({
      professionalId,
      date,
      startTime,
      endTime,
      note,
    });

    if (result.ok) {
      toast.success("Horário bloqueado.");
      setOpen(false);
      resetForm();
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleDelete(id: string) {
    setBusy(true);
    const result = await deleteScheduleBlock(id);
    if (result.ok) {
      toast.success("Bloqueio removido.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-xs leading-relaxed text-[var(--agenda-muted,#8b8d93)]">
            Ninguém agenda nesse horário, exceto por encaixe.
          </p>
          {canManage && professionals.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Bloquear horário"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-[#1a1b1e] text-[var(--agenda-accent,#ecf15e)] transition-colors hover:border-[rgb(236_241_94_/_35%)] hover:bg-[rgb(236_241_94_/_10%)]"
            >
              <Plus className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {compact && canManage && professionals.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#1a1b1e] px-2.5 py-1.5 text-xs font-medium text-[var(--agenda-accent,#ecf15e)] transition-colors hover:border-[rgb(236_241_94_/_35%)] hover:bg-[rgb(236_241_94_/_10%)]"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Bloquear
          </button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#121316] px-3 py-4 text-center text-xs text-[var(--agenda-muted,#8b8d93)]">
          {compact
            ? "Nenhum bloqueio neste dia."
            : "Nenhum bloqueio. Use para almoço, folga ou pausa."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#121316] px-2.5 py-2.5 shadow-[inset_3px_0_0_0_#ecf15e]"
            >
              <Ban
                className="mt-0.5 size-3.5 shrink-0 text-[var(--agenda-accent,#ecf15e)]"
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tabular-nums text-[#f5f5f5]">
                  {formatTime(block.startTime)} – {formatTime(block.endTime)}
                </p>
                {isOwner && (
                  <p className="mt-0.5 text-[11px] text-[var(--agenda-muted,#8b8d93)]">
                    {block.professionalNickname}
                  </p>
                )}
                {block.note && (
                  <p className="mt-1 text-[10px] font-medium tracking-[0.08em] text-[var(--agenda-accent,#ecf15e)] uppercase">
                    {block.note}
                  </p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--agenda-muted,#8b8d93)] transition-colors hover:bg-white/5 hover:text-[#e8a0a0]"
                  onClick={() => handleDelete(block.id)}
                  disabled={busy}
                  aria-label="Remover bloqueio"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog max-h-[min(92dvh,640px)] w-[calc(100%-1.25rem)] gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>

          <DialogHeader className="booking-header gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
            <div className="flex items-start gap-3">
              <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Ban className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                  Bloquear horário
                </DialogTitle>
                <DialogDescription>
                  Reserva a faixa na agenda. Clientes não marcam — encaixe
                  manual continua liberado.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {isOwner && (
              <div className="space-y-2">
                <Label>Barbeiro</Label>
                <Select
                  value={professionalId}
                  onValueChange={setProfessionalId}
                  disabled={busy}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Escolha o barbeiro" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="booking-context space-y-3 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock3 className="size-3.5" />
                Faixa bloqueada
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Select
                    value={startTime}
                    onValueChange={handleStartChange}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeSlots.map((t) => (
                        <SelectItem key={`start-${t}`} value={t}>
                          {formatTime(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Select
                    value={endTime}
                    onValueChange={setEndTime}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeSlots.map((t) => (
                        <SelectItem
                          key={`end-${t}`}
                          value={t}
                          disabled={t <= startTime}
                        >
                          {formatTime(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm",
                  rangeInvalid
                    ? "border-[rgb(248_113_113_/_35%)] bg-[rgb(248_113_113_/_8%)] text-[#fca5a5]"
                    : "border-[var(--booking-border)] bg-[var(--booking-input)] text-[#f5f5f5]"
                )}
              >
                {rangeInvalid ? (
                  "Escolha um horário final depois do início."
                ) : (
                  <p className="leading-snug">
                    <span className="font-medium">
                      {formatTime(startTime)} – {formatTime(endTime)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatDuration(durationMinutes)}
                      {selectedProfessional
                        ? ` · ${selectedProfessional.nickname}`
                        : ""}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="block-note">Motivo</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((reason) => {
                  const selected = note === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      disabled={busy}
                      onClick={() => setNote(reason)}
                      className={cn(
                        "h-8 rounded-lg border px-3 text-xs transition-colors sm:text-sm",
                        selected
                          ? "booking-pick-active"
                          : "booking-pick",
                        busy && "opacity-50"
                      )}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
              <Input
                id="block-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ou escreva outro motivo (opcional)"
                maxLength={200}
                className="h-11"
                disabled={busy}
              />
            </div>
          </div>

          <div className="booking-footer flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="booking-btn-ghost"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="booking-btn-primary"
              onClick={() => void handleCreate()}
              disabled={busy || rangeInvalid || !professionalId}
            >
              {busy ? "Salvando..." : "Confirmar bloqueio"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
