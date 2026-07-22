"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { payCommissionAction } from "@/app/admin/(panel)/financeiro/actions";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatPriceBRL } from "@/lib/format";

type PayCommissionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: string;
  to: string;
  professionalId: string;
  professionalNickname: string;
  amountCents: number;
};

export function PayCommissionDialog({
  open,
  onOpenChange,
  from,
  to,
  professionalId,
  professionalNickname,
  amountCents,
}: PayCommissionDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function confirmPay() {
    const result = await payCommissionAction({
      from,
      to,
      professionalId,
    });

    if (result.ok) {
      toast.success(
        `Pagamento de ${formatPriceBRL(result.amountCents)} para ${professionalNickname} registrado.`
      );
      onOpenChange(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="admin-booking-dialog flex max-h-[min(92dvh,560px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => {
            if (!pending) onOpenChange(false);
          }}
          disabled={pending}
          className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
        >
          <X className="size-4" strokeWidth={2} />
        </button>

        <DialogHeader className="booking-header shrink-0 gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
          <div className="flex items-start gap-3">
            <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
              <Banknote className="size-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                Registrar pagamento
              </DialogTitle>
              <DialogDescription>
                Confirma o repasse da comissão. Esses atendimentos saem do
                próximo a pagar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="booking-context rounded-xl px-3.5 py-3">
            <p className="text-sm font-medium text-[#f5f5f5]">
              {professionalNickname}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPeriodLabel(from, to)}
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-[#f5f5f5]">
              {formatPriceBRL(amountCents)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Depois de confirmar, o valor deixa de aparecer como comissão em
            aberto neste período.
          </p>
        </div>

        <div className="booking-footer flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="booking-btn-ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="booking-btn-primary"
            disabled={pending}
            onClick={() => void confirmPay()}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Registrando…
              </>
            ) : (
              "Confirmar pagamento"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PayCommissionButtonProps = {
  from: string;
  to: string;
  professionalId: string;
  professionalNickname: string;
  amountCents: number;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  label?: string;
};

export function PayCommissionButton({
  from,
  to,
  professionalId,
  professionalNickname,
  amountCents,
  variant = "outline",
  size = "sm",
  className,
  label = "Pagar",
}: PayCommissionButtonProps) {
  const [open, setOpen] = useState(false);

  if (amountCents <= 0) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Banknote className="size-4" />
        {label}
      </Button>

      <PayCommissionDialog
        open={open}
        onOpenChange={setOpen}
        from={from}
        to={to}
        professionalId={professionalId}
        professionalNickname={professionalNickname}
        amountCents={amountCents}
      />
    </>
  );
}
