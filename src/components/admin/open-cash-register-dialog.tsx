"use client";

import { useState } from "react";
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
import { DatePickerField } from "@/components/admin/date-picker-field";
import {
  openCashRegisterAction,
  reopenCashRegisterAction,
} from "@/app/admin/(panel)/financeiro/actions";
import { formatDateBR, formatPriceBRL, parsePriceBRLInput } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

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
  /** "dark" = identidade agenda/caixa. */
  tone?: "default" | "dark";
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
  tone = "default",
}: OpenCashRegisterDialogProps) {
  const dark = tone === "dark";
  const [serviceDateInput, setServiceDateInput] = useState(
    () => serviceDate || today
  );
  const [responsibleId, setResponsibleId] = useState(
    () => defaultResponsibleId ?? responsibleOptions[0]?.id ?? ""
  );
  const [cashInput, setCashInput] = useState(() =>
    defaultOpeningBalanceCents > 0
      ? formatPriceBRL(defaultOpeningBalanceCents)
      : ""
  );
  const [busy, setBusy] = useState(false);

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
      <DialogContent
        className={cn(
          "max-w-md",
          dark && "border-white/10 bg-[#151618] text-[#f5f5f5]"
        )}
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle className={cn(dark && "text-[#f5f5f5]")}>
              {mode === "reopen" ? "Reabrir caixa" : "Abrir caixa"}
            </DialogTitle>
            <DialogDescription className={cn(dark && ADMIN_SURFACE.muted)}>
              O <strong className={cn(dark && "text-[#f5f5f5]")}>dia do caixa</strong>{" "}
              é a data dos atendimentos. A{" "}
              <strong className={cn(dark && "text-[#f5f5f5]")}>abertura</strong>{" "}
              será registrada agora, com data e horário atuais.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="cash-service-date"
                className={cn(dark && "text-[#f5f5f5]")}
              >
                Dia do caixa
              </Label>
              {dateLocked ? (
                <div
                  className={cn(
                    "flex h-10 items-center rounded-md border px-3 text-sm",
                    dark
                      ? "border-white/10 bg-[#1a1b1e] text-[#f5f5f5]"
                      : "border-input bg-muted/30"
                  )}
                >
                  {formatDateBR(serviceDateInput)}
                </div>
              ) : (
                <DatePickerField
                  id="cash-service-date"
                  value={serviceDateInput}
                  onChange={setServiceDateInput}
                  tone={dark ? "dark" : "default"}
                  className="sm:w-full"
                />
              )}
              <p className={cn("text-xs", dark ? ADMIN_SURFACE.muted : "text-muted-foreground")}>
                {dateLocked
                  ? `Caixa de ${formatDateBR(serviceDateInput)}.`
                  : "Pode ser hoje ou um dia anterior que ainda não foi fechado."}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="cash-responsible"
                className={cn(dark && "text-[#f5f5f5]")}
              >
                Responsável
              </Label>
              <Select
                value={responsibleId}
                onValueChange={setResponsibleId}
                disabled={busy || responsibleOptions.length === 0}
              >
                <SelectTrigger
                  id="cash-responsible"
                  className={cn("w-full", dark && ADMIN_SURFACE.input)}
                >
                  <SelectValue placeholder="Quem está no caixa?" />
                </SelectTrigger>
                <SelectContent className={cn(dark && ADMIN_SURFACE.popover)}>
                  {responsibleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="cash-opening-balance"
                className={cn(dark && "text-[#f5f5f5]")}
              >
                Dinheiro no caixa
              </Label>
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
                className={cn(dark && ADMIN_SURFACE.input)}
              />
              <p className={cn("text-xs", dark ? ADMIN_SURFACE.muted : "text-muted-foreground")}>
                Valor em espécie que já está na gaveta no início do dia.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={cn(dark && ADMIN_SURFACE.btnGhost)}
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className={cn(dark && ADMIN_SURFACE.btnPrimary)}
              disabled={busy || !responsibleId}
            >
              {mode === "reopen" ? "Reabrir caixa" : "Abrir caixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
