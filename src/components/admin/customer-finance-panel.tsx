"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Receipt, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FormSectionTitle } from "@/components/admin/form-section";
import { addManualCreditAction } from "@/app/admin/(panel)/clientes/actions";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/comanda-types";
import { formatDateBR, formatPriceBRL, parsePriceBRLInput } from "@/lib/format";

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

function formatCreditType(type: "add" | "use"): string {
  return type === "add" ? "Depósito" : "Uso";
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

  async function handleAddCredit() {
    const amountCents = parsePriceBRLInput(amountInput);
    if (amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    setSaving(true);
    const result = await addManualCreditAction(
      customerId,
      amountCents,
      description.trim() || undefined
    );
    if (result.ok) {
      toast.success("Crédito adicionado.");
      setAmountInput("");
      setDescription("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <FormSectionTitle
          icon={Wallet}
          title="Crédito do cliente"
          description="Saldo disponível para usar em comandas futuras."
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatPriceBRL(creditBalanceCents)}
            </p>
          </div>
          <Badge variant="secondary" className="font-normal">
            Ajuste manual não entra no caixa
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="credit-amount">Adicionar crédito</Label>
            <Input
              id="credit-amount"
              className="tabular-nums"
              placeholder="R$ 0,00"
              value={amountInput}
              onChange={(e) =>
                setAmountInput(formatPriceBRL(parsePriceBRLInput(e.target.value)))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-description">Descrição (opcional)</Label>
            <Input
              id="credit-description"
              placeholder="Ex.: antecipou próximos cortes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleAddCredit()}
            disabled={saving}
          >
            <Coins />
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </div>

        <Separator />

        <FormSectionTitle
          icon={Receipt}
          title="Histórico de comandas"
          description={
            comandas.length === 0
              ? "Nenhuma comanda fechada ainda."
              : `${comandas.length} comanda${comandas.length === 1 ? "" : "s"} fechada${comandas.length === 1 ? "" : "s"}`
          }
        />

        {comandas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Quando uma comanda for finalizada, ela aparece aqui com as formas de
            pagamento usadas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comandas.map((comanda) => (
              <li
                key={comanda.id}
                className="rounded-xl border bg-muted/20 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {formatDateBR(comanda.serviceDate)}
                    {comanda.closedAt
                      ? ` · ${new Date(comanda.closedAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {formatPriceBRL(comanda.totalCents)}
                  </p>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {comanda.professionalNickname}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {comanda.payments.map((payment, index) => (
                    <Badge
                      key={`${comanda.id}-${payment.method}-${index}`}
                      variant="outline"
                      className="font-normal"
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

        <Separator />

        <FormSectionTitle
          icon={Coins}
          title="Histórico de crédito"
          description={
            creditTransactions.length === 0
              ? "Nenhuma movimentação de crédito."
              : `${creditTransactions.length} movimentação${creditTransactions.length === 1 ? "" : "ões"}`
          }
        />

        {creditTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Depósitos e usos de crédito aparecem aqui.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {creditTransactions.map((tx) => (
              <li
                key={tx.id}
                className="rounded-xl border bg-muted/20 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={tx.type === "add" ? "secondary" : "outline"}
                      className="font-normal"
                    >
                      {formatCreditType(tx.type)}
                    </Badge>
                    <span className="font-semibold tabular-nums">
                      {tx.type === "add" ? "+" : "-"}
                      {formatPriceBRL(Math.abs(tx.amountCents))}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                {tx.paymentMethod && (
                  <p className="mt-1 text-muted-foreground">
                    Via {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                  </p>
                )}
                {tx.description && (
                  <p className="mt-1 text-muted-foreground">{tx.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
