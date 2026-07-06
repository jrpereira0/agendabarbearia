"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Coins,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Scissors,
  Trash2,
  Wallet,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/admin/search-input";
import { DialogSection } from "@/components/admin/dialog-section";
import { TimeSlotGrid } from "@/components/admin/time-slot-grid";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import type {
  ProfessionalOption,
  ServiceOption,
} from "@/components/admin/new-appointment-dialog";
import {
  ACTIVE_APPOINTMENT_STATUSES,
} from "@/lib/appointment-status";
import {
  calculateComandaTotalsByProfessional,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type ComandaDetail,
  type ComandaItemInput,
  type ComandaLinkedAppointment,
  type PaymentMethod,
} from "@/lib/comanda-types";
import {
  formatDateBR,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { adminWideDialogClassName } from "@/lib/admin-dialog";
import { matchesSearch } from "@/lib/text";
import { encaixeTimeSlots, findAppointmentConflicts } from "@/lib/encaixe";
import { timeToMinutes } from "@/lib/availability";
import {
  cancelAppointment,
} from "@/app/admin/(panel)/agenda/actions";
import {
  closeComandaAction,
  loadComandaForAppointment,
  reopenComandaAction,
  saveComandaItems,
} from "@/app/admin/(panel)/comandas/actions";

type EditableItem = ComandaItemInput & {
  localKey: string;
  professionalNickname?: string;
  squeezeAppointmentId?: string | null;
};

function mapComandaItemsToEditable(
  comandaItems: ComandaDetail["items"]
): EditableItem[] {
  return comandaItems
    .filter((item) => !item.isTip)
    .map((item) => ({
    localKey: item.id,
    id: item.id,
    serviceId: item.serviceId ?? "",
    serviceName: item.serviceName,
    catalogPriceCents: item.catalogPriceCents,
    chargedPriceCents: item.chargedPriceCents,
    appointmentId: item.appointmentId ?? undefined,
    squeezeAppointmentId: item.squeezeAppointmentId,
    professionalId: item.professionalId ?? undefined,
    professionalNickname: item.professionalNickname,
  }));
}

function buildPersistItems(
  serviceItems: EditableItem[],
  tipCents: number,
  tipProfessionalId: string
): ComandaItemInput[] {
  const payload = serviceItems.map(stripEditableItem);
  if (tipCents > 0) {
    payload.push({
      serviceName: "Gorjeta",
      catalogPriceCents: tipCents,
      chargedPriceCents: tipCents,
      professionalId: tipProfessionalId,
      isTip: true,
    });
  }
  return payload;
}

function stripEditableItem(item: EditableItem): ComandaItemInput {
  const {
    localKey: _k,
    id,
    professionalNickname: _pn,
    squeezeAppointmentId: _sq,
    ...rest
  } = item;
  return { ...rest, ...(id ? { id } : {}) };
}

type PaymentRow = {
  localKey: string;
  paymentMethod: PaymentMethod;
  amountCents: number;
};

type ComandaProfessionalOption = ProfessionalOption & {
  commissionPercent: number;
};

type ComandaDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicesCatalog: ServiceOption[];
  professionals?: ComandaProfessionalOption[];
  sessionProfessionalId?: string | null;
  commissionPercent?: number;
  slotStepMinutes?: number;
  appointments?: AppointmentItem[];
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
  servicesCatalog,
  professionals = [],
  sessionProfessionalId = null,
  commissionPercent = 50,
  slotStepMinutes = 15,
  appointments = [],
  onEditSchedule,
}: ComandaDialogProps) {
  const router = useRouter();
  const servicePickerRef = useRef<HTMLDivElement>(null);
  const [comanda, setComanda] = useState<ComandaDetail | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [cashRegisterOpen, setCashRegisterOpen] = useState(false);
  const [openCashRegisterDate, setOpenCashRegisterDate] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [cashReceivedCents, setCashReceivedCents] = useState(0);
  const [focusAppointmentId, setFocusAppointmentId] = useState<string | null>(
    null
  );
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelTargetLabel, setCancelTargetLabel] = useState<string | null>(null);
  const [pendingExtraService, setPendingExtraService] =
    useState<ServiceOption | null>(null);
  const [extraProfessionalId, setExtraProfessionalId] = useState("");
  const [extraStartTime, setExtraStartTime] = useState("");
  const [tipCents, setTipCents] = useState(0);
  const [tipProfessionalId, setTipProfessionalId] = useState("");

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
      setCashRegisterOpen(result.cashRegisterOpen);
      setOpenCashRegisterDate(result.openCashRegisterDate);
      const tipItem = result.comanda.items.find((item) => item.isTip);
      setItems(mapComandaItemsToEditable(result.comanda.items));
      setTipCents(tipItem?.chargedPriceCents ?? 0);
      setTipProfessionalId(
        tipItem?.professionalId ??
          appointment.professionalId ??
          sessionProfessionalId ??
          ""
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
        const total = result.comanda.items.reduce(
          (s, i) => s + i.chargedPriceCents,
          0
        );
        setPayments([
          {
            localKey: newLocalKey(),
            paymentMethod: "pix",
            amountCents: total,
          },
        ]);
      }
      setCashReceivedCents(0);
    } finally {
      setLoading(false);
    }
  }, [appointment]);

  useEffect(() => {
    if (open && appointment) {
      setFocusAppointmentId(appointment.id);
      void load();
    } else {
      setComanda(null);
      setConfirmCancel(false);
      setCashReceivedCents(0);
      setServiceSearch("");
      setServicePickerOpen(false);
      setFocusAppointmentId(null);
      setCancelReason("");
      setCancelTargetId(null);
      setCancelTargetLabel(null);
      setPendingExtraService(null);
      setExtraProfessionalId("");
      setExtraStartTime("");
      setTipCents(0);
      setTipProfessionalId("");
    }
  }, [open, appointment?.id, load]);

  useEffect(() => {
    if (!servicePickerOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        servicePickerRef.current &&
        !servicePickerRef.current.contains(event.target as Node)
      ) {
        setServicePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [servicePickerOpen]);

  const commissionByProfessional = useMemo(() => {
    const map = new Map<string, number>();
    for (const pro of professionals) {
      map.set(pro.id, pro.commissionPercent);
    }
    return map;
  }, [professionals]);

  const totals = useMemo(() => {
    if (comanda?.status === "closed") {
      return {
        totalCents: comanda.totalCents,
        commissionCents: comanda.commissionCents,
      };
    }
    return calculateComandaTotalsByProfessional(
      [
        ...items.map((item) => ({
          chargedPriceCents: item.chargedPriceCents,
          professionalId: item.professionalId ?? null,
        })),
        ...(tipCents > 0 && tipProfessionalId
          ? [
              {
                chargedPriceCents: tipCents,
                professionalId: tipProfessionalId,
                isTip: true as const,
              },
            ]
          : []),
      ],
      commissionByProfessional
    );
  }, [items, comanda, commissionByProfessional, tipCents, tipProfessionalId]);

  const paymentsSum = useMemo(
    () => payments.reduce((s, p) => s + p.amountCents, 0),
    [payments]
  );

  const changeCents = useMemo(() => {
    if (cashReceivedCents <= 0) return 0;
    return Math.max(0, cashReceivedCents - totals.totalCents);
  }, [cashReceivedCents, totals.totalCents]);

  const hasCashPayment = payments.some((p) => p.paymentMethod === "cash");

  const filteredServices = useMemo(() => {
    if (!appointment) return [];

    const linked =
      comanda?.linkedAppointments ??
      [
        {
          id: appointment.id,
          professionalId: appointment.professionalId,
          professionalNickname: appointment.professionalNickname,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status,
          isSqueezeIn: appointment.isSqueezeIn ?? false,
        },
      ];

    const linkedProIds = new Set(linked.map((apt) => apt.professionalId));
    const allowed = new Set(
      professionals
        .filter((pro) => linkedProIds.has(pro.id))
        .flatMap((pro) => pro.serviceIds)
    );
    const base = servicesCatalog.filter((svc) => allowed.has(svc.id));
    if (!serviceSearch.trim()) return base;
    return base.filter((svc) => matchesSearch(svc.name, serviceSearch));
  }, [
    appointment,
    comanda?.linkedAppointments,
    servicesCatalog,
    serviceSearch,
    professionals,
  ]);

  const linkedAppointmentsForMemo = useMemo((): ComandaLinkedAppointment[] => {
    if (!appointment) return [];
    return (
      comanda?.linkedAppointments ?? [
        {
          id: appointment.id,
          professionalId: appointment.professionalId,
          professionalNickname: appointment.professionalNickname,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status,
          isSqueezeIn: appointment.isSqueezeIn ?? false,
        },
      ]
    );
  }, [appointment, comanda?.linkedAppointments]);

  const extraTimeSlots = useMemo(
    () => encaixeTimeSlots(slotStepMinutes),
    [slotStepMinutes]
  );

  const extraServiceDuration = pendingExtraService?.durationMinutes ?? 0;

  const extraConflicts = useMemo(() => {
    if (!extraStartTime || !extraProfessionalId || extraServiceDuration <= 0) {
      return [];
    }
    return findAppointmentConflicts(
      extraProfessionalId,
      extraStartTime,
      extraServiceDuration,
      appointments.map((apt) => ({
        id: apt.id,
        customerFirstName: apt.customerFirstName,
        customerLastName: apt.customerLastName,
        startTime: apt.startTime,
        endTime: apt.endTime,
        professionalId: apt.professionalId,
        status: apt.status,
        isSqueezeIn: apt.isSqueezeIn,
      }))
    );
  }, [
    extraStartTime,
    extraProfessionalId,
    extraServiceDuration,
    appointments,
  ]);

  const eligibleExtraProfessionals = useMemo(() => {
    if (!pendingExtraService) return [];
    return professionals.filter((pro) =>
      pro.serviceIds.includes(pendingExtraService.id)
    );
  }, [pendingExtraService, professionals]);

  if (!appointment) return null;

  const linkedAppointments = linkedAppointmentsForMemo;

  const customerName = comanda
    ? `${comanda.customerFirstName} ${comanda.customerLastName}`
    : `${appointment.customerFirstName} ${appointment.customerLastName}`;
  const customerWhatsapp =
    comanda?.customerWhatsapp ?? appointment.customerWhatsapp;
  const serviceDate = comanda?.serviceDate ?? appointment.date;
  const whatsappLink = `https://wa.me/55${customerWhatsapp}`;
  const isClosed = comanda?.status === "closed";
  const hasActiveLinked = linkedAppointments.some((apt) =>
    (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)
  );
  const canEdit = isOwner && !isClosed && hasActiveLinked;

  function getItemProfessionalName(item: EditableItem): string {
    if (item.professionalNickname && item.professionalNickname !== "—") {
      return item.professionalNickname;
    }
    if (item.professionalId) {
      const fromPro = professionals.find((p) => p.id === item.professionalId);
      if (fromPro?.nickname) return fromPro.nickname;
      const fromLinked = linkedAppointments.find(
        (apt) => apt.professionalId === item.professionalId
      );
      if (fromLinked?.professionalNickname) return fromLinked.professionalNickname;
    }
    return "—";
  }

  const focusAppointment =
    linkedAppointments.find((apt) => apt.id === focusAppointmentId) ??
    linkedAppointments[0];

  function canCancelLinkedAppointment(apt: ComandaLinkedAppointment): boolean {
    if (isClosed) return false;
    if (!(ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(apt.status)) {
      return false;
    }
    return isOwner || apt.professionalId === sessionProfessionalId;
  }

  function getCancelTargetForItem(item: EditableItem): string | null {
    if (item.squeezeAppointmentId) {
      const apt = linkedAppointments.find(
        (linked) => linked.id === item.squeezeAppointmentId
      );
      if (apt && canCancelLinkedAppointment(apt)) {
        return item.squeezeAppointmentId;
      }
      return null;
    }

    if (item.appointmentId && item.id) {
      const apt = linkedAppointments.find(
        (linked) => linked.id === item.appointmentId && !linked.isSqueezeIn
      );
      if (apt && canCancelLinkedAppointment(apt)) {
        return item.appointmentId;
      }
    }

    return null;
  }

  function canRemoveItemFromComanda(item: EditableItem): boolean {
    return canEdit && !getCancelTargetForItem(item) && items.length > 1;
  }

  function handleItemTrash(item: EditableItem) {
    const cancelTarget = getCancelTargetForItem(item);
    if (cancelTarget) {
      openCancelDialog(cancelTarget, item.serviceName);
      return;
    }

    if (canRemoveItemFromComanda(item)) {
      void removeItem(item.localKey);
    }
  }

  function isItemTrashDisabled(item: EditableItem): boolean {
    if (busy || isClosed) return true;
    return !getCancelTargetForItem(item) && !canRemoveItemFromComanda(item);
  }

  const appointmentToCancel =
    linkedAppointments.find(
      (apt) => apt.id === (cancelTargetId ?? focusAppointmentId)
    ) ?? focusAppointment;

  const canCancelFocused = appointmentToCancel
    ? canCancelLinkedAppointment(appointmentToCancel)
    : false;

  const tipEligibleProfessionals = useMemo(() => {
    const linkedProIds = new Set(
      linkedAppointmentsForMemo.map((apt) => apt.professionalId)
    );
    return professionals.filter((pro) => linkedProIds.has(pro.id));
  }, [linkedAppointmentsForMemo, professionals]);

  const paymentMismatch = canEdit && paymentsSum !== totals.totalCents;

  function syncSinglePaymentToTotal(nextTotal: number) {
    setPayments((prev) =>
      prev.length === 1 ? [{ ...prev[0], amountCents: nextTotal }] : prev
    );
  }

  function handleTipCentsChange(value: string) {
    const cents = parsePriceInput(value);
    setTipCents(cents);
    if (canEdit) {
      const servicesTotal = items.reduce(
        (sum, item) => sum + item.chargedPriceCents,
        0
      );
      syncSinglePaymentToTotal(servicesTotal + cents);
    }
  }

  const persistItems = async (
    nextItems: EditableItem[],
    nextTipCents = tipCents,
    nextTipProfessionalId = tipProfessionalId
  ): Promise<boolean> => {
    if (!comanda || !canEdit) return false;

    if (nextTipCents > 0 && !nextTipProfessionalId) {
      toast.error("Escolha o barbeiro que recebe a gorjeta.");
      return false;
    }

    setBusy(true);
    try {
      const result = await saveComandaItems(
        comanda.id,
        buildPersistItems(nextItems, nextTipCents, nextTipProfessionalId)
      );
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }

      setComanda(result.comanda);
      const savedTip = result.comanda.items.find((item) => item.isTip);
      setItems(mapComandaItemsToEditable(result.comanda.items));
      setTipCents(savedTip?.chargedPriceCents ?? 0);
      setTipProfessionalId(savedTip?.professionalId ?? nextTipProfessionalId);
      setPayments((prev) =>
        prev.length === 1
          ? [{ ...prev[0], amountCents: result.comanda.totalCents }]
          : prev
      );
      return true;
    } finally {
      setBusy(false);
    }
  };

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

  async function commitItemPrice(localKey: string, value: string) {
    if (!canEdit || busy) return;
    const cents = parsePriceInput(value);
    const previous = items;
    const nextItems = items.map((item) =>
      item.localKey === localKey
        ? { ...item, chargedPriceCents: cents }
        : item
    );
    setItems(nextItems);
    const ok = await persistItems(nextItems);
    if (!ok) setItems(previous);
  }

  async function removeItem(localKey: string) {
    if (!canEdit || busy || items.length <= 1) return;
    const previous = items;
    const nextItems = items.filter((i) => i.localKey !== localKey);
    setItems(nextItems);
    const ok = await persistItems(nextItems);
    if (!ok) setItems(previous);
  }

  async function pickService(svc: ServiceOption) {
    if (!canEdit || busy) return;
    const eligible = professionals.filter((pro) => pro.serviceIds.includes(svc.id));
    if (eligible.length === 0) {
      toast.error("Nenhum barbeiro faz este serviço.");
      return;
    }

    const linkedProIds = new Set(linkedAppointments.map((apt) => apt.professionalId));
    const defaultPro =
      eligible.find((pro) => linkedProIds.has(pro.id)) ??
      eligible.find((pro) => pro.id === sessionProfessionalId) ??
      eligible[0];

    setPendingExtraService(svc);
    setExtraProfessionalId(defaultPro?.id ?? "");
    setExtraStartTime("");
    setServiceSearch("");
    setServicePickerOpen(false);
  }

  async function confirmExtraService() {
    if (!pendingExtraService || !canEdit || busy) return;

    if (!extraProfessionalId) {
      toast.error("Escolha o barbeiro.");
      return;
    }
    if (!extraStartTime) {
      toast.error("Escolha o horário.");
      return;
    }

    const contextApt =
      linkedAppointments.find((apt) => !apt.isSqueezeIn) ??
      linkedAppointments[0];
    if (!contextApt) {
      toast.error("Não há agendamento ativo nesta comanda.");
      return;
    }

    const pro = professionals.find((p) => p.id === extraProfessionalId);
    const previous = items;
    const nextItems: EditableItem[] = [
      ...items,
      {
        localKey: newLocalKey(),
        serviceId: pendingExtraService.id,
        serviceName: pendingExtraService.name,
        catalogPriceCents: pendingExtraService.priceCents,
        chargedPriceCents: pendingExtraService.priceCents,
        appointmentId: contextApt.id,
        professionalId: extraProfessionalId,
        professionalNickname: pro?.nickname,
        startTime: extraStartTime,
        isComandaExtra: true,
      },
    ];

    setItems(nextItems);
    const ok = await persistItems(nextItems);
    if (ok) {
      setPendingExtraService(null);
      setExtraProfessionalId("");
      setExtraStartTime("");
      toast.success("Serviço extra adicionado.");
    } else {
      setItems(previous);
    }
  }

  async function handleClose() {
    if (!comanda) return;
    if (paymentsSum !== totals.totalCents) {
      toast.error("A soma dos pagamentos deve ser igual ao total da comanda.");
      return;
    }
    setBusy(true);
    const saved = await saveComandaItems(
      comanda.id,
      buildPersistItems(items, tipCents, tipProfessionalId)
    );
    if (!saved.ok) {
      toast.error(saved.error);
      setBusy(false);
      return;
    }
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
    const targetId = cancelTargetId ?? focusAppointmentId;
    if (!targetId) return;

    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }

    setBusy(true);
    const result = await cancelAppointment({
      appointmentId: targetId,
      reason,
    });
    if (result.ok) {
      toast.success("Agendamento cancelado.");
      setConfirmCancel(false);
      setCancelReason("");
      setCancelTargetId(null);
      setCancelTargetLabel(null);
      const remaining = linkedAppointments.filter((apt) => apt.id !== targetId);
      if (remaining.length === 0) {
        onOpenChange(false);
      } else {
        if (focusAppointmentId === targetId) {
          setFocusAppointmentId(remaining[0]?.id ?? null);
        }
        await load();
      }
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  function openCancelDialog(appointmentId: string, serviceLabel?: string) {
    setCancelTargetId(appointmentId);
    setFocusAppointmentId(appointmentId);
    setCancelTargetLabel(serviceLabel ?? null);
    setCancelReason("");
    setConfirmCancel(true);
  }

  return (
    <>
      <Dialog
        open={open && !confirmCancel && !pendingExtraService}
        onOpenChange={onOpenChange}
      >
        <DialogContent className={adminWideDialogClassName()}>
          <DialogHeader className="sr-only">
            <DialogTitle>Comanda — {customerName}</DialogTitle>
            <DialogDescription>
              Comanda do dia {formatDateBR(serviceDate)} —{" "}
              {linkedAppointments.length} atendimento
              {linkedAppointments.length === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>

          {/* Cabeçalho */}
          <div className="shrink-0 border-b bg-muted/20 px-4 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cliente
                </p>
                <p className="text-xl font-semibold leading-tight">
                  {customerName}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <MessageCircle className="size-4" />
                    <span className="tabular-nums">
                      {formatWhatsapp(customerWhatsapp)}
                    </span>
                  </a>
                </div>
                {linkedAppointments.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {linkedAppointments.length} atendimentos nesta comanda
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:items-end sm:text-right">
                <Badge
                  variant="secondary"
                  className={cn(
                    "w-fit sm:ml-auto",
                    isClosed
                      ? "bg-neutral-800 text-white"
                      : "bg-background text-foreground"
                  )}
                >
                  {isClosed ? "Comanda fechada" : "Comanda aberta"}
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground">Dia</p>
                  <p className="font-semibold tabular-nums">
                    {formatDateBR(serviceDate)}
                  </p>
                  {linkedAppointments.length === 1 && focusAppointment && (
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatTime(focusAppointment.startTime)} –{" "}
                      {formatTime(focusAppointment.endTime)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">
                Carregando comanda…
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <DialogSection
                icon={Scissors}
                title="Serviços"
                description="Itens do atendimento e valores cobrados."
                headerAction={
                  canEdit ? (
                    <div
                      ref={servicePickerRef}
                      className="relative w-full sm:max-w-xs sm:shrink-0"
                    >
                      <SearchInput
                        value={serviceSearch}
                        onChange={(value) => {
                          setServiceSearch(value);
                          setServicePickerOpen(true);
                        }}
                        onFocus={() => setServicePickerOpen(true)}
                        placeholder="Buscar serviço para adicionar…"
                      />
                      {servicePickerOpen && (
                        <ul
                          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-popover py-1 shadow-md"
                          role="listbox"
                        >
                          {filteredServices.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhum serviço encontrado.
                            </li>
                          ) : (
                            filteredServices.map((svc) => (
                              <li key={svc.id}>
                                <button
                                  type="button"
                                  role="option"
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                                  onClick={() => pickService(svc)}
                                  disabled={busy}
                                >
                                  <span className="font-medium">{svc.name}</span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {formatPriceBRL(svc.priceCents)}
                                  </span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  ) : undefined
                }
              >
                {/* Mobile: cards */}
                <div className="space-y-3 md:hidden">
                  {items.map((item) => (
                    <div
                      key={item.localKey}
                      className="rounded-lg border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">
                            {item.serviceName}
                          </p>
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              Barbeiro
                            </p>
                            <div className="mt-1">
                              <span className="text-sm">
                                {getItemProfessionalName(item)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {!isClosed &&
                          (getCancelTargetForItem(item) || canEdit) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-destructive"
                            onClick={() => handleItemTrash(item)}
                            disabled={isItemTrashDisabled(item)}
                            title={
                              getCancelTargetForItem(item)
                                ? "Cancelar horário"
                                : "Remover serviço"
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Preço</p>
                          <p className="tabular-nums">
                            {formatPriceBRL(item.catalogPriceCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Valor cobrado
                          </p>
                          {canEdit ? (
                            <Input
                              className="mt-1 h-9 w-full tabular-nums"
                              value={
                                item.chargedPriceCents > 0
                                  ? formatPriceBRL(item.chargedPriceCents)
                                  : ""
                              }
                              onChange={(e) =>
                                updateItemPrice(item.localKey, e.target.value)
                              }
                              onBlur={(e) =>
                                void commitItemPrice(
                                  item.localKey,
                                  e.target.value
                                )
                              }
                              disabled={busy}
                              aria-label={`Valor ${item.serviceName}`}
                            />
                          ) : (
                            <p className="font-semibold tabular-nums">
                              {formatPriceBRL(item.chargedPriceCents)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t px-1 py-3 text-sm font-semibold">
                    <span>Total dos serviços</span>
                    <span className="tabular-nums">
                      {formatPriceBRL(totals.totalCents)}
                    </span>
                  </div>
                </div>

                {/* Desktop: tabela */}
                <div className="hidden overflow-hidden rounded-lg border md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="w-10 px-3 py-2.5 font-medium" />
                        <th className="px-3 py-2.5 font-medium">Serviço</th>
                        <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                          Profissional
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Preço
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          Valor cobrado
                        </th>
                        <th className="w-12 px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.localKey} className="border-b last:border-0">
                          <td className="px-3 py-3 text-muted-foreground">
                            <Scissors className="size-4" />
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {item.serviceName}
                          </td>
                          <td className="hidden px-3 py-3 md:table-cell">
                            {getItemProfessionalName(item)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {formatPriceBRL(item.catalogPriceCents)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {canEdit ? (
                              <Input
                                className="ml-auto h-9 w-28 tabular-nums"
                                value={
                                  item.chargedPriceCents > 0
                                    ? formatPriceBRL(item.chargedPriceCents)
                                    : ""
                                }
                                onChange={(e) =>
                                  updateItemPrice(
                                    item.localKey,
                                    e.target.value
                                  )
                                }
                                onBlur={(e) =>
                                  void commitItemPrice(
                                    item.localKey,
                                    e.target.value
                                  )
                                }
                                disabled={busy}
                                aria-label={`Valor ${item.serviceName}`}
                              />
                            ) : (
                              <span className="font-semibold tabular-nums">
                                {formatPriceBRL(item.chargedPriceCents)}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {!isClosed &&
                              (getCancelTargetForItem(item) || canEdit) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => handleItemTrash(item)}
                                disabled={isItemTrashDisabled(item)}
                                title={
                                  getCancelTargetForItem(item)
                                    ? "Cancelar horário"
                                    : "Remover serviço"
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-medium">
                        <td
                          colSpan={4}
                          className="px-3 py-3 text-right text-sm"
                        >
                          Total dos serviços
                        </td>
                        <td className="px-3 py-3 text-right text-base font-semibold tabular-nums">
                          {formatPriceBRL(totals.totalCents)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </DialogSection>

              {canEdit && !cashRegisterOpen && isOwner && (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  {openCashRegisterDate &&
                  openCashRegisterDate !== serviceDate ? (
                    <>
                      O caixa aberto é do dia{" "}
                      {formatDateBR(openCashRegisterDate)}. Esta comanda é do dia{" "}
                      {formatDateBR(serviceDate)} — só dá para finalizar comandas do
                      dia do caixa aberto.
                    </>
                  ) : (
                    <>
                      Não há caixa aberto para o dia {formatDateBR(serviceDate)}.
                      Abra o caixa em{" "}
                      <Link
                        href={`/admin/financeiro?date=${serviceDate}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Financeiro
                      </Link>{" "}
                      antes de finalizar comandas.
                    </>
                  )}
                </div>
              )}

              {(canEdit || isClosed) && (
                <div className="grid gap-4 lg:grid-cols-3">
                  {canEdit && (
                    <DialogSection icon={Coins} title="Gorjeta">
                      <p className="mb-3 text-xs text-muted-foreground">
                        Opcional. O barbeiro recebe 100% do valor.
                      </p>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="tip-amount">Valor</Label>
                          <Input
                            id="tip-amount"
                            className="h-9 tabular-nums bg-background"
                            value={tipCents > 0 ? formatPriceBRL(tipCents) : ""}
                            onChange={(e) => handleTipCentsChange(e.target.value)}
                            onBlur={() => {
                              if (tipCents > 0) {
                                void persistItems(items, tipCents, tipProfessionalId);
                              }
                            }}
                            placeholder="R$ 0,00"
                            disabled={busy}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Barbeiro</Label>
                          <Select
                            value={tipProfessionalId}
                            onValueChange={(value) => {
                              setTipProfessionalId(value);
                              if (tipCents > 0) {
                                void persistItems(items, tipCents, value);
                              }
                            }}
                            disabled={busy || tipEligibleProfessionals.length === 0}
                          >
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue placeholder="Quem recebe" />
                            </SelectTrigger>
                            <SelectContent>
                              {tipEligibleProfessionals.map((pro) => (
                                <SelectItem key={pro.id} value={pro.id}>
                                  {pro.nickname}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </DialogSection>
                  )}

                  <DialogSection icon={Wallet} title="Formas de pagamento">
                    <div className="space-y-2">
                        {payments.map((row) => (
                          <div
                            key={row.localKey}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 gap-2">
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
                              <SelectTrigger className="h-9 min-w-0 flex-1 bg-background">
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
                              className="h-9 w-full shrink-0 tabular-nums bg-background sm:w-[7.5rem]"
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
                            </div>
                            {canEdit && payments.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0"
                                onClick={() =>
                                  setPayments((prev) =>
                                    prev.filter(
                                      (p) => p.localKey !== row.localKey
                                    )
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
                            className="w-full"
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
                      </div>
                  </DialogSection>

                  <DialogSection icon={Receipt} title="Resumo">
                      <dl className="space-y-2.5 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">
                            Total da comanda
                          </dt>
                          <dd className="font-semibold tabular-nums">
                            {formatPriceBRL(totals.totalCents)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">Valor pago</dt>
                          <dd
                            className={cn(
                              "font-semibold tabular-nums",
                              paymentMismatch && "text-destructive"
                            )}
                          >
                            {formatPriceBRL(paymentsSum)}
                          </dd>
                        </div>
                        {tipCents > 0 && (
                          <div className="flex justify-between gap-4 text-muted-foreground">
                            <dt>
                              Gorjeta
                              {tipProfessionalId
                                ? ` (${tipEligibleProfessionals.find((pro) => pro.id === tipProfessionalId)?.nickname ?? "barbeiro"})`
                                : ""}
                            </dt>
                            <dd className="tabular-nums">
                              {formatPriceBRL(tipCents)}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 border-t pt-2 text-muted-foreground">
                          <dt>Comissão</dt>
                          <dd className="tabular-nums">
                            {formatPriceBRL(totals.commissionCents)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <dt>Barbearia</dt>
                          <dd className="tabular-nums">
                            {formatPriceBRL(
                              totals.totalCents - totals.commissionCents
                            )}
                          </dd>
                        </div>
                      </dl>
                      {paymentMismatch && (
                        <p className="text-xs text-destructive">
                          Falta{" "}
                          {formatPriceBRL(totals.totalCents - paymentsSum)} para
                          fechar.
                        </p>
                      )}
                  </DialogSection>

                  <DialogSection icon={Coins} title="Troco">
                      {canEdit ? (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1.5">
                            <Label
                              htmlFor="cash-received"
                              className="text-xs text-muted-foreground"
                            >
                              Recebido em dinheiro
                            </Label>
                            <Input
                              id="cash-received"
                              className="h-9 tabular-nums bg-background"
                              value={
                                cashReceivedCents > 0
                                  ? formatPriceBRL(cashReceivedCents)
                                  : ""
                              }
                              onChange={(e) =>
                                setCashReceivedCents(
                                  parsePriceInput(e.target.value)
                                )
                              }
                              disabled={busy}
                              placeholder="R$ 0,00"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              Troco a devolver
                            </p>
                            <div className="flex h-9 items-center rounded-md border bg-background px-3 text-base font-semibold tabular-nums">
                              {changeCents > 0
                                ? formatPriceBRL(changeCents)
                                : "—"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="pt-1 text-sm text-muted-foreground">
                          Comanda finalizada · Pago{" "}
                          {formatPriceBRL(paymentsSum)}
                        </p>
                      )}
                      {canEdit && hasCashPayment && cashReceivedCents === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Informe o valor recebido para calcular o troco.
                        </p>
                      )}
                  </DialogSection>
                </div>
              )}
            </div>
          )}

          {/* Rodapé */}
          <div className="shrink-0 border-t bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Fechar
              </Button>
              {canEdit && onEditSchedule && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={onEditSchedule}
                  disabled={busy}
                >
                  <Pencil />
                  Editar agendamento
                </Button>
              )}
              {canCancelFocused && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive sm:w-auto"
                  onClick={() =>
                    openCancelDialog(
                      cancelTargetId ?? focusAppointmentId ?? appointment.id
                    )
                  }
                  disabled={busy}
                >
                  <X />
                  Cancelar horário
                </Button>
              )}
              {isOwner && isClosed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleReopen}
                  disabled={busy}
                >
                  <RotateCcw />
                  Reabrir comanda
                </Button>
              )}

              {canEdit && (
                <>
                  <span className="w-full sm:hidden" aria-hidden />
                  <span
                    className="hidden min-w-0 flex-1 sm:block"
                    aria-hidden
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={handleClose}
                    disabled={
                      busy ||
                      loading ||
                      !cashRegisterOpen ||
                      paymentsSum !== totals.totalCents
                    }
                  >
                    <Check />
                    Finalizar comanda
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCancel}
        onOpenChange={(open) => {
          setConfirmCancel(open);
          if (!open) {
            setCancelReason("");
            setCancelTargetId(null);
            setCancelTargetLabel(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {appointmentToCancel?.isComandaExtra
                ? "Cancelar serviço extra?"
                : appointmentToCancel?.isSqueezeIn
                  ? "Cancelar encaixe?"
                  : "Cancelar agendamento?"}
            </DialogTitle>
            <DialogDescription>
              O horário some da agenda e nenhum valor entra no caixa.
              {cancelTargetLabel && (
                <>
                  {" "}
                  Serviço: <strong>{cancelTargetLabel}</strong>.
                </>
              )}
              {appointmentToCancel && linkedAppointments.length > 1 && (
                <>
                  {" "}
                  Será cancelado o horário de{" "}
                  {appointmentToCancel.professionalNickname} (
                  {formatTime(appointmentToCancel.startTime)}
                  {appointmentToCancel.isComandaExtra
                    ? " · serviço extra"
                    : appointmentToCancel.isSqueezeIn
                      ? " · encaixe"
                      : ""}
                  ).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="cancel-reason">Motivo do cancelamento</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: cliente desmarcou, não compareceu, trocou de horário…"
              rows={3}
              disabled={busy}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmCancel(false);
                setCancelReason("");
                setCancelTargetId(null);
                setCancelTargetLabel(null);
              }}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={busy || cancelReason.trim().length < 3}
            >
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingExtraService !== null}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen && !busy) {
            setPendingExtraService(null);
            setExtraProfessionalId("");
            setExtraStartTime("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Serviço extra</DialogTitle>
            <DialogDescription>
              {pendingExtraService?.name} · {formatDateBR(serviceDate)}. Vai
              para a agenda com a cor de serviço extra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="extra-professional">Barbeiro</Label>
              <Select
                value={extraProfessionalId}
                onValueChange={setExtraProfessionalId}
                disabled={busy}
              >
                <SelectTrigger id="extra-professional" className="w-full">
                  <SelectValue placeholder="Escolha o barbeiro" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleExtraProfessionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Horário</Label>
              {!extraProfessionalId ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  Escolha o barbeiro primeiro.
                </p>
              ) : (
                <TimeSlotGrid
                  slots={extraTimeSlots}
                  value={extraStartTime}
                  onChange={setExtraStartTime}
                  disabled={busy}
                  buttonSize="sm"
                  formatSlot={formatTime}
                  isSlotDisabled={(slot) =>
                    extraServiceDuration > 0 &&
                    timeToMinutes(slot) + extraServiceDuration > 24 * 60
                  }
                />
              )}
              <p className="text-xs text-muted-foreground">
                Pode sobrepor outros horários, como um encaixe.
              </p>
            </div>

            {extraConflicts.length > 0 && extraStartTime && (
              <p className="text-xs text-amber-800">
                Sobrepõe:{" "}
                {extraConflicts
                  .map(
                    (apt) =>
                      `${apt.customerFirstName} ${apt.customerLastName} (${formatTime(apt.startTime)})`
                  )
                  .join(" · ")}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPendingExtraService(null);
                setExtraProfessionalId("");
                setExtraStartTime("");
              }}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmExtraService()}
              disabled={
                busy ||
                !extraProfessionalId ||
                !extraStartTime ||
                !pendingExtraService
              }
            >
              Adicionar à comanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
