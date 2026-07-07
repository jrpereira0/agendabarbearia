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
    <div className={cn(!compact && "rounded-lg border p-4")}>
      {!compact && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Bloqueios do dia</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ninguém agenda nesse horário, exceto por encaixe.
            </p>
          </div>
          {canManage && professionals.length > 0 && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setOpen(true)}
              aria-label="Bloquear horário"
            >
              <Plus />
            </Button>
          )}
        </div>
      )}

      {compact && canManage && professionals.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Plus />
            Bloquear horário
          </Button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {compact
            ? "Nenhum bloqueio neste dia."
            : "Nenhum bloqueio neste dia. Use para almoço, compromisso ou pausa."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-start gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs"
            >
              <Ban className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular-nums">
                  {formatTime(block.startTime)} – {formatTime(block.endTime)}
                </p>
                {isOwner && (
                  <p className="text-muted-foreground">
                    {block.professionalNickname}
                  </p>
                )}
                {block.note && (
                  <p className="mt-0.5 text-muted-foreground">{block.note}</p>
                )}
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(block.id)}
                  disabled={busy}
                  aria-label="Remover bloqueio"
                >
                  <Trash2 />
                </Button>
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
