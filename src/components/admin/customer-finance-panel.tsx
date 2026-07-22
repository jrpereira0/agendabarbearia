"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Minus, Plus, Receipt, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FormSectionTitle } from "@/components/admin/form-section";
import {
  addManualCreditAction,
  removeManualCreditAction,
} from "@/app/admin/(panel)/clientes/actions";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL, parsePriceBRLInput } from "@/lib/format";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type CustomerComandaHistoryItem = {
  id: string;
  appointmentId: string | null;
  serviceDate: string;
  closedAt: string | null;
  professionalNickname: string;
  totalCents: number;
  payments: { method: PaymentMethod; amountCents: number }[];
};

export type CustomerCreditHistoryItem = {
  id: string;
  amountCents: number;
  type: "add" | "use";
  paymentMethod: PaymentMethod | null;
  description: string | null;
  comandaId: string | null;
  createdAt: string;
};

type CustomerFinancePanelProps = {
  customerId: string;
  creditBalanceCents: number;
  comandas: CustomerComandaHistoryItem[];
  creditTransactions: CustomerCreditHistoryItem[];
};

function formatCreditType(
  type: "add" | "use",
  comandaId: string | null
): string {
  if (type === "add") return "Depósito";
  return comandaId ? "Uso na comanda" : "Remoção";
}

function DarkLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-[#f5f5f5]">
      {children}
    </Label>
  );
}

export function CustomerFinancePanel({
  customerId,
  creditBalanceCents,
  comandas,
  creditTransactions,
}: CustomerFinancePanelProps) {
  const router = useRouter();
  const [amountInput, setAmountInput] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreditChange(mode: "add" | "remove") {
    const amountCents = parsePriceBRLInput(amountInput);
    if (amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (mode === "remove" && amountCents > creditBalanceCents) {
      toast.error(
        `Saldo insuficiente. Disponível: ${formatPriceBRL(creditBalanceCents)}.`
      );
      return;
    }

    setSaving(true);
    const result =
      mode === "add"
        ? await addManualCreditAction(
            customerId,
            amountCents,
            description.trim() || undefined
          )
        : await removeManualCreditAction(
            customerId,
            amountCents,
            description.trim() || undefined
          );

    if (result.ok) {
      toast.success(
        mode === "add" ? "Crédito adicionado." : "Crédito removido."
      );
      setAmountInput("");
      setDescription("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  return (
    <div className={cn(ADMIN_SURFACE.panel, "flex flex-col gap-6 p-5 sm:p-6")}>
      <FormSectionTitle
        tone="dark"
        icon={Wallet}
        title="Crédito do cliente"
        description="Saldo disponível para usar em comandas futuras."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
            Saldo disponível
          </p>
          <p className="text-2xl font-semibold tabular-nums text-[#ecf15e]">
            {formatPriceBRL(creditBalanceCents)}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="border-white/10 bg-white/[0.06] font-normal text-[#b4b6bb]"
        >
          Ajuste manual não entra no caixa
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-end">
        <div className="space-y-1.5">
          <DarkLabel htmlFor="credit-amount">Valor</DarkLabel>
          <Input
            id="credit-amount"
            className={cn("tabular-nums", ADMIN_SURFACE.input)}
            placeholder="R$ 0,00"
            value={amountInput}
            onChange={(e) =>
              setAmountInput(formatPriceBRL(parsePriceBRLInput(e.target.value)))
            }
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <DarkLabel htmlFor="credit-description">Descrição (opcional)</DarkLabel>
          <Input
            id="credit-description"
            placeholder="Ex.: antecipou próximos cortes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={ADMIN_SURFACE.input}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void handleCreditChange("add")}
          disabled={saving}
          className={ADMIN_SURFACE.btnPrimary}
        >
          <Plus className="size-4" />
          {saving ? "Salvando..." : "Adicionar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCreditChange("remove")}
          disabled={saving || creditBalanceCents <= 0}
          className={ADMIN_SURFACE.btnGhost}
        >
          <Minus className="size-4" />
          Remover
        </Button>
      </div>

      <Separator className="bg-white/10" />

      <FormSectionTitle
        tone="dark"
        icon={Receipt}
        title="Histórico de comandas"
        description={
          comandas.length === 0
            ? "Nenhuma comanda fechada ainda."
            : `${comandas.length} comanda${comandas.length === 1 ? "" : "s"} fechada${comandas.length === 1 ? "" : "s"}`
        }
      />

      {comandas.length === 0 ? (
        <p className={cn("text-sm", ADMIN_SURFACE.muted)}>
          Quando uma comanda for finalizada, ela aparece aqui com as formas de
          pagamento usadas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comandas.map((comanda) => (
            <li
              key={comanda.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[#f5f5f5]">
                  {formatDateBR(comanda.serviceDate)}
                  {comanda.closedAt
                    ? ` · ${new Date(comanda.closedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </p>
                <p className="font-semibold tabular-nums text-[#ecf15e]">
                  {formatPriceBRL(comanda.totalCents)}
                </p>
              </div>
              <p className={cn("mt-1", ADMIN_SURFACE.muted)}>
                {comanda.professionalNickname}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {comanda.payments.map((payment, index) => (
                  <Badge
                    key={`${comanda.id}-${payment.method}-${index}`}
                    variant="outline"
                    className="border-white/10 bg-transparent font-normal text-[#b4b6bb]"
                  >
                    {PAYMENT_METHOD_LABELS[payment.method]}{" "}
                    {formatPriceBRL(payment.amountCents)}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Separator className="bg-white/10" />

      <FormSectionTitle
        tone="dark"
        icon={Coins}
        title="Histórico de crédito"
        description={
          creditTransactions.length === 0
            ? "Nenhuma movimentação de crédito."
            : `${creditTransactions.length} movimentação${creditTransactions.length === 1 ? "" : "ões"}`
        }
      />

      {creditTransactions.length === 0 ? (
        <p className={cn("text-sm", ADMIN_SURFACE.muted)}>
          Depósitos, remoções e usos de crédito aparecem aqui.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {creditTransactions.map((tx) => (
            <li
              key={tx.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={tx.type === "add" ? "secondary" : "outline"}
                    className={cn(
                      "font-normal",
                      tx.type === "add"
                        ? "border-transparent bg-[rgb(236_241_94_/_14%)] text-[#ecf15e]"
                        : "border-white/10 bg-transparent text-[#b4b6bb]"
                    )}
                  >
                    {formatCreditType(tx.type, tx.comandaId)}
                  </Badge>
                  <span className="font-semibold tabular-nums text-[#f5f5f5]">
                    {tx.type === "add" ? "+" : "-"}
                    {formatPriceBRL(Math.abs(tx.amountCents))}
                  </span>
                </div>
                <span className={cn("text-xs", ADMIN_SURFACE.muted)}>
                  {new Date(tx.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              {tx.paymentMethod && (
                <p className={cn("mt-1", ADMIN_SURFACE.muted)}>
                  Via {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                </p>
              )}
              {tx.description && (
                <p className={cn("mt-1", ADMIN_SURFACE.muted)}>
                  {tx.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
