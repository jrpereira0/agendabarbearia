"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSectionTitle } from "@/components/admin/form-section";
import { formatDateBR, formatTime } from "@/lib/format";
import {
  createException,
  deleteException,
} from "@/app/admin/(panel)/configuracoes/actions";

export type ExceptionItem = {
  id: string;
  date: string;
  kind: "closed" | "custom";
  startTime: string | null;
  endTime: string | null;
  note: string;
  professionalNickname: string | null;
};

type ExceptionsCardProps = {
  exceptions: ExceptionItem[];
  professionals: { id: string; nickname: string }[];
  readOnly?: boolean;
};

const SHOP = "shop";

export function ExceptionsCard({
  exceptions,
  professionals,
  readOnly = false,
}: ExceptionsCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState("");
  const [scope, setScope] = useState(SHOP);
  const [kind, setKind] = useState<"closed" | "custom">("closed");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("19:00");
  const [note, setNote] = useState("");

  function resetForm() {
    setDate("");
    setScope(SHOP);
    setKind("closed");
    setStartTime("09:00");
    setEndTime("19:00");
    setNote("");
  }

  async function handleCreate() {
    if (!date) {
      toast.error("Escolha a data.");
      return;
    }
    setBusy(true);
    const result = await createException({
      date,
      professionalId: scope === SHOP ? null : scope,
      kind,
      startTime: kind === "custom" ? startTime : null,
      endTime: kind === "custom" ? endTime : null,
      note,
    });

    if (result.ok) {
      toast.success("Exceção criada.");
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
    const result = await deleteException(id);
    if (result.ok) {
      toast.success("Exceção removida.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <FormSectionTitle
            icon={CalendarOff}
            title="Dias especiais"
            description="Feriados, folgas pontuais e dias com horário diferente."
          />
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus />
              Nova exceção
            </Button>
          )}
        </div>

        {exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dia especial cadastrado. Exemplo: feriado fechado, ou véspera
            de festa atendendo até mais tarde.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {exceptions.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span className="w-36 text-sm font-medium">
                  {formatDateBR(e.date)}
                </span>
                <Badge variant="outline" className="font-normal">
                  {e.professionalNickname ?? "Barbearia toda"}
                </Badge>
                {e.kind === "closed" ? (
                  <Badge variant="secondary">Fechado</Badge>
                ) : (
                  <Badge variant="secondary">
                    {formatTime(e.startTime!)} às {formatTime(e.endTime!)}
                  </Badge>
                )}
                {e.note && (
                  <span className="text-sm text-muted-foreground">
                    {e.note}
                  </span>
                )}
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto text-destructive hover:text-destructive"
                    onClick={() => handleDelete(e.id)}
                    disabled={busy}
                    aria-label="Remover exceção"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova exceção</DialogTitle>
            <DialogDescription>
              Vale só pra data escolhida e substitui o horário normal.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="exception-date">Data</Label>
                <Input
                  id="exception-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Vale pra quem?</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SHOP}>Barbearia toda</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>O que acontece nesse dia?</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as "closed" | "custom")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">
                    Fechado / folga o dia todo
                  </SelectItem>
                  <SelectItem value="custom">
                    Horário diferente do normal
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">às</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-28"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="exception-note">Motivo (opcional)</Label>
              <Input
                id="exception-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Feriado, médico, evento..."
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
              {busy ? "Salvando..." : "Criar exceção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
