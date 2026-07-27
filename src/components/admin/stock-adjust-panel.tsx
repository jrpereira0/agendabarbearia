"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSectionTitle } from "@/components/admin/form-section";
import { adjustProductStockAction } from "@/app/admin/(panel)/produtos/actions";
import {
  STOCK_ADJUST_REASON_LABELS,
  STOCK_ADJUST_REASONS,
  type StockAdjustReason,
} from "@/lib/product-stock";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type StockAdjustPanelProps = {
  productId: string;
  stockQuantity: number;
};

export function StockAdjustPanel({
  productId,
  stockQuantity,
}: StockAdjustPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantityInput, setQuantityInput] = useState("1");
  const [reason, setReason] = useState<StockAdjustReason>("purchase");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentStock, setCurrentStock] = useState(stockQuantity);

  function openDialog(nextDirection: "in" | "out") {
    setDirection(nextDirection);
    setQuantityInput("1");
    setReason(nextDirection === "in" ? "purchase" : "loss");
    setNote("");
    setOpen(true);
  }

  async function handleSubmit() {
    const qty = Number.parseInt(quantityInput.replace(/\D/g, "") || "0", 10);
    if (qty < 1) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    const delta = direction === "in" ? qty : -qty;
    setBusy(true);
    try {
      const result = await adjustProductStockAction({
        productId,
        delta,
        reason,
        note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (typeof result.quantityAfter === "number") {
        setCurrentStock(result.quantityAfter);
      }
      toast.success(
        direction === "in" ? "Estoque aumentado." : "Estoque reduzido."
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível ajustar o estoque.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          ADMIN_SURFACE.panel,
          "flex flex-col gap-4 p-4 sm:gap-5 sm:p-6"
        )}
      >
        <FormSectionTitle
          tone="dark"
          icon={PackagePlus}
          title="Estoque"
          description="Entrada, saída e perdas ficam registradas no histórico."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Disponível agora
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#f5f5f5]">
              {currentStock}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={ADMIN_SURFACE.btnPrimary}
              onClick={() => openDialog("in")}
            >
              <PackagePlus className="size-4" />
              Entrada
            </Button>
            <Button
              type="button"
              variant="outline"
              className={ADMIN_SURFACE.btnGhost}
              onClick={() => openDialog("out")}
            >
              <PackageMinus className="size-4" />
              Saída
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-w-sm border-white/10 bg-[#151618] text-[#f5f5f5]">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              {direction === "in" ? "Entrada de estoque" : "Saída de estoque"}
            </DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              Estoque atual: {currentStock} un.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="stock-qty">Quantidade</Label>
              <Input
                id="stock-qty"
                inputMode="numeric"
                value={quantityInput}
                onChange={(event) =>
                  setQuantityInput(event.target.value.replace(/\D/g, ""))
                }
                disabled={busy}
                className={ADMIN_SURFACE.input}
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select
                value={reason}
                onValueChange={(value) =>
                  setReason(value as StockAdjustReason)
                }
                disabled={busy}
              >
                <SelectTrigger className={cn("w-full", ADMIN_SURFACE.input)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={ADMIN_SURFACE.popover}>
                  {STOCK_ADJUST_REASONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STOCK_ADJUST_REASON_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-note">Observação (opcional)</Label>
              <Input
                id="stock-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={busy}
                placeholder="Ex: chegou caixa da distribuidora"
                className={ADMIN_SURFACE.input}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={ADMIN_SURFACE.btnGhost}
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className={ADMIN_SURFACE.btnPrimary}
              disabled={busy}
              onClick={() => void handleSubmit()}
            >
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
