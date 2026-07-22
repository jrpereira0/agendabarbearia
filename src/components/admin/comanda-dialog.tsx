"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Coins,
  Loader2,
  MessageCircle,
  Minus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/admin/search-input";
import { CancelAppointmentDialog } from "@/components/admin/cancel-appointment-dialog";
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
  formatDuration,
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

const PRODUCT_NO_PROFESSIONAL = "__none__";
const TIP_QUICK_CENTS = [500, 1000, 2000, 5000] as const;

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

/** Horários do mesmo cliente no dia (já estão na agenda — dá para abrir na hora). */
function dayAppointmentsForCustomer(
  appointment: AppointmentItem,
  appointments: AppointmentItem[]
): AppointmentItem[] {
  const sameDay = appointments.filter(
    (apt) =>
      apt.customerWhatsapp === appointment.customerWhatsapp &&
      apt.date === appointment.date &&
      apt.status !== "cancelled"
  );
  if (sameDay.length === 0) return [appointment];
  return sameDay.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function buildProvisionalItems(dayApts: AppointmentItem[]): EditableItem[] {
  const items: EditableItem[] = [];
  for (const apt of dayApts) {
    for (const service of apt.services) {
      const isSqueeze = Boolean(apt.isSqueezeIn);
      items.push({
        localKey: newLocalKey(),
        serviceId: service.id,
        serviceName: service.name,
        catalogPriceCents: service.priceCents,
        chargedPriceCents: service.priceCents,
        quantity: 1,
        appointmentId: isSqueeze ? undefined : apt.id,
        squeezeAppointmentId: isSqueeze ? apt.id : undefined,
        professionalId: apt.professionalId,
        professionalNickname: apt.professionalNickname,
        isComandaExtra: apt.isComandaExtra || undefined,
      });
    }
  }
  return items;
}

function appointmentToLinked(
  apt: AppointmentItem
): ComandaLinkedAppointment {
  return {
    id: apt.id,
    professionalId: apt.professionalId,
    professionalNickname: apt.professionalNickname,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    isSqueezeIn: apt.isSqueezeIn ?? false,
  };
}

/** Chave estável para saber se os itens mudaram desde o load do servidor. */
function comandaItemsKey(
  items: EditableItem[],
  tipCents: number,
  tipProfessionalId: string
): string {
  return JSON.stringify({
    tip:
      tipCents > 0
        ? { tipCents, tipProfessionalId }
        : null,
    items: items.map((item) => ({
      id: item.id ?? null,
      serviceId: item.serviceId ?? null,
      productId: item.productId ?? null,
      chargedPriceCents: item.chargedPriceCents,
      quantity: item.quantity ?? 1,
      professionalId: item.professionalId ?? null,
      appointmentId: item.appointmentId ?? null,
      squeezeAppointmentId: item.squeezeAppointmentId ?? null,
      serviceName: item.serviceName,
    })),
  });
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
  if (tipCents > 0 && tipProfessionalId) {
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
    startTime,
    serviceId,
    productId,
    appointmentId,
    professionalId,
    quantity,
    commissionPercent,
    isComandaExtra,
    ...rest
  } = item;

  const normalizedStart = startTime ? formatTime(startTime) : undefined;

  return {
    serviceName: rest.serviceName,
    catalogPriceCents: rest.catalogPriceCents,
    chargedPriceCents: rest.chargedPriceCents,
    ...(id ? { id } : {}),
    ...(serviceId ? { serviceId } : {}),
    ...(productId ? { productId } : {}),
    ...(appointmentId ? { appointmentId } : {}),
    ...(professionalId ? { professionalId } : {}),
    ...(quantity && quantity > 0 ? { quantity } : {}),
    ...(typeof commissionPercent === "number"
      ? { commissionPercent }
      : {}),
    ...(normalizedStart ? { startTime: normalizedStart } : {}),
    ...(isComandaExtra ? { isComandaExtra: true } : {}),
  };
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
  slotStepMinutes?: number;
  appointments?: AppointmentItem[];
  /** Dono da barbearia — evita esperar o load só para liberar ações. */
  isOwnerHint?: boolean;
  /** Caixa já conhecido na agenda — libera finalizar sem esperar o servidor. */
  initialCashRegisterOpen?: boolean;
  initialOpenCashRegisterDate?: string | null;
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
  slotStepMinutes = 15,
  appointments = [],
  isOwnerHint = false,
  initialCashRegisterOpen = false,
  initialOpenCashRegisterDate = null,
  onEditSchedule,
}: ComandaDialogProps) {
  const router = useRouter();
  const loadGenRef = useRef(0);
  const [comanda, setComanda] = useState<ComandaDetail | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isOwner, setIsOwner] = useState(isOwnerHint);
  const [cashRegisterOpen, setCashRegisterOpen] = useState(
    initialCashRegisterOpen
  );
  const [openCashRegisterDate, setOpenCashRegisterDate] = useState<string | null>(
    initialOpenCashRegisterDate
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadedItemsKey, setLoadedItemsKey] = useState<string | null>(null);
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
  const [tipCents, setTipCents] = useState(0);
  const [tipProfessionalId, setTipProfessionalId] = useState("");
  const [customerCreditBalanceCents, setCustomerCreditBalanceCents] = useState(0);
  const [confirmOverpayCredit, setConfirmOverpayCredit] = useState(false);
  const [confirmCreditShortfallCents, setConfirmCreditShortfallCents] = useState<
    number | null
  >(null);
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [tipDraftCents, setTipDraftCents] = useState(0);
  const [tipDraftProfessionalId, setTipDraftProfessionalId] = useState("");

  const load = useCallback(async () => {
    if (!appointment) return;
    const gen = ++loadGenRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const result = await loadComandaForAppointment(
        appointment.id,
        appointment.customerWhatsapp
      );
      if (gen !== loadGenRef.current) return;
      if (!result.ok) {
        setLoadError(true);
        toast.error(result.error);
        return;
      }
      setComanda(result.comanda);
      setIsOwner(result.isOwner);
      setCashRegisterOpen(result.cashRegisterOpen);
      setOpenCashRegisterDate(result.openCashRegisterDate);
      setCustomerCreditBalanceCents(result.customerCreditBalanceCents);
      const tipItem = result.comanda.items.find((item) => item.isTip);
      const editable = mapComandaItemsToEditable(result.comanda.items);
      const nextTipCents = tipItem?.chargedPriceCents ?? 0;
      const nextTipProfessionalId =
        tipItem?.professionalId ??
        appointment.professionalId ??
        sessionProfessionalId ??
        "";
      setItems(editable);
      setLoadedItemsKey(
        comandaItemsKey(editable, nextTipCents, nextTipProfessionalId)
      );
      setTipCents(nextTipCents);
      setTipProfessionalId(nextTipProfessionalId);
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
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, [appointment, sessionProfessionalId]);

  // Dispara a busca da comanda no servidor sempre que o diálogo abre pra um
  // agendamento (ou os dados relevantes mudam enquanto já está aberto).
  useEffect(() => {
    if (open && appointment) {
      // Defer pro próximo tick: evita "setState direto no efeito" e permite
      // cancelar (abaixo) se o diálogo fechar antes da busca começar.
      const timer = setTimeout(() => void load(), 0);
      return () => clearTimeout(timer);
    }
    if (!open) {
      loadGenRef.current += 1;
    }
  }, [
    open,
    appointment,
    load,
    appointments,
    isOwnerHint,
    initialCashRegisterOpen,
    initialOpenCashRegisterDate,
    sessionProfessionalId,
  ]);

  // Ajustes de estado local (sem chamada ao servidor) pro mesmo gatilho acima.
  const [syncedFor, setSyncedFor] = useState({
    open,
    appointmentId: appointment?.id ?? null,
    appointments,
    isOwnerHint,
    initialCashRegisterOpen,
    initialOpenCashRegisterDate,
    sessionProfessionalId,
  });
  const needsSync =
    open !== syncedFor.open ||
    (appointment?.id ?? null) !== syncedFor.appointmentId ||
    appointments !== syncedFor.appointments ||
    isOwnerHint !== syncedFor.isOwnerHint ||
    initialCashRegisterOpen !== syncedFor.initialCashRegisterOpen ||
    initialOpenCashRegisterDate !== syncedFor.initialOpenCashRegisterDate ||
    sessionProfessionalId !== syncedFor.sessionProfessionalId;

  if (needsSync) {
    setSyncedFor({
      open,
      appointmentId: appointment?.id ?? null,
      appointments,
      isOwnerHint,
      initialCashRegisterOpen,
      initialOpenCashRegisterDate,
      sessionProfessionalId,
    });

    if (open && appointment) {
      const dayApts = dayAppointmentsForCustomer(appointment, appointments);
      const provisional = buildProvisionalItems(dayApts);
      const provisionalTotal = provisional.reduce(
        (sum, item) => sum + item.chargedPriceCents,
        0
      );

      setFocusAppointmentId(appointment.id);
      setLoading(true);
      setLoadError(false);
      setComanda(null);
      setItems(provisional);
      setLoadedItemsKey(null);
      setPayments(
        provisionalTotal > 0
          ? [
              {
                localKey: newLocalKey(),
                paymentMethod: "pix",
                amountCents: provisionalTotal,
              },
            ]
          : []
      );
      setIsOwner(isOwnerHint);
      setCashRegisterOpen(initialCashRegisterOpen);
      setOpenCashRegisterDate(initialOpenCashRegisterDate);
      setTipCents(0);
      setTipProfessionalId(
        appointment.professionalId || sessionProfessionalId || ""
      );
      setCustomerCreditBalanceCents(0);
    } else if (!open) {
      setComanda(null);
      setLoadError(false);
      setLoading(false);
      setConfirmCancel(false);
      setConfirmOverpayCredit(false);
      setConfirmCreditShortfallCents(null);
      setServiceSearch("");
      setServicePickerOpen(false);
      setFocusAppointmentId(null);
      setCancelReason("");
      setCancelTargetId(null);
      setCancelTargetLabel(null);
      setPendingExtraService(null);
      setExtraProfessionalId("");
      setExtraStartTime("");
      setPendingProduct(null);
      setProductProfessionalId("");
      setProductQuantity("1");
      setProductSearch("");
      setProductPickerOpen(false);
      setTipCents(0);
      setTipProfessionalId("");
      setCustomerCreditBalanceCents(0);
      setTipDialogOpen(false);
      setLoadedItemsKey(null);
      setClosing(false);
      setBusy(false);
    }
  }

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
    if (comanda?.linkedAppointments) return comanda.linkedAppointments;
    return dayAppointmentsForCustomer(appointment, appointments).map(
      appointmentToLinked
    );
  }, [appointment, appointments, comanda?.linkedAppointments]);

  // Skeleton até a comanda chegar do servidor — evita crédito/gorjeta
  // "aparecendo depois" em cima do rascunho local.
  const showSkeleton = Boolean(
    open && appointment && !loadError && (loading || !comanda)
  );

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
    Boolean(comanda) &&
    (isOwner || permissions.canEditComanda) &&
    !isClosed &&
    hasActiveLinked;
  const canFinalize =
    Boolean(comanda) &&
    (isOwner || permissions.canCloseComanda) &&
    !isClosed &&
    hasActiveLinked;

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
    if (isProductItem(item)) return "Sem profissional";
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
    // Encaixe / serviço extra: remove o item da comanda (o sync já apaga o
    // horário). Não abre o modal de cancelamento.
    if (item.squeezeAppointmentId || item.isComandaExtra) {
      return null;
    }

    if (!item.appointmentId || !item.id || isProductItem(item)) {
      return null;
    }

    // Só cancela o agendamento quando este é o único serviço daquele horário.
    const siblings = items.filter(
      (other) =>
        other.appointmentId === item.appointmentId &&
        !other.squeezeAppointmentId &&
        !other.isComandaExtra &&
        !isProductItem(other)
    );
    if (siblings.length !== 1) {
      return null;
    }

    const apt = linkedAppointments.find(
      (linked) => linked.id === item.appointmentId && !linked.isSqueezeIn
    );
    if (apt && canCancelLinkedAppointment(apt)) {
      return item.appointmentId;
    }

    return null;
  }

  function canRemoveItemFromComanda(item: EditableItem): boolean {
    if (!canEdit || items.length <= 1) return false;
    if (isProductItem(item)) return true;
    if (item.squeezeAppointmentId || item.isComandaExtra) return true;
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

    const nonTipCount = nextItems.length;
    if (nonTipCount === 0) {
      toast.error("A comanda precisa de ao menos um serviço ou produto.");
      return false;
    }

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
      const editable = mapComandaItemsToEditable(result.comanda.items);
      const savedTipCents = savedTip?.chargedPriceCents ?? 0;
      const savedTipProId =
        savedTip?.professionalId ?? nextTipProfessionalId;
      setItems(editable);
      setTipCents(savedTipCents);
      setTipProfessionalId(savedTipProId);
      setLoadedItemsKey(
        comandaItemsKey(editable, savedTipCents, savedTipProId)
      );
      setPayments((prev) =>
        prev.length === 1
          ? [{ ...prev[0], amountCents: result.comanda.totalCents }]
          : prev
      );
      router.refresh();
      return true;
    } catch {
      toast.error(
        "Não foi possível salvar os itens. Verifique a internet e tente de novo."
      );
      return false;
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

    const qty = Number.parseInt(productQuantity.replace(/\D/g, "") || "0", 10);
    if (qty < 1) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    const hasProfessional =
      productProfessionalId.length > 0 &&
      productProfessionalId !== PRODUCT_NO_PROFESSIONAL;
    const pro = hasProfessional
      ? professionals.find((p) => p.id === productProfessionalId)
      : undefined;
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
        commissionPercent: hasProfessional
          ? pendingProduct.commissionPercent
          : 0,
        professionalId: hasProfessional ? productProfessionalId : undefined,
        professionalNickname: hasProfessional
          ? pro?.nickname
          : "Sem profissional",
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

    setPendingProduct(product);
    setProductProfessionalId("");
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

    if (comandaPayments.length === 0) {
      toast.error("Informe ao menos uma forma de pagamento.");
      return;
    }

    const persistItemsPayload = buildPersistItems(
      items,
      tipCents,
      tipProfessionalId
    );
    const comandaId = comanda.id;
    const itemsChanged =
      loadedItemsKey == null ||
      loadedItemsKey !== comandaItemsKey(items, tipCents, tipProfessionalId);

    // Fecha na hora — o salvamento segue em segundo plano.
    setConfirmOverpayCredit(false);
    setClosing(false);
    setBusy(false);
    onOpenChange(false);
    toast.success("Comanda fechada.");
    router.refresh();

    void closeComandaWithItemsAction(
      comandaId,
      persistItemsPayload,
      comandaPayments,
      {
        creditDeposits: saveOverpayAsCredit ? creditDeposits : undefined,
        skipItemsUpdate: !itemsChanged,
      }
    ).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      router.refresh();
    }).catch(() => {
      toast.error(
        "Não foi possível finalizar a comanda. Verifique a internet e tente de novo."
      );
      router.refresh();
    });
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

  async function handleReopen(confirmCreditShortfall = false) {
    if (!comanda) return;
    setBusy(true);
    try {
      const result = await reopenComandaAction(comanda.id, {
        confirmCreditShortfall,
      });
      if (result.ok) {
        setConfirmCreditShortfallCents(null);
        toast.success("Comanda reaberta.");
        await load();
        router.refresh();
      } else if (
        result.code === "credit_shortfall" &&
        result.shortfallCents != null &&
        !confirmCreditShortfall
      ) {
        setConfirmCreditShortfallCents(result.shortfallCents);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(
        "Não foi possível reabrir a comanda. Verifique a internet e tente de novo."
      );
    } finally {
      setBusy(false);
    }
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
    try {
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
    } catch {
      toast.error(
        "Não foi possível cancelar. Verifique a internet e tente de novo."
      );
    } finally {
      setBusy(false);
    }
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
        onOpenChange={(next) => {
          if (closing) return;
          onOpenChange(next);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={adminComandaDialogClassName()}
        >
          {closing && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[rgb(14_15_17_/_88%)]"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="size-8 animate-spin text-[var(--booking-accent,#ecf15e)]"
                aria-hidden
              />
              <p className="text-sm font-medium text-[#f5f5f5]">
                Finalizando comanda…
              </p>
              <p className="text-xs text-muted-foreground">Aguarde um instante</p>
            </div>
          )}

          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              if (!closing) onOpenChange(false);
            }}
            disabled={busy || closing}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>

          <DialogHeader className="booking-header shrink-0 gap-0.5 border-b px-3 pb-2.5 pt-4 pr-14 sm:px-5 sm:pt-4 sm:pr-14 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="booking-display truncate text-lg tracking-tight text-[#f5f5f5] sm:text-xl">
                {customerName}
              </DialogTitle>
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 font-normal",
                  showSkeleton
                    ? "border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/5"
                    : isClosed
                      ? "border border-white/15 bg-white/10 text-[#f5f5f5] hover:bg-white/10"
                      : "border border-[rgb(236_241_94_/_35%)] bg-[rgb(236_241_94_/_12%)] text-[var(--booking-accent,#ecf15e)] hover:bg-[rgb(236_241_94_/_12%)]"
                )}
              >
                {showSkeleton ? "…" : isClosed ? "Fechada" : "Aberta"}
              </Badge>
            </div>
            <DialogDescription className="sr-only">
              Comanda do dia {formatDateBR(serviceDate)} —{" "}
              {linkedAppointments.length} atendimento
              {linkedAppointments.length === 1 ? "" : "s"}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--booking-accent,#ecf15e)]"
              >
                <MessageCircle className="size-3.5" />
                <span className="tabular-nums">
                  {formatWhatsapp(customerWhatsapp)}
                </span>
              </a>
              {!showSkeleton && customerCreditBalanceCents > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums text-[var(--booking-accent,#ecf15e)]">
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
          </DialogHeader>

          {showSkeleton ? (
            <ComandaDialogSkeleton />
          ) : (
            <div className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,24rem)] lg:gap-5 lg:px-6">
              <section className="flex min-h-0 flex-col gap-2.5 overflow-hidden lg:flex-1">
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#f5f5f5]">
                      Itens
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      O que o cliente fez neste dia
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="booking-btn-ghost h-8"
                        disabled={busy}
                        onClick={openTipDialog}
                      >
                        <Coins className="size-4" />
                        Gorjeta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="booking-btn-ghost h-8"
                        disabled={busy}
                        onClick={() => {
                          setServicePickerOpen(true);
                          setProductPickerOpen(false);
                        }}
                      >
                        <Plus className="size-4" />
                        Serviço
                      </Button>
                      {productsCatalog.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="booking-btn-ghost h-8"
                          disabled={busy}
                          onClick={() => {
                            setProductPickerOpen(true);
                            setServicePickerOpen(false);
                          }}
                        >
                          <Plus className="size-4" />
                          Produto
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
                  {items.length === 0 && tipCents <= 0 ? (
                    <p className="booking-notice m-3 flex min-h-0 flex-1 items-center justify-center rounded-xl px-4 py-6 text-center text-sm">
                      Nenhum item ainda. Adicione um serviço ou produto.
                    </p>
                  ) : (
                    <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
                      {items.map((item) => {
                        const product = isProductItem(item);
                        const timeLabel = getItemAppointmentTime(item);
                        return (
                          <li
                            key={item.localKey}
                            className="flex flex-col gap-1.5 bg-transparent px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-2"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--booking-border)] bg-[var(--booking-input)] text-[var(--booking-accent,#ecf15e)] sm:size-8">
                                {product ? (
                                  <Package className="size-4" />
                                ) : (
                                  <Scissors className="size-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug text-[#f5f5f5]">
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
                                <span className="shrink-0 font-semibold tabular-nums text-[#f5f5f5]">
                                  {formatPriceBRL(item.chargedPriceCents)}
                                </span>
                              )}
                              {!isClosed &&
                                (getCancelTargetForItem(item) || canEdit) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-10 shrink-0 text-[#f87171] hover:bg-[rgb(248_113_113_/_12%)] hover:text-[#fca5a5] sm:size-8"
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
                        <li className="flex items-center gap-3 bg-transparent px-3 py-2.5 sm:px-4">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--booking-border)] bg-[var(--booking-input)] text-[var(--booking-accent,#ecf15e)]">
                            <Coins className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug text-[#f5f5f5]">
                              Gorjeta
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {tipEligibleProfessionals.find(
                                (pro) => pro.id === tipProfessionalId
                              )?.nickname ?? "barbeiro"}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums text-[#f5f5f5]">
                            {formatPriceBRL(tipCents)}
                          </span>
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 text-[#f87171] hover:bg-[rgb(248_113_113_/_12%)] hover:text-[#fca5a5]"
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

                  <div className="shrink-0 space-y-1 border-t px-4 py-2.5 text-sm">
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
                    <div className="flex items-center justify-between border-t pt-1.5 font-medium text-[#f5f5f5]">
                      <span>Subtotal</span>
                      <span className="tabular-nums">
                        {formatPriceBRL(totals.totalCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-col gap-2.5 overflow-hidden lg:border-l lg:pl-5">
                <div className="shrink-0">
                  <h3 className="text-sm font-semibold text-[#f5f5f5]">
                    Pagamento
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Quanto falta receber para finalizar
                  </p>
                </div>

                <div className="booking-pay-hero shrink-0 space-y-2 rounded-xl px-3.5 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums text-[#f5f5f5]">
                      {formatPriceBRL(totals.totalCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Já pago</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        paymentShortfall ? "booking-pay-short" : "text-[#f5f5f5]"
                      )}
                    >
                      {formatPriceBRL(paymentsSum)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--booking-border)] pt-2">
                    <span className="text-sm font-medium text-[#f5f5f5]">
                      {paymentOverpayCents > 0
                        ? "Troco / crédito"
                        : paymentShortfall
                          ? "Falta"
                          : "Em dia"}
                    </span>
                    <span
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        paymentOverpayCents > 0
                          ? "booking-pay-due"
                          : paymentShortfall
                            ? "booking-pay-short"
                            : "booking-pay-due"
                      )}
                    >
                      {paymentOverpayCents > 0
                        ? formatPriceBRL(paymentOverpayCents)
                        : paymentShortfall
                          ? formatPriceBRL(paymentShortfallCents)
                          : formatPriceBRL(0)}
                    </span>
                  </div>
                  {canEdit && paymentOverpayCents > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pode virar crédito do cliente ao finalizar.
                    </p>
                  )}
                </div>

                {!isClosed && !cashRegisterOpen && isOwner && (
                  <div className="booking-notice shrink-0 rounded-xl px-3 py-2.5 text-xs">
                    {openCashRegisterDate &&
                    openCashRegisterDate !== serviceDate ? (
                      <>
                        O caixa aberto é do dia{" "}
                        <span className="font-medium">
                          {formatDateBR(openCashRegisterDate)}
                        </span>
                        . Esta comanda é do dia{" "}
                        <span className="font-medium">
                          {formatDateBR(serviceDate)}
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        Sem caixa aberto em {formatDateBR(serviceDate)}. Abra em{" "}
                        <Link
                          href={`/admin/financeiro?date=${serviceDate}`}
                          className="font-medium text-[#f5f5f5] underline-offset-4 hover:underline"
                        >
                          Financeiro
                        </Link>
                        .
                      </>
                    )}
                  </div>
                )}

                {(canEdit || isClosed || (hasActiveLinked && items.length > 0)) && (
                  <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain">
                    {customerCreditBalanceCents > 0 && canEdit && (
                      <div className="booking-context shrink-0 space-y-2 rounded-xl p-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Crédito do cliente
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-[var(--booking-accent,#ecf15e)]">
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
                            className="booking-btn-ghost h-8"
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
                              className="booking-btn-ghost h-8"
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
                        <span className="font-medium text-[#f5f5f5]">
                          {formatPriceBRL(customerCreditBalanceCents)}
                        </span>
                      </p>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Forma de pagamento
                      </p>
                      {payments.map((row) => (
                        <div
                          key={row.localKey}
                          className="booking-context flex flex-col gap-2 rounded-xl p-2.5"
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
                                <SelectValue placeholder="Escolha a forma" />
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
                                className="size-9 shrink-0 text-[#f87171] hover:bg-[rgb(248_113_113_/_12%)] hover:text-[#fca5a5]"
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
                          className="booking-btn-ghost h-8 w-full"
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

                    {(isOwner || canEdit) && (
                      <details className="mt-auto text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none py-1 hover:text-[#f5f5f5]">
                          Comissão e casa
                        </summary>
                        <p className="pt-1">
                          Comissão {formatPriceBRL(totals.commissionCents)} ·
                          Casa{" "}
                          {formatPriceBRL(
                            totals.totalCents - totals.commissionCents
                          )}
                        </p>
                      </details>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          <div className="booking-footer shrink-0 border-t px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-3 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center justify-between gap-2 sm:contents">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="booking-btn-ghost h-10 shrink-0 sm:h-9"
                    onClick={() => onOpenChange(false)}
                    disabled={busy}
                  >
                    Voltar
                  </Button>

                  {hasSecondaryActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="booking-btn-ghost size-10 shrink-0 sm:size-9"
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

                <div className="min-w-0 text-right sm:mr-auto sm:flex-1 sm:px-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {paymentShortfall
                      ? "Falta"
                      : paymentOverpayCents > 0
                        ? "Troco"
                        : "Total"}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      paymentShortfall
                        ? "text-[#f87171]"
                        : "text-[var(--booking-accent,#ecf15e)]"
                    )}
                  >
                    {formatPriceBRL(
                      paymentShortfall
                        ? paymentShortfallCents
                        : paymentOverpayCents > 0
                          ? paymentOverpayCents
                          : totals.totalCents
                    )}
                  </p>
                </div>
              </div>

              {(canFinalize ||
                (loading &&
                  !isClosed &&
                  hasActiveLinked &&
                  (isOwner || permissions.canCloseComanda))) && (
                <Button
                  type="button"
                  className="booking-btn-primary h-11 w-full shrink-0 sm:h-9 sm:w-auto sm:min-w-40"
                  onClick={handleClose}
                  disabled={
                    !canFinalize ||
                    busy ||
                    loading ||
                    !cashRegisterOpen ||
                    paymentShortfallCents > 0
                  }
                  aria-busy={closing || (loading && !comanda)}
                >
                  {loading && !comanda ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Preparando…
                    </>
                  ) : closing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Finalizando…
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Finalizar comanda
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CancelAppointmentDialog
        open={confirmCancel}
        onOpenChange={(dialogOpen) => {
          setConfirmCancel(dialogOpen);
          if (!dialogOpen) {
            setCancelReason("");
            setCancelTargetId(null);
            setCancelTargetLabel(null);
          }
        }}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={() => void handleCancel()}
        busy={busy}
        kind={
          appointmentToCancel?.isComandaExtra
            ? "extra"
            : appointmentToCancel?.isSqueezeIn
              ? "squeeze"
              : "normal"
        }
        customerName={customerName}
        professionalNickname={appointmentToCancel?.professionalNickname}
        startTime={appointmentToCancel?.startTime}
        endTime={appointmentToCancel?.endTime}
        serviceLabel={cancelTargetLabel}
        dateLabel={formatDateBR(serviceDate)}
        detailNote={
          appointmentToCancel && linkedAppointments.length > 1
            ? `Será cancelado o horário de ${appointmentToCancel.professionalNickname} (${formatTime(appointmentToCancel.startTime)}${
                appointmentToCancel.isComandaExtra
                  ? " · serviço extra"
                  : appointmentToCancel.isSqueezeIn
                    ? " · encaixe"
                    : ""
              }).`
            : null
        }
      />

      <Dialog
        open={servicePickerOpen}
        onOpenChange={(next) => {
          if (!busy) {
            setServicePickerOpen(next);
            if (!next) setServiceSearch("");
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog flex max-h-[min(92dvh,640px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              if (!busy) {
                setServicePickerOpen(false);
                setServiceSearch("");
              }
            }}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
          <DialogHeader className="booking-header shrink-0 gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
            <div className="flex items-start gap-3">
              <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Scissors className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                  Adicionar serviço
                </DialogTitle>
                <DialogDescription>
                  Entra na comanda e na agenda como serviço extra.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="shrink-0 px-4 pt-4 sm:px-5">
            <SearchInput
              value={serviceSearch}
              onChange={setServiceSearch}
              placeholder="Buscar serviço…"
            />
          </div>
          <ul
            className="min-h-0 max-h-[min(55dvh,28rem)] flex-1 touch-pan-y space-y-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
            role="listbox"
          >
            {filteredServices.length === 0 ? (
              <li className="booking-notice rounded-xl px-3 py-6 text-center text-sm">
                Nenhum serviço encontrado.
              </li>
            ) : (
              filteredServices.map((svc) => (
                <li key={svc.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="booking-pick flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                    onClick={() => void pickService(svc)}
                    disabled={busy}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#f5f5f5]">
                        {svc.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDuration(svc.durationMinutes)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-[#f5f5f5]">
                      {formatPriceBRL(svc.priceCents)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog
        open={productPickerOpen}
        onOpenChange={(next) => {
          if (!busy) {
            setProductPickerOpen(next);
            if (!next) setProductSearch("");
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog flex max-h-[min(92dvh,640px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              if (!busy) {
                setProductPickerOpen(false);
                setProductSearch("");
              }
            }}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
          <DialogHeader className="booking-header shrink-0 gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
            <div className="flex items-start gap-3">
              <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Package className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                  Adicionar produto
                </DialogTitle>
                <DialogDescription>
                  Escolha o item vendido. Depois você define quantidade e
                  barbeiro.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="shrink-0 px-4 pt-4 sm:px-5">
            <SearchInput
              value={productSearch}
              onChange={setProductSearch}
              placeholder="Buscar produto…"
            />
          </div>
          <ul
            className="min-h-0 max-h-[min(55dvh,28rem)] flex-1 touch-pan-y space-y-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
            role="listbox"
          >
            {filteredProducts.length === 0 ? (
              <li className="booking-notice rounded-xl px-3 py-6 text-center text-sm">
                Nenhum produto encontrado.
              </li>
            ) : (
              filteredProducts.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="booking-pick flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                    onClick={() => pickProduct(product)}
                    disabled={busy}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#f5f5f5]">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {product.categoryName} · estoque{" "}
                        {product.stockQuantity}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-[#f5f5f5]">
                      {formatPriceBRL(product.priceCents)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog max-h-[min(92dvh,560px)] w-[calc(100%-1.25rem)] gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setTipDialogOpen(false)}
            disabled={busy}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
          <DialogHeader className="booking-header gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
            <div className="flex items-start gap-3">
              <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Coins className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                  Gorjeta
                </DialogTitle>
                <DialogDescription>
                  O barbeiro recebe 100% do valor. Entra no total da comanda.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div className="space-y-2.5">
              <Label htmlFor="tip-draft-amount">Valor</Label>
              <div className="flex flex-wrap gap-2">
                {TIP_QUICK_CENTS.map((cents) => {
                  const selected = tipDraftCents === cents;
                  return (
                    <button
                      key={cents}
                      type="button"
                      disabled={busy}
                      onClick={() => setTipDraftCents(cents)}
                      className={cn(
                        "h-9 rounded-lg border px-3 text-sm tabular-nums transition-colors",
                        selected ? "booking-pick-active" : "booking-pick",
                        busy && "opacity-50"
                      )}
                    >
                      {formatPriceBRL(cents)}
                    </button>
                  );
                })}
              </div>
              <Input
                id="tip-draft-amount"
                className="h-11 tabular-nums"
                value={
                  tipDraftCents > 0 ? formatPriceBRL(tipDraftCents) : ""
                }
                onChange={(e) =>
                  setTipDraftCents(parsePriceInput(e.target.value))
                }
                placeholder="Ou digite outro valor"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tip-draft-professional">Quem recebe</Label>
              <Select
                value={tipDraftProfessionalId}
                onValueChange={setTipDraftProfessionalId}
                disabled={busy || tipEligibleProfessionals.length === 0}
              >
                <SelectTrigger id="tip-draft-professional" className="h-11">
                  <SelectValue placeholder="Escolha o barbeiro" />
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
            {tipDraftCents > 0 && tipDraftProfessionalId ? (
              <div className="booking-context rounded-xl px-3.5 py-3 text-sm">
                <p className="font-medium text-[#f5f5f5]">
                  {formatPriceBRL(tipDraftCents)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Para{" "}
                  {tipEligibleProfessionals.find(
                    (pro) => pro.id === tipDraftProfessionalId
                  )?.nickname ?? "barbeiro"}
                </p>
              </div>
            ) : null}
          </div>
          <div className="booking-footer flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
            {tipCents > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="booking-btn-danger"
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
                className="booking-btn-ghost"
                disabled={busy}
                onClick={() => setTipDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="booking-btn-primary"
                disabled={busy || tipDraftCents <= 0 || !tipDraftProfessionalId}
                onClick={confirmTipDialog}
              >
                Confirmar gorjeta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOverpayCredit}
        onOpenChange={(next) => {
          if (!next && closing) return;
          setConfirmOverpayCredit(next);
        }}
      >
        <DialogContent className="admin-booking-dialog rounded-2xl ring-0 sm:max-w-md">
          {closing && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[rgb(14_15_17_/_88%)]"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="size-7 animate-spin text-[var(--booking-accent,#ecf15e)]"
                aria-hidden
              />
              <p className="text-sm font-medium text-[#f5f5f5]">
                Finalizando comanda…
              </p>
            </div>
          )}
          <DialogHeader>
            <DialogTitle className="booking-display text-[#f5f5f5]">
              Guardar o troco como crédito?
            </DialogTitle>
            <DialogDescription>
              O cliente pagou{" "}
              <strong className="text-[#f5f5f5]">
                {formatPriceBRL(paymentOverpayCents)}
              </strong>{" "}
              a mais que o total ({formatPriceBRL(totals.totalCents)}). Deseja
              guardar esse valor como crédito?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="booking-btn-ghost"
              disabled={busy}
              onClick={() => void finalizeComanda(false)}
            >
              {closing ? "Finalizando…" : "Não, foi troco"}
            </Button>
            <Button
              type="button"
              className="booking-btn-primary"
              disabled={busy}
              onClick={() => void finalizeComanda(true)}
              aria-busy={closing}
            >
              {closing ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Finalizando…
                </>
              ) : (
                "Sim, guardar crédito"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCreditShortfallCents !== null}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen && !busy) setConfirmCreditShortfallCents(null);
        }}
      >
        <DialogContent className="admin-booking-dialog rounded-2xl ring-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="booking-display text-[#f5f5f5]">
              Crédito já foi usado
            </DialogTitle>
            <DialogDescription>
              Esta comanda gerou crédito e o cliente já usou{" "}
              <strong className="text-[#f5f5f5]">
                {formatPriceBRL(confirmCreditShortfallCents ?? 0)}
              </strong>{" "}
              em outro atendimento. Esse valor gasto não volta. Já o crédito
              usado como pagamento nesta comanda volta para o cliente. Continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="booking-btn-ghost"
              disabled={busy}
              onClick={() => setConfirmCreditShortfallCents(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="booking-btn-primary"
              disabled={busy}
              onClick={() => void handleReopen(true)}
            >
              Reabrir mesmo assim
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
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog flex max-h-[min(92dvh,720px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              if (!busy) {
                setPendingExtraService(null);
                setExtraProfessionalId("");
                setExtraStartTime("");
              }
            }}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
          <DialogHeader className="booking-header shrink-0 gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
            <div className="flex items-start gap-3">
              <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Scissors className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                  Serviço extra
                </DialogTitle>
                <DialogDescription>
                  Define barbeiro e horário. Entra na agenda como encaixe.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {pendingExtraService ? (
              <div className="booking-context rounded-xl px-3.5 py-3">
                <p className="text-sm font-medium text-[#f5f5f5]">
                  {pendingExtraService.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatPriceBRL(pendingExtraService.priceCents)} ·{" "}
                  {formatDuration(pendingExtraService.durationMinutes)} ·{" "}
                  {formatDateBR(serviceDate)}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="extra-professional">Barbeiro</Label>
              <Select
                value={extraProfessionalId}
                onValueChange={setExtraProfessionalId}
                disabled={busy}
              >
                <SelectTrigger id="extra-professional" className="h-11 w-full">
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
                <p className="booking-notice rounded-xl px-3 py-4 text-center text-sm">
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
                  className="booking-slot-grid"
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

            {extraConflicts.length > 0 && extraStartTime ? (
              <p className="booking-notice rounded-xl px-3 py-2.5 text-xs">
                Sobrepõe:{" "}
                <span className="font-medium text-[#f5f5f5]">
                  {extraConflicts
                    .map(
                      (apt) =>
                        `${apt.customerFirstName} ${apt.customerLastName} (${formatTime(apt.startTime)})`
                    )
                    .join(" · ")}
                </span>
              </p>
            ) : null}
          </div>

          <div className="booking-footer flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="booking-btn-ghost"
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
              className="booking-btn-primary"
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
        <DialogContent
          showCloseButton={false}
          className="admin-booking-dialog flex max-h-[min(92dvh,640px)] w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-md"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              if (!busy) {
                setPendingProduct(null);
                setProductProfessionalId("");
                setProductQuantity("1");
              }
            }}
            className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
          <DialogHeader className="booking-header gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:px-5 sm:pr-14">
            <div className="flex items-start gap-3">
              <div className="booking-section-icon flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Package className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
                  Confirmar produto
                </DialogTitle>
                <DialogDescription>
                  Quantidade e quem vendeu. Sem barbeiro, a venda fica só da
                  barbearia.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-4 py-4 sm:px-5">
            {pendingProduct ? (
              <div className="booking-context rounded-xl px-3.5 py-3">
                <p className="text-sm font-medium text-[#f5f5f5]">
                  {pendingProduct.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatPriceBRL(pendingProduct.priceCents)} cada ·{" "}
                  {pendingProduct.categoryName} · estoque{" "}
                  {pendingProduct.stockQuantity}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="product-professional">Barbeiro que vendeu</Label>
              <Select
                value={productProfessionalId || PRODUCT_NO_PROFESSIONAL}
                onValueChange={(value) =>
                  setProductProfessionalId(
                    value === PRODUCT_NO_PROFESSIONAL ? "" : value
                  )
                }
                disabled={busy}
              >
                <SelectTrigger id="product-professional" className="h-11 w-full">
                  <SelectValue placeholder="Escolha o barbeiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PRODUCT_NO_PROFESSIONAL}>
                    Sem profissional
                  </SelectItem>
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="booking-btn-ghost size-11 shrink-0"
                  disabled={busy || Number.parseInt(productQuantity || "1", 10) <= 1}
                  onClick={() => {
                    const current = Math.max(
                      1,
                      Number.parseInt(productQuantity || "1", 10) || 1
                    );
                    setProductQuantity(String(Math.max(1, current - 1)));
                  }}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="product-quantity"
                  inputMode="numeric"
                  className="h-11 text-center tabular-nums"
                  value={productQuantity}
                  onChange={(event) =>
                    setProductQuantity(event.target.value.replace(/\D/g, ""))
                  }
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="booking-btn-ghost size-11 shrink-0"
                  disabled={
                    busy ||
                    (pendingProduct != null &&
                      (Number.parseInt(productQuantity || "1", 10) || 1) >=
                        pendingProduct.stockQuantity)
                  }
                  onClick={() => {
                    const current = Math.max(
                      1,
                      Number.parseInt(productQuantity || "1", 10) || 1
                    );
                    const max = pendingProduct?.stockQuantity ?? current + 1;
                    setProductQuantity(String(Math.min(max, current + 1)));
                  }}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {pendingProduct ? (
                <p className="text-xs text-muted-foreground">
                  Subtotal:{" "}
                  <span className="font-medium tabular-nums text-[#f5f5f5]">
                    {formatPriceBRL(
                      pendingProduct.priceCents *
                        Math.max(
                          1,
                          Number.parseInt(productQuantity || "1", 10) || 1
                        )
                    )}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="booking-footer flex justify-end gap-2 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="booking-btn-ghost"
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
              className="booking-btn-primary"
              onClick={() => void confirmAddProduct()}
              disabled={busy || !pendingProduct}
            >
              Adicionar à comanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
