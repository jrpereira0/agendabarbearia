"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Coins,
  MessageCircle,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ComandaDialogSkeleton } from "@/components/skeletons/comanda-dialog-skeleton";
import { TimeSlotGrid } from "@/components/admin/time-slot-grid";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import type {
  ProfessionalOption,
  ServiceOption,
} from "@/components/admin/new-appointment-dialog";
import type { ProfessionalPermissions } from "@/lib/professional-permissions";
import { OWNER_PERMISSIONS } from "@/lib/professional-permissions";
import {
  ACTIVE_APPOINTMENT_STATUSES,
} from "@/lib/appointment-status";
import {
  calculateComandaTotalsByProfessional,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type CashInflowPaymentMethod,
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
import { adminComandaDialogClassName } from "@/lib/admin-dialog";
import { matchesSearch } from "@/lib/text";
import type { ProductOption } from "@/lib/product-types";
import { encaixeTimeSlots, findAppointmentConflicts } from "@/lib/encaixe";
import { timeToMinutes } from "@/lib/availability";
import {
  cancelAppointment,
} from "@/app/admin/(panel)/agenda/actions";
import {
  closeComandaWithItemsAction,
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
      serviceId: item.serviceId ?? undefined,
      productId: item.productId ?? undefined,
      serviceName: item.serviceName,
      catalogPriceCents: item.catalogPriceCents,
      chargedPriceCents: item.chargedPriceCents,
      quantity: item.quantity ?? 1,
      commissionPercent: item.commissionPercentSnapshot ?? undefined,
      appointmentId: item.appointmentId ?? undefined,
      squeezeAppointmentId: item.squeezeAppointmentId,
      professionalId: item.professionalId ?? undefined,
      professionalNickname: item.professionalNickname,
    }));
}

function isProductItem(item: EditableItem): boolean {
  return Boolean(item.productId);
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
  permissions?: ProfessionalPermissions;
  servicesCatalog: ServiceOption[];
  productsCatalog?: ProductOption[];
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

function splitPaymentsForClose(
  payments: PaymentRow[],
  totalCents: number
): {
  comandaPayments: Array<{ paymentMethod: PaymentMethod; amountCents: number }>;
  creditDeposits: Array<{
    amountCents: number;
    paymentMethod: CashInflowPaymentMethod;
  }>;
} {
  let remaining = totalCents;
  const comandaPayments: Array<{
    paymentMethod: PaymentMethod;
    amountCents: number;
  }> = [];
  const creditDeposits: Array<{
    amountCents: number;
    paymentMethod: CashInflowPaymentMethod;
  }> = [];

  for (const payment of payments) {
    if (payment.amountCents <= 0) continue;

    if (payment.paymentMethod === "store_credit") {
      const applied = Math.min(payment.amountCents, remaining);
      if (applied > 0) {
        comandaPayments.push({
          paymentMethod: "store_credit",
          amountCents: applied,
        });
        remaining -= applied;
      }
      continue;
    }

    const inflowMethod = payment.paymentMethod as CashInflowPaymentMethod;

    if (remaining <= 0) {
      creditDeposits.push({
        amountCents: payment.amountCents,
        paymentMethod: inflowMethod,
      });
      continue;
    }

    if (payment.amountCents <= remaining) {
      comandaPayments.push({
        paymentMethod: payment.paymentMethod,
        amountCents: payment.amountCents,
      });
      remaining -= payment.amountCents;
    } else {
      comandaPayments.push({
        paymentMethod: payment.paymentMethod,
        amountCents: remaining,
      });
      creditDeposits.push({
        amountCents: payment.amountCents - remaining,
        paymentMethod: inflowMethod,
      });
      remaining = 0;
    }
  }

  return { comandaPayments, creditDeposits };
}

export function ComandaDialog({
  appointment,
  open,
  onOpenChange,
  permissions = OWNER_PERMISSIONS,
  servicesCatalog,
  productsCatalog = [],
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
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<ProductOption | null>(null);
  const [productQuantity, setProductQuantity] = useState("1");
  const [productProfessionalId, setProductProfessionalId] = useState("");
  const productPickerRef = useRef<HTMLDivElement>(null);
  const [tipCents, setTipCents] = useState(0);
  const [tipProfessionalId, setTipProfessionalId] = useState("");
  const [customerCreditBalanceCents, setCustomerCreditBalanceCents] = useState(0);
  const [confirmOverpayCredit, setConfirmOverpayCredit] = useState(false);
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [tipDraftCents, setTipDraftCents] = useState(0);
  const [tipDraftProfessionalId, setTipDraftProfessionalId] = useState("");

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
      setCustomerCreditBalanceCents(result.customerCreditBalanceCents);
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
    } finally {
      setLoading(false);
    }
  }, [appointment, sessionProfessionalId]);

  useEffect(() => {
    if (open && appointment) {
      setFocusAppointmentId(appointment.id);
      void load();
      return;
    }

    if (!open) {
      setComanda(null);
      setConfirmCancel(false);
      setConfirmOverpayCredit(false);
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
      setCustomerCreditBalanceCents(0);
      setTipDialogOpen(false);
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

  useEffect(() => {
    if (!productPickerOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        productPickerRef.current &&
        !productPickerRef.current.contains(event.target as Node)
      ) {
        setProductPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [productPickerOpen]);

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
          productId: item.productId ?? null,
          commissionPercentSnapshot: item.commissionPercent ?? null,
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

  const serviceItems = useMemo(
    () => items.filter((item) => !isProductItem(item)),
    [items]
  );

  const productItems = useMemo(
    () => items.filter((item) => isProductItem(item)),
    [items]
  );

  const servicesTotalCents = useMemo(
    () => serviceItems.reduce((sum, item) => sum + item.chargedPriceCents, 0),
    [serviceItems]
  );

  const productsTotalCents = useMemo(
    () => productItems.reduce((sum, item) => sum + item.chargedPriceCents, 0),
    [productItems]
  );

  const itemsSubtotalCents = servicesTotalCents + productsTotalCents;

  const paymentShortfallCents = Math.max(0, totals.totalCents - paymentsSum);
  const paymentOverpayCents = Math.max(0, paymentsSum - totals.totalCents);

  const availablePaymentMethods = useMemo(() => {
    if (customerCreditBalanceCents > 0) return PAYMENT_METHODS;
    return PAYMENT_METHODS.filter((method) => method !== "store_credit");
  }, [customerCreditBalanceCents]);

  const storeCreditUsedCents = useMemo(
    () =>
      payments
        .filter((payment) => payment.paymentMethod === "store_credit")
        .reduce((sum, payment) => sum + payment.amountCents, 0),
    [payments]
  );

  const creditRemainingCents = Math.max(
    0,
    customerCreditBalanceCents - storeCreditUsedCents
  );

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

  const filteredProducts = useMemo(() => {
    const base = productsCatalog;
    if (!productSearch.trim()) return base;
    return base.filter((product) =>
      matchesSearch(`${product.name} ${product.categoryName}`, productSearch)
    );
  }, [productsCatalog, productSearch]);

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

  const tipEligibleProfessionals = useMemo(() => {
    const linkedProIds = new Set(
      linkedAppointmentsForMemo.map((apt) => apt.professionalId)
    );
    return professionals.filter((pro) => linkedProIds.has(pro.id));
  }, [linkedAppointmentsForMemo, professionals]);

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
  const canEdit =
    (isOwner || permissions.canEditComanda) && !isClosed && hasActiveLinked;
  const canFinalize =
    (isOwner || permissions.canCloseComanda) && !isClosed && hasActiveLinked;

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

  function getItemAppointmentTime(item: EditableItem): string | null {
    const apt = linkedAppointments.find(
      (linked) =>
        linked.id === item.appointmentId ||
        linked.id === item.squeezeAppointmentId
    );
    if (!apt) return null;
    return `${formatTime(apt.startTime)} – ${formatTime(apt.endTime)}`;
  }

  const scheduledLinkedAppointments = linkedAppointments.filter(
    (apt) => !apt.isSqueezeIn
  );
  const showAppointmentTimes = scheduledLinkedAppointments.length > 1;

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
    if (!canEdit || items.length <= 1) return false;
    if (isProductItem(item)) return true;
    return !getCancelTargetForItem(item);
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

  const hasSecondaryActions =
    Boolean(canEdit && onEditSchedule) ||
    canCancelFocused ||
    Boolean(isOwner && isClosed);

  const paymentShortfall = canEdit && paymentShortfallCents > 0;

  function syncSinglePaymentToTotal(nextTotal: number) {
    setPayments((prev) =>
      prev.length === 1 ? [{ ...prev[0], amountCents: nextTotal }] : prev
    );
  }

  function openTipDialog() {
    setTipDraftCents(tipCents);
    setTipDraftProfessionalId(
      tipProfessionalId || tipEligibleProfessionals[0]?.id || ""
    );
    setTipDialogOpen(true);
  }

  function confirmTipDialog() {
    if (tipDraftCents > 0 && !tipDraftProfessionalId) {
      toast.error("Escolha o barbeiro da gorjeta.");
      return;
    }
    setTipCents(tipDraftCents);
    setTipProfessionalId(tipDraftProfessionalId);
    syncSinglePaymentToTotal(itemsSubtotalCents + tipDraftCents);
    setTipDialogOpen(false);
  }

  function removeTip() {
    setTipCents(0);
    setTipProfessionalId("");
    setTipDraftCents(0);
    setTipDraftProfessionalId("");
    syncSinglePaymentToTotal(itemsSubtotalCents);
    setTipDialogOpen(false);
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

  async function confirmAddProduct() {
    if (!pendingProduct || !canEdit || busy) return;

    if (!productProfessionalId) {
      toast.error("Escolha o barbeiro que vendeu.");
      return;
    }

    const qty = Number.parseInt(productQuantity.replace(/\D/g, "") || "0", 10);
    if (qty < 1) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    const pro = professionals.find((p) => p.id === productProfessionalId);
    const lineTotal = pendingProduct.priceCents * qty;
    const previous = items;
    const nextItems: EditableItem[] = [
      ...items,
      {
        localKey: newLocalKey(),
        productId: pendingProduct.id,
        serviceName: pendingProduct.name,
        catalogPriceCents: pendingProduct.priceCents,
        chargedPriceCents: lineTotal,
        quantity: qty,
        commissionPercent: pendingProduct.commissionPercent,
        professionalId: productProfessionalId,
        professionalNickname: pro?.nickname,
      },
    ];

    setItems(nextItems);
    const ok = await persistItems(nextItems);
    if (ok) {
      setPendingProduct(null);
      setProductProfessionalId("");
      setProductQuantity("1");
      setProductSearch("");
      toast.success("Produto adicionado.");
    } else {
      setItems(previous);
    }
  }

  function pickProduct(product: ProductOption) {
    if (!canEdit || busy) return;
    const defaultPro =
      professionals.find((pro) => pro.id === sessionProfessionalId) ??
      professionals[0];

    setPendingProduct(product);
    setProductProfessionalId(defaultPro?.id ?? "");
    setProductQuantity("1");
    setProductSearch("");
    setProductPickerOpen(false);
  }

  async function finalizeComanda(saveOverpayAsCredit: boolean) {
    if (!comanda) return;

    const { comandaPayments, creditDeposits } = splitPaymentsForClose(
      payments,
      totals.totalCents
    );

    setBusy(true);
    const result = await closeComandaWithItemsAction(
      comanda.id,
      buildPersistItems(items, tipCents, tipProfessionalId),
      comandaPayments,
      {
        creditDeposits: saveOverpayAsCredit ? creditDeposits : undefined,
      }
    );
    if (result.ok) {
      toast.success("Comanda fechada.");
      setConfirmOverpayCredit(false);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(false);
  }

  function handleClose() {
    if (!comanda) return;
    if (paymentShortfallCents > 0) {
      toast.error("O valor pago ainda não cobre o total da comanda.");
      return;
    }
    if (storeCreditUsedCents > customerCreditBalanceCents) {
      toast.error("Saldo de crédito insuficiente.");
      return;
    }
    if (tipCents > 0 && !tipProfessionalId) {
      toast.error("Escolha o barbeiro da gorjeta.");
      return;
    }

    if (paymentOverpayCents > 0) {
      setConfirmOverpayCredit(true);
      return;
    }

    void finalizeComanda(false);
  }

  async function handleReopen() {
    if (!comanda) return;
    setBusy(true);
    const result = await reopenComandaAction(comanda.id);
    if (result.ok) {
      toast.success("Comanda reaberta.");
      setComanda(result.comanda);
      setItems(mapComandaItemsToEditable(result.comanda.items));
      const tipItem = result.comanda.items.find((item) => item.isTip);
      setTipCents(tipItem?.chargedPriceCents ?? 0);
      setTipProfessionalId(
        tipItem?.professionalId ?? sessionProfessionalId ?? ""
      );
      router.refresh();
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

  function removeCustomerCreditPayment() {
    setPayments((prev) => {
      const removed = prev.find(
        (payment) => payment.paymentMethod === "store_credit"
      );
      const rest = prev.filter(
        (payment) => payment.paymentMethod !== "store_credit"
      );
      if (!removed) return prev;

      // Devolve o valor do crédito removido para as formas de pagamento
      // restantes, para não deixar a comanda com falta de pagamento.
      if (rest.length === 0) {
        return [
          {
            localKey: newLocalKey(),
            paymentMethod: "pix",
            amountCents: removed.amountCents,
          },
        ];
      }
      return rest.map((payment, index) =>
        index === rest.length - 1
          ? { ...payment, amountCents: payment.amountCents + removed.amountCents }
          : payment
      );
    });
  }

  function applyCustomerCredit() {
    const existingCredit = payments.find(
      (payment) => payment.paymentMethod === "store_credit"
    );
    const otherPayments = payments.filter(
      (payment) => payment.paymentMethod !== "store_credit"
    );

    // Primeiro uso: normalmente há só uma forma de pagamento cobrindo o
    // total inteiro. Nesse caso reduzimos essa forma para abrir espaço
    // para o crédito, sem mexer em outras formas.
    if (!existingCredit && otherPayments.length <= 1) {
      const creditAmount = Math.min(
        totals.totalCents,
        customerCreditBalanceCents
      );
      if (creditAmount <= 0) {
        toast.error("Este cliente não tem crédito disponível.");
        return;
      }

      const cashDue = totals.totalCents - creditAmount;
      const creditPayment: PaymentRow = {
        localKey: newLocalKey(),
        paymentMethod: "store_credit",
        amountCents: creditAmount,
      };

      if (cashDue <= 0) {
        setPayments([creditPayment]);
        return;
      }

      const base = otherPayments[0] ?? {
        localKey: newLocalKey(),
        paymentMethod: "pix" as const,
        amountCents: 0,
      };
      setPayments([{ ...base, amountCents: cashDue }, creditPayment]);
      return;
    }

    // Demais casos (várias formas já configuradas, ou ajustando um
    // crédito já aplicado): preenche só o que falta, sem apagar as
    // formas de pagamento que o usuário já escolheu.
    const otherSum = otherPayments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0
    );
    const remainingDue = Math.max(0, totals.totalCents - otherSum);
    const creditAmount = Math.min(remainingDue, customerCreditBalanceCents);

    if (remainingDue <= 0) {
      toast.error("As outras formas de pagamento já cobrem o total da comanda.");
      return;
    }
    if (creditAmount <= 0) {
      toast.error("Este cliente não tem crédito disponível.");
      return;
    }

    if (existingCredit) {
      setPayments((prev) =>
        prev.map((payment) =>
          payment.paymentMethod === "store_credit"
            ? { ...payment, amountCents: creditAmount }
            : payment
        )
      );
    } else {
      setPayments([
        ...otherPayments,
        {
          localKey: newLocalKey(),
          paymentMethod: "store_credit",
          amountCents: creditAmount,
        },
      ]);
    }
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
        open={open && !confirmCancel && !pendingExtraService && !pendingProduct}
        onOpenChange={onOpenChange}
      >
        <DialogContent className={adminComandaDialogClassName()}>
          <DialogHeader className="sr-only">
            <DialogTitle>Comanda — {customerName}</DialogTitle>
            <DialogDescription>
              Comanda do dia {formatDateBR(serviceDate)} —{" "}
              {linkedAppointments.length} atendimento
              {linkedAppointments.length === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>

          {/* Cabeçalho */}
          <div className="shrink-0 border-b px-4 py-3.5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                    {customerName}
                  </h2>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 font-normal",
                      isClosed
                        ? "bg-neutral-800 text-white hover:bg-neutral-800"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {isClosed ? "Fechada" : "Aberta"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                  >
                    <MessageCircle className="size-3.5" />
                    <span className="tabular-nums">
                      {formatWhatsapp(customerWhatsapp)}
                    </span>
                  </a>
                  {customerCreditBalanceCents > 0 && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Wallet className="size-3.5" />
                      {storeCreditUsedCents > 0
                        ? `${formatPriceBRL(creditRemainingCents)} crédito restante`
                        : `${formatPriceBRL(customerCreditBalanceCents)} em crédito`}
                    </span>
                  )}
                </div>
                {showAppointmentTimes ? (
                  <p className="text-xs text-muted-foreground">
                    {scheduledLinkedAppointments
                      .map(
                        (apt) =>
                          `${formatTime(apt.startTime)} · ${apt.professionalNickname}`
                      )
                      .join(" · ")}
                  </p>
                ) : focusAppointment ? (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatDateBR(serviceDate)} ·{" "}
                    {formatTime(focusAppointment.startTime)} –{" "}
                    {formatTime(focusAppointment.endTime)}
                    {focusAppointment.professionalNickname
                      ? ` · ${focusAppointment.professionalNickname}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatDateBR(serviceDate)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <ComandaDialogSkeleton />
          ) : (
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,22rem)] lg:gap-5 lg:overflow-hidden">
              {/* Coluna: itens */}
              <section className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Itens da comanda</h3>
                    <p className="text-xs text-muted-foreground">
                      Serviços, produtos e gorjeta deste atendimento
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={openTipDialog}
                      >
                        <Coins className="size-4" />
                        Gorjeta
                      </Button>
                      <div ref={servicePickerRef} className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setServicePickerOpen((open) => !open);
                            setProductPickerOpen(false);
                          }}
                        >
                          <Plus className="size-4" />
                          Serviço
                        </Button>
                        {servicePickerOpen && (
                          <div className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,20rem)] rounded-lg border bg-popover p-2 shadow-md sm:w-80">
                            <SearchInput
                              value={serviceSearch}
                              onChange={setServiceSearch}
                              placeholder="Buscar serviço…"
                            />
                            <ul
                              className="mt-2 max-h-52 overflow-y-auto"
                              role="listbox"
                            >
                              {filteredServices.length === 0 ? (
                                <li className="px-2 py-3 text-sm text-muted-foreground">
                                  Nenhum serviço encontrado.
                                </li>
                              ) : (
                                filteredServices.map((svc) => (
                                  <li key={svc.id}>
                                    <button
                                      type="button"
                                      role="option"
                                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                                      onClick={() => void pickService(svc)}
                                      disabled={busy}
                                    >
                                      <span className="min-w-0 truncate font-medium">
                                        {svc.name}
                                      </span>
                                      <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {formatPriceBRL(svc.priceCents)}
                                      </span>
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                      {productsCatalog.length > 0 && (
                        <div ref={productPickerRef} className="relative">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setProductPickerOpen((open) => !open);
                              setServicePickerOpen(false);
                            }}
                          >
                            <Plus className="size-4" />
                            Produto
                          </Button>
                          {productPickerOpen && (
                            <div className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,20rem)] rounded-lg border bg-popover p-2 shadow-md sm:w-80">
                              <SearchInput
                                value={productSearch}
                                onChange={setProductSearch}
                                placeholder="Buscar produto…"
                              />
                              <ul
                                className="mt-2 max-h-52 overflow-y-auto"
                                role="listbox"
                              >
                                {filteredProducts.length === 0 ? (
                                  <li className="px-2 py-3 text-sm text-muted-foreground">
                                    Nenhum produto encontrado.
                                  </li>
                                ) : (
                                  filteredProducts.map((product) => (
                                    <li key={product.id}>
                                      <button
                                        type="button"
                                        role="option"
                                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                                        onClick={() => pickProduct(product)}
                                        disabled={busy}
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate font-medium">
                                            {product.name}
                                          </span>
                                          <span className="block text-xs text-muted-foreground">
                                            {product.categoryName} · estoque{" "}
                                            {product.stockQuantity}
                                          </span>
                                        </span>
                                        <span className="shrink-0 tabular-nums text-muted-foreground">
                                          {formatPriceBRL(product.priceCents)}
                                        </span>
                                      </button>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col overflow-hidden rounded-xl border lg:min-h-0 lg:flex-1">
                  {items.length === 0 && tipCents <= 0 ? (
                    <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum item nesta comanda.
                    </p>
                  ) : (
                    <ul className="divide-y lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                      {items.map((item) => {
                        const product = isProductItem(item);
                        const timeLabel = getItemAppointmentTime(item);
                        return (
                          <li
                            key={item.localKey}
                            className="flex flex-col gap-2 bg-background px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-2.5"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground sm:size-8">
                                {product ? (
                                  <Package className="size-4" />
                                ) : (
                                  <Scissors className="size-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug">
                                  {item.serviceName}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {product ? (
                                    <>
                                      {item.quantity ?? 1}x{" "}
                                      {formatPriceBRL(item.catalogPriceCents)} ·{" "}
                                      {getItemProfessionalName(item)}
                                    </>
                                  ) : (
                                    <>
                                      {getItemProfessionalName(item)}
                                      {timeLabel ? ` · ${timeLabel}` : ""}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pl-12 sm:pl-0">
                              {canEdit ? (
                                <Input
                                  className="h-10 w-full max-w-[9rem] tabular-nums sm:h-9 sm:w-28 sm:max-w-none"
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
                                <span className="shrink-0 font-semibold tabular-nums">
                                  {formatPriceBRL(item.chargedPriceCents)}
                                </span>
                              )}
                              {!isClosed &&
                                (getCancelTargetForItem(item) || canEdit) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-10 shrink-0 text-destructive sm:size-8"
                                    onClick={() => handleItemTrash(item)}
                                    disabled={isItemTrashDisabled(item)}
                                    title={
                                      getCancelTargetForItem(item)
                                        ? "Cancelar horário"
                                        : product
                                          ? "Remover produto"
                                          : "Remover serviço"
                                    }
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                            </div>
                          </li>
                        );
                      })}
                      {tipCents > 0 && (
                        <li className="flex items-center gap-3 bg-background px-3 py-2.5 sm:px-4">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                            <Coins className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug">Gorjeta</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {tipEligibleProfessionals.find(
                                (pro) => pro.id === tipProfessionalId
                              )?.nickname ?? "barbeiro"}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {formatPriceBRL(tipCents)}
                          </span>
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 text-destructive"
                              onClick={removeTip}
                              disabled={busy}
                              title="Remover gorjeta"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </li>
                      )}
                    </ul>
                  )}

                  <div className="shrink-0 space-y-1 border-t bg-muted/20 px-4 py-2.5 text-sm">
                    {servicesTotalCents > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Serviços</span>
                        <span className="tabular-nums">
                          {formatPriceBRL(servicesTotalCents)}
                        </span>
                      </div>
                    )}
                    {productsTotalCents > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Produtos</span>
                        <span className="tabular-nums">
                          {formatPriceBRL(productsTotalCents)}
                        </span>
                      </div>
                    )}
                    {tipCents > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Gorjeta</span>
                        <span className="tabular-nums">
                          {formatPriceBRL(tipCents)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t pt-1.5 font-medium">
                      <span>Subtotal</span>
                      <span className="tabular-nums">
                        {formatPriceBRL(totals.totalCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Coluna: pagamento */}
              <section className="flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden lg:border-l lg:pl-5">
                <div className="shrink-0">
                  <h3 className="text-sm font-semibold">Pagamento</h3>
                  <p className="text-xs text-muted-foreground">
                    Formas de pagamento desta comanda
                  </p>
                </div>

                {canEdit && !cashRegisterOpen && isOwner && (
                  <div className="shrink-0 rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                    {openCashRegisterDate &&
                    openCashRegisterDate !== serviceDate ? (
                      <>
                        O caixa aberto é do dia{" "}
                        {formatDateBR(openCashRegisterDate)}. Esta comanda é do
                        dia {formatDateBR(serviceDate)}.
                      </>
                    ) : (
                      <>
                        Sem caixa aberto em {formatDateBR(serviceDate)}. Abra em{" "}
                        <Link
                          href={`/admin/financeiro?date=${serviceDate}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          Financeiro
                        </Link>
                        .
                      </>
                    )}
                  </div>
                )}

                {(canEdit || isClosed) && (
                  <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                    {customerCreditBalanceCents > 0 && canEdit && (
                      <div className="shrink-0 space-y-2 rounded-xl border bg-muted/20 p-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Crédito do cliente
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatPriceBRL(customerCreditBalanceCents)}{" "}
                            disponível
                          </p>
                          {storeCreditUsedCents > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Usando {formatPriceBRL(storeCreditUsedCents)}
                              {creditRemainingCents > 0 &&
                                ` · restam ${formatPriceBRL(creditRemainingCents)}`}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={applyCustomerCredit}
                          >
                            <Wallet className="size-4" />
                            {storeCreditUsedCents > 0
                              ? "Ajustar"
                              : "Usar crédito"}
                          </Button>
                          {storeCreditUsedCents > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={removeCustomerCreditPayment}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {customerCreditBalanceCents > 0 && !canEdit && (
                      <p className="text-xs text-muted-foreground">
                        Crédito:{" "}
                        <span className="font-medium text-foreground">
                          {formatPriceBRL(customerCreditBalanceCents)}
                        </span>
                      </p>
                    )}

                    <div className="space-y-2">
                      {payments.map((row) => (
                        <div
                          key={row.localKey}
                          className="flex flex-col gap-2 rounded-xl border bg-background p-2.5"
                        >
                          <div className="flex min-w-0 gap-2">
                            <Select
                              value={row.paymentMethod}
                              onValueChange={(v) => {
                                const method = v as PaymentMethod;
                                setPayments((prev) =>
                                  prev.map((p) => {
                                    if (p.localKey !== row.localKey) return p;
                                    const next = {
                                      ...p,
                                      paymentMethod: method,
                                    };
                                    if (method === "store_credit") {
                                      const withoutThis = prev
                                        .filter(
                                          (payment) =>
                                            payment.localKey !== row.localKey &&
                                            payment.paymentMethod !==
                                              "store_credit"
                                        )
                                        .reduce(
                                          (sum, payment) =>
                                            sum + payment.amountCents,
                                          0
                                        );
                                      const remainingDue = Math.max(
                                        0,
                                        totals.totalCents - withoutThis
                                      );
                                      next.amountCents = Math.min(
                                        remainingDue,
                                        customerCreditBalanceCents
                                      );
                                    }
                                    return next;
                                  })
                                );
                              }}
                              disabled={!canEdit || busy}
                            >
                              <SelectTrigger className="h-9 min-w-0 flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availablePaymentMethods.map((m) => (
                                  <SelectItem key={m} value={m}>
                                    {PAYMENT_METHOD_LABELS[m]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {canEdit && payments.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 shrink-0"
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
                          <Input
                            className="h-9 w-full tabular-nums"
                            value={
                              row.amountCents > 0
                                ? formatPriceBRL(row.amountCents)
                                : ""
                            }
                            onChange={(e) => {
                              const cents = parsePriceInput(e.target.value);
                              const withoutThisCredit = payments
                                .filter(
                                  (payment) =>
                                    payment.localKey !== row.localKey &&
                                    payment.paymentMethod !== "store_credit"
                                )
                                .reduce(
                                  (sum, payment) => sum + payment.amountCents,
                                  0
                                );
                              const maxForCredit =
                                row.paymentMethod === "store_credit"
                                  ? Math.min(
                                      Math.max(
                                        0,
                                        totals.totalCents - withoutThisCredit
                                      ),
                                      customerCreditBalanceCents
                                    )
                                  : cents;
                              const capped =
                                row.paymentMethod === "store_credit"
                                  ? Math.min(cents, maxForCredit)
                                  : cents;
                              setPayments((prev) =>
                                prev.map((p) =>
                                  p.localKey === row.localKey
                                    ? { ...p, amountCents: capped }
                                    : p
                                )
                              );
                            }}
                            disabled={!canEdit || busy}
                          />
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
                          <Plus className="size-4" />
                          Outra forma
                        </Button>
                      )}
                    </div>

                    <div className="mt-auto space-y-1.5 rounded-xl border bg-muted/20 px-3 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Valor pago</span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            paymentShortfall && "text-destructive"
                          )}
                        >
                          {formatPriceBRL(paymentsSum)}
                        </span>
                      </div>
                      {paymentShortfall && (
                        <p className="text-xs text-destructive">
                          Falta {formatPriceBRL(paymentShortfallCents)}
                        </p>
                      )}
                      {canEdit && paymentOverpayCents > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formatPriceBRL(paymentOverpayCents)} a mais — pode
                          virar crédito ao finalizar.
                        </p>
                      )}
                      {(isOwner || canEdit) && (
                        <p className="text-xs text-muted-foreground">
                          Comissão {formatPriceBRL(totals.commissionCents)} ·
                          Casa{" "}
                          {formatPriceBRL(
                            totals.totalCents - totals.commissionCents
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Rodapé */}
          <div className="shrink-0 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center justify-between gap-2 sm:contents">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 sm:h-8"
                    onClick={() => onOpenChange(false)}
                    disabled={busy}
                  >
                    Fechar
                  </Button>

                  {hasSecondaryActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-10 shrink-0 sm:size-8"
                          disabled={busy}
                          aria-label="Mais ações"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {canEdit && onEditSchedule && (
                          <DropdownMenuItem
                            disabled={busy}
                            onSelect={() => onEditSchedule()}
                          >
                            <Pencil className="size-4" />
                            Editar agendamento
                          </DropdownMenuItem>
                        )}
                        {canCancelFocused && (
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={busy}
                            onSelect={() =>
                              openCancelDialog(
                                cancelTargetId ??
                                  focusAppointmentId ??
                                  appointment.id
                              )
                            }
                          >
                            <X className="size-4" />
                            Cancelar horário
                          </DropdownMenuItem>
                        )}
                        {isOwner && isClosed && (
                          <>
                            {(canEdit && onEditSchedule) || canCancelFocused ? (
                              <DropdownMenuSeparator />
                            ) : null}
                            <DropdownMenuItem
                              disabled={busy}
                              onSelect={() => void handleReopen()}
                            >
                              <RotateCcw className="size-4" />
                              Reabrir comanda
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="min-w-0 text-right sm:flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatPriceBRL(totals.totalCents)}
                  </p>
                </div>
              </div>

              {canFinalize && (
                <Button
                  type="button"
                  className="h-11 w-full shrink-0 sm:h-8 sm:w-auto"
                  onClick={handleClose}
                  disabled={
                    busy ||
                    loading ||
                    !cashRegisterOpen ||
                    paymentShortfallCents > 0
                  }
                >
                  <Check className="size-4" />
                  Finalizar comanda
                </Button>
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

      <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gorjeta</DialogTitle>
            <DialogDescription>
              Opcional. O barbeiro escolhido recebe 100% do valor e entra no
              total da comanda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="tip-draft-amount">Valor</Label>
              <Input
                id="tip-draft-amount"
                className="h-9 tabular-nums"
                value={
                  tipDraftCents > 0 ? formatPriceBRL(tipDraftCents) : ""
                }
                onChange={(e) =>
                  setTipDraftCents(parsePriceInput(e.target.value))
                }
                placeholder="R$ 0,00"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tip-draft-professional">Barbeiro</Label>
              <Select
                value={tipDraftProfessionalId}
                onValueChange={setTipDraftProfessionalId}
                disabled={busy || tipEligibleProfessionals.length === 0}
              >
                <SelectTrigger id="tip-draft-professional" className="h-9">
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {tipCents > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={removeTip}
              >
                Remover gorjeta
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setTipDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={confirmTipDialog}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOverpayCredit} onOpenChange={setConfirmOverpayCredit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar o troco como crédito?</DialogTitle>
            <DialogDescription>
              O cliente pagou{" "}
              <strong>{formatPriceBRL(paymentOverpayCents)}</strong> a mais que o
              total da comanda ({formatPriceBRL(totals.totalCents)}). Deseja
              guardar esse valor como crédito para ele?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void finalizeComanda(false)}
            >
              Não, foi troco
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void finalizeComanda(true)}
            >
              Sim, guardar crédito
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

      <Dialog
        open={pendingProduct !== null}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen && !busy) {
            setPendingProduct(null);
            setProductProfessionalId("");
            setProductQuantity("1");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar produto</DialogTitle>
            <DialogDescription>
              {pendingProduct?.name} · {formatPriceBRL(pendingProduct?.priceCents ?? 0)} cada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="product-professional">Barbeiro que vendeu</Label>
              <Select
                value={productProfessionalId}
                onValueChange={setProductProfessionalId}
                disabled={busy}
              >
                <SelectTrigger id="product-professional" className="w-full">
                  <SelectValue placeholder="Escolha o barbeiro" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-quantity">Quantidade</Label>
              <Input
                id="product-quantity"
                inputMode="numeric"
                value={productQuantity}
                onChange={(event) =>
                  setProductQuantity(event.target.value.replace(/\D/g, ""))
                }
                disabled={busy}
              />
              {pendingProduct && (
                <p className="text-xs text-muted-foreground">
                  Estoque disponível: {pendingProduct.stockQuantity}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPendingProduct(null);
                setProductProfessionalId("");
                setProductQuantity("1");
              }}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmAddProduct()}
              disabled={busy || !productProfessionalId || !pendingProduct}
            >
              Adicionar à comanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
