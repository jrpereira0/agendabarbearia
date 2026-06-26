"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  openCashRegisterAction,
  reopenCashRegisterAction,
} from "@/app/admin/(panel)/financeiro/actions";
import { formatDateBR, formatPriceBRL, parsePriceBRLInput } from "@/lib/format";

export type CashRegisterResponsibleOption = {
  id: string;
  label: string;
};

type OpenCashRegisterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceDate: string;
  today: string;
  mode: "open" | "reopen";
  lockServiceDate?: boolean;
  responsibleOptions: CashRegisterResponsibleOption[];
  defaultResponsibleId?: string;
  defaultOpeningBalanceCents?: number;
  onSuccess: (serviceDate: string) => void;
};

export function OpenCashRegisterDialog({
  open,
  onOpenChange,
  serviceDate,
  today,
  mode,
  lockServiceDate = false,
  responsibleOptions,
  defaultResponsibleId,
  defaultOpeningBalanceCents = 0,
  onSuccess,
}: OpenCashRegisterDialogProps) {
  const [serviceDateInput, setServiceDateInput] = useState(serviceDate);
  const [responsibleId, setResponsibleId] = useState("");
  const [cashInput, setCashInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServiceDateInput(serviceDate || today);
    const fallbackId =
      defaultResponsibleId ?? responsibleOptions[0]?.id ?? "";
    setResponsibleId(fallbackId);
    setCashInput(
      defaultOpeningBalanceCents > 0
        ? formatPriceBRL(defaultOpeningBalanceCents)
        : ""
    );
    setBusy(false);
  }, [
    open,
    serviceDate,
    today,
    defaultResponsibleId,
    defaultOpeningBalanceCents,
    responsibleOptions,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDateInput)) {
      toast.error("Escolha o dia do caixa.");
      return;
    }

    const option = responsibleOptions.find((item) => item.id === responsibleId);
    if (!option) {
      toast.error("Escolha quem está responsável pelo caixa.");
      return;
    }

    setBusy(true);
    const openingBalanceCents = parsePriceBRLInput(cashInput);
    const payload = {
      responsibleName: option.label,
      openingBalanceCents,
    };

    const result =
      mode === "reopen"
        ? await reopenCashRegisterAction(serviceDateInput, payload)
        : await openCashRegisterAction(serviceDateInput, payload);

    setBusy(false);

    if (result.ok) {
      toast.success(mode === "reopen" ? "Caixa reaberto." : "Caixa aberto.");
      onOpenChange(false);
      const openedDate = serviceDateInput;
      window.setTimeout(() => onSuccess(openedDate), 0);
    } else {
      toast.error(result.error);
    }
  }

  const dateLocked = lockServiceDate || mode === "reopen";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>
              {mode === "reopen" ? "Reabrir caixa" : "Abrir caixa"}
            </DialogTitle>
            <DialogDescription>
              O <strong>dia do caixa</strong> é a data dos atendimentos. A{" "}
              <strong>abertura</strong> será registrada agora, com data e horário
              atuais.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cash-service-date">Dia do caixa</Label>
              <Input
                id="cash-service-date"
                type="date"
                value={serviceDateInput}
                onChange={(e) => setServiceDateInput(e.target.value)}
                disabled={busy || dateLocked}
              />
              <p className="text-xs text-muted-foreground">
                {dateLocked
                  ? `Caixa de ${formatDateBR(serviceDateInput)}.`
                  : "Pode ser hoje ou um dia anterior que ainda não foi fechado."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-responsible">Responsável</Label>
              <Select
                value={responsibleId}
                onValueChange={setResponsibleId}
                disabled={busy || responsibleOptions.length === 0}
              >
                <SelectTrigger id="cash-responsible" className="w-full">
                  <SelectValue placeholder="Quem está no caixa?" />
                </SelectTrigger>
                <SelectContent>
                  {responsibleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-opening-balance">Dinheiro no caixa</Label>
              <Input
                id="cash-opening-balance"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={cashInput}
                onChange={(e) =>
                  setCashInput(
                    e.target.value
                      ? formatPriceBRL(parsePriceBRLInput(e.target.value))
                      : ""
                  )
                }
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Valor em espécie que já está na gaveta no início do dia.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !responsibleId}>
              {mode === "reopen" ? "Reabrir caixa" : "Abrir caixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
