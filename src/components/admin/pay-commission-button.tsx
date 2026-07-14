"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { payCommissionAction } from "@/app/admin/(panel)/financeiro/actions";
import { formatPeriodLabel } from "@/lib/date-range";
import { formatPriceBRL } from "@/lib/format";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (amountCents <= 0) return null;

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
      setOpen(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
  }

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pagamento?</DialogTitle>
            <DialogDescription>
              Confirmar o pagamento da comissão de {professionalNickname} no
              período {formatPeriodLabel(from, to)}:{" "}
              {formatPriceBRL(amountCents)}. Depois de confirmar, esses
              atendimentos não entram mais no próximo repasse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void confirmPay()}
            >
              {pending ? "Registrando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
