"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  MessageCircle,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from "@/components/ui/separator";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import type { ServiceOption } from "@/components/admin/new-appointment-dialog";
import {
  closeComandaAction,
  loadComandaForAppointment,
  reopenComandaAction,
  saveComandaItems,
} from "@/app/admin/(panel)/comandas/actions";
import { cancelAppointment } from "@/app/admin/(panel)/agenda/actions";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  STATUS_LABELS,
} from "@/lib/appointment-status";
import { agendaAppointmentClass } from "@/lib/agenda-colors";
import {
  calculateComandaTotals,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type ComandaDetail,
  type ComandaItemInput,
  type PaymentMethod,
} from "@/lib/comanda-types";
import {
  formatDateBR,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type EditableItem = ComandaItemInput & { localKey: string };

type PaymentRow = {
  localKey: string;
  paymentMethod: PaymentMethod;
  amountCents: number;
};

type ComandaDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showProfessional: boolean;
  professionalPhotoUrl?: string | null;
  servicesCatalog: ServiceOption[];
  commissionPercent?: number;
  onEditSchedule?: () => void;
};

function parsePriceInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

function newLocalKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ComandaDialog({
  appointment,
  open,
  onOpenChange,
  showProfessional,
  professionalPhotoUrl = null,
  servicesCatalog,
  commissionPercent = 50,
  onEditSchedule,
}: ComandaDialogProps) {
  const router = useRouter();
  const [comanda, setComanda] = useState<ComandaDetail | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [addServiceId, setAddServiceId] = useState("");

  const load = useCallback(async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const result = await loadComandaForAppointment(appointment.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setComanda(result.comanda);
      setIsOwner(result.isOwner);
      setItems(
        result.comanda.items.map((item) => ({
          localKey: item.id,
          id: item.id,
          serviceId: item.serviceId ?? "",
          serviceName: item.serviceName,
          catalogPriceCents: item.catalogPriceCents,
          chargedPriceCents: item.chargedPriceCents,
        }))
      );
      if (result.comanda.status === "closed") {
        setPayments(
          result.comanda.payments.map((p) => ({
            localKey: p.id,
            paymentMethod: p.paymentMethod,
            amountCents: p.amountCents,
          }))
        );
      } else {
        setPayments([
          {
            localKey: newLocalKey(),
            paymentMethod: "pix",
            amountCents: result.comanda.totalCents,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [appointment]);

  useEffect(() => {
    if (open && appointment) {
      void load();
    } else {
      setComanda(null);
      setConfirmCancel(false);
    }
  }, [open, appointment, load]);

  const totals = useMemo(
    () =>
      calculateComandaTotals(
        items.map((i) => ({ chargedPriceCents: i.chargedPriceCents })),
        comanda?.commissionPercentSnapshot ?? commissionPercent
      ),
    [items, comanda?.commissionPercentSnapshot, commissionPercent]
  );

  const paymentsSum = useMemo(
    () => payments.reduce((s, p) => s + p.amountCents, 0),
    [payments]
  );

  if (!appointment) return null;

  const customerName = `${appointment.customerFirstName} ${appointment.customerLastName}`;
  const whatsappLink = `https://wa.me/55${appointment.customerWhatsapp}`;
  const isClosed = comanda?.status === "closed";
  const isActive = (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(
    appointment.status
  );
  const canEdit = isOwner && !isClosed && appointment.status !== "cancelled";

  function updateItemPrice(localKey: string, value: string) {
    const cents = parsePriceInput(value);
    setItems((prev) =>
      prev.map((item) =>
        item.localKey === localKey
          ? { ...item, chargedPriceCents: cents }
          : item
      )
    );
  }

  function removeItem(localKey: string) {
    setItems((prev) => prev.filter((i) => i.localKey !== localKey));
  }

  function addService() {
    const svc = servicesCatalog.find((s) => s.id === addServiceId);
    if (!svc) return;
    setItems((prev) => [
      ...prev,
      {
        localKey: newLocalKey(),
        serviceId: svc.id,
        serviceName: svc.name,
        catalogPriceCents: svc.priceCents,
        chargedPriceCents: svc.priceCents,
      },
    ]);
    setAddServiceId("");
  }

  async function handleSaveItems() {
    if (!comanda) return;
    setBusy(true);
    const result = await saveComandaItems(
      comanda.id,
      items.map(({ localKey: _k, id: _id, ...item }) => item)
    );
    if (result.ok) {
      toast.success("Comanda atualizada.");
      setComanda(result.comanda);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleClose() {
    if (!comanda) return;
    if (paymentsSum !== totals.totalCents) {
      toast.error("A soma dos pagamentos deve ser igual ao total da comanda.");
      return;
    }
    setBusy(true);
    const result = await closeComandaAction(
      comanda.id,
      payments.map(({ paymentMethod, amountCents }) => ({
        paymentMethod,
        amountCents,
      }))
    );
    if (result.ok) {
      toast.success("Comanda fechada.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleReopen() {
    if (!comanda) return;
    setBusy(true);
    const result = await reopenComandaAction(comanda.id);
    if (result.ok) {
      toast.success("Comanda reaberta.");
      setComanda(result.comanda);
      router.refresh();
      await load();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  async function handleCancel() {
    setBusy(true);
    const result = await cancelAppointment(appointment!.id);
    if (result.ok) {
      toast.success("Agendamento cancelado.");
      setConfirmCancel(false);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  return (
    <>
      <Dialog open={open && !confirmCancel} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Comanda — {customerName}</DialogTitle>
            <DialogDescription>
              Atendimento das {formatTime(appointment.startTime)} às{" "}
              {formatTime(appointment.endTime)}
            </DialogDescription>
          </DialogHeader>

          <div className="border-b bg-muted/25 px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Comanda
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {formatTime(appointment.startTime)}
                  <span className="mx-1.5 font-normal text-muted-foreground">
                    –
                  </span>
                  {formatTime(appointment.endTime)}
                </p>
                <p className="mt-1 truncate text-base font-medium">
                  {customerName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(appointment.date)}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "border-0 font-normal",
                  appointment.status === "cancelled"
                    ? "bg-muted text-muted-foreground"
                    : isClosed
                      ? "bg-neutral-800 text-white"
                      : agendaAppointmentClass(appointment)
                )}
              >
                {isClosed ? "Fechada" : STATUS_LABELS[appointment.status]}
              </Badge>
            </div>

            {showProfessional && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg border bg-background/80 px-3 py-2">
                <ProfessionalAvatar
                  photoUrl={professionalPhotoUrl}
                  name={appointment.professionalNickname}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {appointment.professionalNickname}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Comissão {comanda?.commissionPercentSnapshot ?? commissionPercent}%
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando comanda…</p>
            ) : (
              <div className="flex flex-col gap-4">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <MessageCircle className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium tabular-nums">
                    {formatWhatsapp(appointment.customerWhatsapp)}
                  </span>
                </a>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Scissors className="size-3.5" />
                    Serviços
                  </div>
                  <ul className="overflow-hidden rounded-lg border">
                    {items.map((item, index) => (
                      <li
                        key={item.localKey}
                        className={cn(
                          "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                          index > 0 && "border-t"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.serviceName}</p>
                          {item.catalogPriceCents !== item.chargedPriceCents && (
                            <p className="text-xs text-muted-foreground line-through">
                              Tabela: {formatPriceBRL(item.catalogPriceCents)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canEdit ? (
                            <>
                              <Input
                                className="h-9 w-28 tabular-nums"
                                value={
                                  item.chargedPriceCents > 0
                                    ? formatPriceBRL(item.chargedPriceCents)
                                    : ""
                                }
                                onChange={(e) =>
                                  updateItemPrice(item.localKey, e.target.value)
                                }
                                aria-label={`Valor ${item.serviceName}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 shrink-0 text-destructive"
                                onClick={() => removeItem(item.localKey)}
                                disabled={items.length <= 1 || busy}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-sm tabular-nums font-medium">
                              {formatPriceBRL(item.chargedPriceCents)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {canEdit && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Select value={addServiceId} onValueChange={setAddServiceId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Adicionar serviço…" />
                        </SelectTrigger>
                        <SelectContent>
                          {servicesCatalog.map((svc) => (
                            <SelectItem key={svc.id} value={svc.id}>
                              {svc.name} — {formatPriceBRL(svc.priceCents)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addService}
                        disabled={!addServiceId || busy}
                        className="shrink-0"
                      >
                        <Plus />
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-semibold tabular-nums">
                      {formatPriceBRL(totals.totalCents)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>Comissão barbeiro</span>
                    <span className="tabular-nums">
                      {formatPriceBRL(totals.commissionCents)}
                    </span>
                  </div>
                </div>

                {(canEdit || isClosed) && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Pagamento
                      </Label>
                      <div className="mt-2 flex flex-col gap-2">
                        {payments.map((row) => (
                          <div
                            key={row.localKey}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <Select
                              value={row.paymentMethod}
                              onValueChange={(v) =>
                                setPayments((prev) =>
                                  prev.map((p) =>
                                    p.localKey === row.localKey
                                      ? {
                                          ...p,
                                          paymentMethod: v as PaymentMethod,
                                        }
                                      : p
                                  )
                                )
                              }
                              disabled={!canEdit || busy}
                            >
                              <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_METHODS.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {PAYMENT_METHOD_LABELS[m]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="tabular-nums sm:w-32"
                              value={
                                row.amountCents > 0
                                  ? formatPriceBRL(row.amountCents)
                                  : ""
                              }
                              onChange={(e) => {
                                const cents = parsePriceInput(e.target.value);
                                setPayments((prev) =>
                                  prev.map((p) =>
                                    p.localKey === row.localKey
                                      ? { ...p, amountCents: cents }
                                      : p
                                  )
                                );
                              }}
                              disabled={!canEdit || busy}
                            />
                            {canEdit && payments.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setPayments((prev) =>
                                    prev.filter((p) => p.localKey !== row.localKey)
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {canEdit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() =>
                              setPayments((prev) => [
                                ...prev,
                                {
                                  localKey: newLocalKey(),
                                  paymentMethod: "cash",
                                  amountCents: Math.max(
                                    0,
                                    totals.totalCents - paymentsSum
                                  ),
                                },
                              ])
                            }
                          >
                            <Plus />
                            Outra forma de pagamento
                          </Button>
                        )}
                        {canEdit && paymentsSum !== totals.totalCents && (
                          <p className="text-xs text-destructive">
                            Falta {formatPriceBRL(totals.totalCents - paymentsSum)}{" "}
                            para fechar a comanda.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t bg-muted/20 px-5 py-4">
            {canEdit && (
              <div className="flex flex-col gap-2">
                {onEditSchedule && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={onEditSchedule}
                    disabled={busy}
                  >
                    Editar horário e cliente
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveItems}
                  disabled={busy || loading || items.length === 0}
                >
                  Salvar serviços
                </Button>
                <Button
                  type="button"
                  onClick={handleClose}
                  disabled={busy || loading || paymentsSum !== totals.totalCents}
                >
                  <Check />
                  Fechar comanda
                </Button>
              </div>
            )}

            {isOwner && isClosed && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleReopen}
                disabled={busy}
              >
                <RotateCcw />
                Reabrir comanda
              </Button>
            )}

            {isOwner && isActive && !isClosed && (
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
              >
                <X />
                Cancelar horário
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar agendamento?</DialogTitle>
            <DialogDescription>
              Nenhum valor será lançado no caixa. O horário será liberado na agenda.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={busy}>
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
