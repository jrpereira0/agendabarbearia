"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { formatTime } from "@/lib/format";
import { encaixeTimeSlots } from "@/lib/encaixe";
import { cn } from "@/lib/utils";
import {
  createScheduleBlock,
  deleteScheduleBlock,
} from "@/app/admin/(panel)/agenda/actions";
import type { ScheduleBlockItem } from "@/lib/get-agenda-day";

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

  function resetForm() {
    setProfessionalId(defaultProfessionalId ?? professionals[0]?.id ?? "");
    setStartTime("12:00");
    setEndTime("13:00");
    setNote("");
  }

  async function handleCreate() {
    if (!professionalId) {
      toast.error("Escolha o profissional.");
      return;
    }
    if (startTime >= endTime) {
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear horário</DialogTitle>
            <DialogDescription>
              Clientes e agendamento normal não conseguem marcar nessa faixa.
              Encaixe manual ainda funciona.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {isOwner && (
              <div className="flex flex-col gap-2">
                <Label>Profissional</Label>
                <Select value={professionalId} onValueChange={setProfessionalId}>
                  <SelectTrigger>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>De</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.map((t) => (
                      <SelectItem key={`start-${t}`} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Até</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.map((t) => (
                      <SelectItem key={`end-${t}`} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-note">Motivo (opcional)</Label>
              <Input
                id="block-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Almoço, médico..."
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={busy}>
              {busy ? "Salvando..." : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
