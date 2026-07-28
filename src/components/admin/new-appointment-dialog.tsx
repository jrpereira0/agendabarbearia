"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminCustomerFields } from "@/components/admin/admin-customer-fields";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import { SearchInput } from "@/components/admin/search-input";
import { TimeSlotGrid } from "@/components/admin/time-slot-grid";
import { ServiceThumbnail } from "@/components/booking/service-thumbnail";
import { SlotGridSkeleton } from "@/components/skeletons/slot-grid-skeleton";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatTime,
} from "@/lib/format";
import type { MinuteRange } from "@/lib/availability";
import {
  minutesToTime,
  timeToMinutes,
} from "@/lib/availability";
import {
  encaixeTimeSlots,
  findAppointmentConflicts,
  isOutsideProfessionalSchedule,
} from "@/lib/encaixe";
import { matchesSearch } from "@/lib/text";
import { groupServicesForBooking } from "@/lib/booking-service-groups";
import { countServiceQuantities } from "@/lib/appointment-service-quantities";
import { cn } from "@/lib/utils";
import {
  createNormalAppointment,
  createSqueezeInAppointment,
} from "@/app/admin/(panel)/agenda/actions";

export type BookingMode = "normal" | "encaixe";

export type ProfessionalOption = {
  id: string;
  nickname: string;
  photoUrl: string | null;
  photoPosition?: string | null;
  serviceIds: string[];
};

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  photoUrl?: string | null;
  photoPosition?: string | null;
  bookingCount?: number;
};

type Step = "professional" | "services" | "time" | "client";

type NewAppointmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  professionals: ProfessionalOption[];
  services: ServiceOption[];
  isOwner: boolean;
  defaultProfessionalId: string | null;
  defaultStartTime?: string | null;
  mode: BookingMode;
  slotStepMinutes: number;
  appointments: AppointmentItem[];
  professionalSchedules: { id: string; availableRanges: MinuteRange[] }[];
  /** Chamado assim que o horário é salvo — pra card aparecer na grade na hora. */
  onCreated?: (appointment: AppointmentItem) => void;
};

function initialStep(
  isOwner: boolean,
  defaultProfessionalId: string | null,
  presetFromGrid: boolean
): Step {
  if (presetFromGrid) return "services";
  if (isOwner && !defaultProfessionalId) return "professional";
  return "services";
}

function stepNumber(
  step: Step,
  isOwner: boolean,
  presetFromGrid: boolean
): number {
  if (presetFromGrid) {
    return step === "client" ? 2 : 1;
  }
  const order: Step[] = isOwner
    ? ["professional", "services", "time", "client"]
    : ["services", "time", "client"];
  return order.indexOf(step) + 1;
}

function totalSteps(isOwner: boolean, presetFromGrid: boolean): number {
  if (presetFromGrid) return 2;
  return isOwner ? 4 : 3;
}

function getStepMeta(
  step: Step,
  presetFromGrid: boolean,
  isEncaixe: boolean
): { title: string; description: string } {
  const meta: Record<Step, { title: string; description: string }> = {
    professional: {
      title: "Quem vai atender?",
      description: "Escolha o barbeiro para este agendamento.",
    },
    services: {
      title: presetFromGrid ? "O que vai fazer?" : "Escolha os serviços",
      description: "Pode marcar mais de um.",
    },
    time: {
      title: isEncaixe ? "Horário do encaixe" : "Qual horário?",
      description: isEncaixe
        ? "Pode sobrepor outros agendamentos."
        : "Só aparecem horários livres neste dia.",
    },
    client: {
      title: "Dados do cliente",
      description: "Confira o resumo e preencha nome e WhatsApp.",
    },
  };
  return meta[step];
}

export function BookingContextBar({
  professional,
  date,
  startTime,
  services = [],
}: {
  professional: ProfessionalOption;
  date: string;
  startTime?: string | null;
  services?: ServiceOption[];
}) {
  const whenParts = [
    formatDateBR(date),
    startTime ? formatTime(startTime) : null,
  ].filter(Boolean);
  let serviceLabel: string | null = null;
  if (services.length === 1) {
    serviceLabel = services[0].name;
  } else if (services.length > 1) {
    const uniqueNames = [...new Set(services.map((s) => s.name))];
    serviceLabel =
      uniqueNames.length === 1
        ? `${uniqueNames[0]} ×${services.length}`
        : `${services.length} serviços`;
  }

  return (
    <div className="booking-context flex items-center gap-2.5 rounded-xl px-2.5 py-2">
      <ProfessionalAvatar
        photoUrl={professional.photoUrl}
        photoPosition={professional.photoPosition}
        name={professional.nickname}
        size="sm"
      />
      <div className="min-w-0 flex-1 leading-snug">
        <p className="truncate text-sm font-medium">{professional.nickname}</p>
        <p className="truncate text-xs text-muted-foreground">
          {whenParts.join(" · ")}
          {serviceLabel ? ` · ${serviceLabel}` : ""}
        </p>
      </div>
    </div>
  );
}

function ServicePickerRow({
  service,
  quantity,
  onChangeQuantity,
}: {
  service: ServiceOption;
  quantity: number;
  onChangeQuantity: (quantity: number) => void;
}) {
  const selected = quantity > 0;

  return (
    <div
      className={cn(
        "booking-pick flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
        selected && "booking-pick-active"
      )}
    >
      <button
        type="button"
        onClick={() => onChangeQuantity(selected ? 0 : 1)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ServiceThumbnail
          photoUrl={service.photoUrl ?? null}
          photoPosition={service.photoPosition}
          name={service.name}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{service.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDuration(service.durationMinutes)} ·{" "}
            {formatPriceBRL(service.priceCents)}
            {quantity > 1 ? ` · cada` : ""}
          </p>
        </div>
      </button>

      {selected ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Diminuir ${service.name}`}
            onClick={() => onChangeQuantity(Math.max(0, quantity - 1))}
            className="booking-btn-ghost flex size-8 items-center justify-center rounded-lg border"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-6 text-center text-sm font-medium tabular-nums">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={`Aumentar ${service.name}`}
            onClick={() => onChangeQuantity(quantity + 1)}
            className="booking-btn-ghost flex size-8 items-center justify-center rounded-lg border"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Adicionar ${service.name}`}
          onClick={() => onChangeQuantity(1)}
          className="booking-check flex size-8 shrink-0 items-center justify-center rounded-full border"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function ServicePickerList({
  services,
  quantities,
  onChangeQuantity,
}: {
  services: ServiceOption[];
  quantities: Map<string, number>;
  onChangeQuantity: (id: string, quantity: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {services.map((service) => (
        <li key={service.id}>
          <ServicePickerRow
            service={service}
            quantity={quantities.get(service.id) ?? 0}
            onChangeQuantity={(quantity) =>
              onChangeQuantity(service.id, quantity)
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < current ? "booking-progress-fill" : "booking-progress-track"
          )}
        />
      ))}
    </div>
  );
}

export function ModalActions({
  showBack,
  onBack,
  onCancel,
  primaryLabel,
  onPrimary,
  primaryType = "button",
  primaryDisabled = false,
  loading = false,
  formId,
  summary,
}: {
  showBack: boolean;
  onBack: () => void;
  onCancel: () => void;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryType?: "button" | "submit";
  primaryDisabled?: boolean;
  loading?: boolean;
  formId?: string;
  summary?: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {summary}
      <div className="flex w-full min-w-0 flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={loading}
          className="booking-btn-ghost h-10 w-full shrink-0 sm:h-9 sm:w-auto"
        >
          <ArrowLeft />
          Voltar
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCancel}
          disabled={loading}
          className="booking-btn-ghost h-10 w-full shrink-0 sm:h-9 sm:w-auto"
        >
          Cancelar
        </Button>
      )}
      <Button
        type={primaryType}
        form={formId}
        size="lg"
        onClick={onPrimary}
        disabled={primaryDisabled || loading}
        className="booking-btn-primary h-10 w-full shrink-0 sm:h-9 sm:w-auto sm:min-w-36"
      >
        {loading ? "Salvando..." : primaryLabel}
        {primaryType === "button" && !loading && <ArrowRight />}
      </Button>
      </div>
    </div>
  );
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  date,
  professionals,
  services,
  isOwner,
  defaultProfessionalId,
  defaultStartTime = null,
  mode,
  slotStepMinutes,
  appointments,
  professionalSchedules,
  onCreated,
}: NewAppointmentDialogProps) {
  const isEncaixe = mode === "encaixe";
  const presetFromGrid = Boolean(
    !isEncaixe && defaultProfessionalId && defaultStartTime
  );
  const [step, setStep] = useState<Step>("services");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingStartTime, setPendingStartTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const selectedProfessional = professionals.find((p) => p.id === professionalId);
  const stepsTotal = totalSteps(isOwner, presetFromGrid);
  const currentStep = stepNumber(step, isOwner, presetFromGrid);

  const availableServices = useMemo(() => {
    const allowed = new Set(selectedProfessional?.serviceIds ?? []);
    return services.filter((s) => allowed.has(s.id));
  }, [selectedProfessional, services]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return availableServices;
    return availableServices.filter((s) =>
      matchesSearch(s.name, serviceSearch)
    );
  }, [availableServices, serviceSearch]);

  const serviceGroups = useMemo(
    () =>
      groupServicesForBooking(filteredServices, {
        searching: Boolean(serviceSearch.trim()),
      }),
    [filteredServices, serviceSearch]
  );

  const selectedServices = useMemo(
    () =>
      serviceIds
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is ServiceOption => Boolean(s)),
    [services, serviceIds]
  );
  const serviceQuantities = useMemo(
    () => countServiceQuantities(serviceIds),
    [serviceIds]
  );
  const totalMinutes = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
    [selectedServices]
  );
  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.priceCents, 0),
    [selectedServices]
  );

  // Reinicia o assistente inteiro sempre que o diálogo abre de novo.
  const [syncedFor, setSyncedFor] = useState({
    open,
    defaultProfessionalId,
    defaultStartTime,
    isOwner,
    professionals,
    mode,
    isEncaixe,
    presetFromGrid,
  });
  const needsSync =
    open !== syncedFor.open ||
    defaultProfessionalId !== syncedFor.defaultProfessionalId ||
    defaultStartTime !== syncedFor.defaultStartTime ||
    isOwner !== syncedFor.isOwner ||
    professionals !== syncedFor.professionals ||
    mode !== syncedFor.mode ||
    isEncaixe !== syncedFor.isEncaixe ||
    presetFromGrid !== syncedFor.presetFromGrid;

  if (needsSync) {
    setSyncedFor({
      open,
      defaultProfessionalId,
      defaultStartTime,
      isOwner,
      professionals,
      mode,
      isEncaixe,
      presetFromGrid,
    });

    if (open) {
      setSaving(false);
      const proId =
        defaultProfessionalId ??
        (isOwner ? "" : professionals[0]?.id ?? "");
      setStep(initialStep(isOwner, defaultProfessionalId, presetFromGrid));
      setProfessionalId(proId);
      setServiceIds([]);
      setServiceSearch("");
      setStartTime(defaultStartTime);
      setPendingStartTime(defaultStartTime);
      setFirstName("");
      setLastName("");
      setWhatsapp("");
      setAvailableSlots([]);
      setSlotsError(null);
    }
  }

  const encaixeSlots = useMemo(
    () => encaixeTimeSlots(slotStepMinutes),
    [slotStepMinutes]
  );

  const ownerFreeMode = isOwner && !isEncaixe;

  const conflictAppointments = useMemo(
    () =>
      appointments.map((a) => ({
        id: a.id,
        customerFirstName: a.customerFirstName,
        customerLastName: a.customerLastName,
        startTime: a.startTime,
        endTime: a.endTime,
        professionalId: a.professionalId,
        status: a.status,
        isSqueezeIn: a.isSqueezeIn,
      })),
    [appointments]
  );

  const blockedSlots = useMemo(() => {
    if (!ownerFreeMode || !professionalId || totalMinutes === 0) {
      return new Set<string>();
    }

    const blocked = new Set<string>();
    for (const slot of encaixeSlots) {
      const start = timeToMinutes(slot);
      if (start + totalMinutes > 24 * 60) {
        blocked.add(slot);
        continue;
      }

      const conflicts = findAppointmentConflicts(
        professionalId,
        slot,
        totalMinutes,
        conflictAppointments,
        undefined,
        { ignoreSqueezeIn: true }
      );
      if (conflicts.length > 0) {
        blocked.add(slot);
      }
    }
    return blocked;
  }, [
    ownerFreeMode,
    professionalId,
    totalMinutes,
    encaixeSlots,
    conflictAppointments,
  ]);

  const timeSlots = ownerFreeMode || isEncaixe ? encaixeSlots : availableSlots;

  const selectedRanges = useMemo(
    () =>
      professionalSchedules.find((p) => p.id === professionalId)
        ?.availableRanges ?? [],
    [professionalSchedules, professionalId]
  );

  const selectedConflicts = useMemo(() => {
    if (!startTime || !professionalId || totalMinutes === 0) return [];
    return findAppointmentConflicts(
      professionalId,
      startTime,
      totalMinutes,
      conflictAppointments,
      undefined,
      { ignoreSqueezeIn: ownerFreeMode }
    );
  }, [
    startTime,
    professionalId,
    totalMinutes,
    conflictAppointments,
    ownerFreeMode,
  ]);

  const selectedOutsideSchedule = useMemo(() => {
    if (!startTime || totalMinutes === 0) return false;
    return isOutsideProfessionalSchedule(
      startTime,
      totalMinutes,
      selectedRanges
    );
  }, [startTime, totalMinutes, selectedRanges]);

  useEffect(() => {
    if (!open || step !== "time" || isEncaixe || ownerFreeMode) return;
    if (!professionalId || serviceIds.length === 0) return;

    let cancelled = false;
    // Defer pro próximo tick: evita "setState direto no efeito" e permite
    // cancelar (abaixo) antes de sequer começar a buscar.
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoadingSlots(true);
      setSlotsError(null);

      const params = new URLSearchParams({
        professionalId,
        date,
        serviceIds: serviceIds.join(","),
      });

      fetch(`/api/v1/appointments/availability?${params}`)
        .then(async (res) => {
          const body = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setAvailableSlots([]);
            setSlotsError(body.error ?? "Não foi possível carregar os horários.");
            return;
          }
          const loaded: string[] = body.slots ?? [];
          setAvailableSlots(loaded);
          if (loaded.length === 0) {
            setSlotsError("Nenhum horário livre neste dia para esses serviços.");
          } else if (pendingStartTime && loaded.includes(pendingStartTime)) {
            setStartTime(pendingStartTime);
            setPendingStartTime(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAvailableSlots([]);
            setSlotsError("Não foi possível carregar os horários.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingSlots(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    open,
    step,
    isEncaixe,
    ownerFreeMode,
    professionalId,
    date,
    serviceIds,
    pendingStartTime,
  ]);

  // Encaixe: assim que um horário pendente (vindo da grade) é válido, confirma.
  if (
    open &&
    step === "time" &&
    isEncaixe &&
    pendingStartTime &&
    encaixeSlots.includes(pendingStartTime)
  ) {
    setStartTime(pendingStartTime);
    setPendingStartTime(null);
  }

  function validatePresetTimeForServices(): boolean {
    if (!presetFromGrid || !startTime || !professionalId || totalMinutes === 0) {
      return true;
    }

    if (ownerFreeMode && blockedSlots.has(startTime)) {
      toast.error(
        "Esse horário não comporta a duração dos serviços escolhidos. Escolha outros serviços ou agende pelo botão + Agendar."
      );
      return false;
    }

    if (!ownerFreeMode && !isEncaixe) {
      const conflicts = findAppointmentConflicts(
        professionalId,
        startTime,
        totalMinutes,
        conflictAppointments,
        undefined,
        { ignoreSqueezeIn: false }
      );
      if (conflicts.length > 0) {
        toast.error(
          "Esse horário não cabe com os serviços escolhidos. Reduza a duração ou escolha outro horário."
        );
        return false;
      }
    }

    return true;
  }

  function setServiceQuantity(id: string, quantity: number) {
    const nextQty = Math.max(0, Math.min(20, quantity));
    setServiceIds((prev) => {
      const without = prev.filter((v) => v !== id);
      if (nextQty === 0) return without;
      return [...without, ...Array.from({ length: nextQty }, () => id)];
    });
    if (!presetFromGrid) {
      setStartTime(null);
      setPendingStartTime(null);
    }
  }

  function goBack() {
    if (step === "client") {
      setStep(presetFromGrid ? "services" : "time");
      return;
    }
    if (step === "time") setStep("services");
    else if (step === "services" && isOwner && !presetFromGrid) {
      setStep("professional");
    }
  }

  function goNext() {
    if (step === "professional") {
      if (!professionalId) {
        toast.error("Escolha o barbeiro.");
        return;
      }
      setStep("services");
      return;
    }

    if (step === "services") {
      if (serviceIds.length === 0) {
        toast.error("Escolha pelo menos um serviço.");
        return;
      }
      if (presetFromGrid && startTime) {
        if (!validatePresetTimeForServices()) return;
        setStep("client");
        return;
      }
      setStep("time");
      return;
    }

    if (step === "time") {
      if (!startTime) {
        toast.error("Escolha um horário.");
        return;
      }
      if (ownerFreeMode && blockedSlots.has(startTime)) {
        toast.error(
          "Esse horário já está ocupado. Use encaixe ou serviço extra na comanda."
        );
        return;
      }
      setStep("client");
    }
  }

  async function submitAppointment() {
    if (!firstName.trim() || !whatsapp.replace(/\D/g, "")) {
      toast.error("Preencha os dados do cliente.");
      return;
    }

    setSaving(true);
    const payload = {
      professionalId,
      date,
      startTime: startTime!,
      serviceIds,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsapp: whatsapp.replace(/\D/g, ""),
    };
    const result = isEncaixe
      ? await createSqueezeInAppointment(payload)
      : await createNormalAppointment(payload);

    if (result.ok) {
      toast.success(isEncaixe ? "Encaixe criado." : "Agendamento criado.");
      setSaving(false);
      onOpenChange(false);

      const appointmentId =
        "appointmentId" in result ? result.appointmentId : null;
      const professional = professionals.find((p) => p.id === professionalId);
      if (appointmentId && professional && startTime) {
        const endMinutes = timeToMinutes(startTime) + totalMinutes;
        onCreated?.({
          id: appointmentId,
          date,
          professionalId,
          professionalNickname: professional.nickname,
          customerFirstName: firstName.trim(),
          customerLastName: lastName.trim(),
          customerWhatsapp: whatsapp.replace(/\D/g, ""),
          startTime,
          endTime: minutesToTime(endMinutes),
          status: "scheduled",
          isSqueezeIn: isEncaixe,
          bookingSource: "admin",
          services: selectedServices.map((s) => ({
            id: s.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
          })),
        });
      }
    } else {
      toast.error(result.error);
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitAppointment();
  }

  const stepMeta = getStepMeta(step, presetFromGrid, isEncaixe);

  const servicesFooterSummary =
    step === "services" && serviceIds.length > 0 ? (
      <p className="text-center text-sm text-muted-foreground">
        {selectedServices.length}{" "}
        {selectedServices.length === 1 ? "serviço" : "serviços"} ·{" "}
        {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
      </p>
    ) : null;

  const showBack =
    step === "time" ||
    step === "client" ||
    (step === "services" && isOwner && !presetFromGrid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="admin-booking-dialog flex max-h-[min(92dvh,760px)] w-full max-w-[calc(100%-1.25rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 ring-0 sm:max-w-lg"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => onOpenChange(false)}
          className="booking-close absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-lg transition-colors"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
        <DialogHeader className="booking-header shrink-0 gap-3 border-b px-4 pb-4 pt-5 pr-14 sm:pl-6 sm:pr-14 sm:pt-6">
          <div className="flex items-center justify-between gap-3 pr-1 text-xs text-muted-foreground">
            <span>
              Passo {currentStep} de {stepsTotal}
            </span>
            {!(selectedProfessional && step !== "professional") && (
              <span className="truncate">{formatDateBR(date)}</span>
            )}
          </div>
          <StepProgress current={currentStep} total={stepsTotal} />
          <div className="space-y-1">
            <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
              {isEncaixe && step !== "client" ? "Encaixe" : stepMeta.title}
            </DialogTitle>
            <DialogDescription>{stepMeta.description}</DialogDescription>
          </div>
          {selectedProfessional && step !== "professional" && (
            <BookingContextBar
              professional={selectedProfessional}
              date={date}
              startTime={
                step === "services"
                  ? presetFromGrid
                    ? startTime
                    : null
                  : startTime
              }
              services={step === "services" ? [] : selectedServices}
            />
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {step === "professional" && (
            <ul className="flex flex-col gap-2">
              {professionals.map((pro) => {
                const selected = professionalId === pro.id;
                return (
                  <li key={pro.id}>
                    <button
                      type="button"
                      onClick={() => setProfessionalId(pro.id)}
                      className={cn(
                        "booking-pick flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
                        selected && "booking-pick-active"
                      )}
                    >
                      <ProfessionalAvatar
                        photoUrl={pro.photoUrl}
                        photoPosition={pro.photoPosition}
                        name={pro.nickname}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{pro.nickname}</p>
                        <p className="text-xs text-muted-foreground">Barbeiro</p>
                      </div>
                      <div
                        className={cn(
                          "booking-check flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          selected && "booking-check-active"
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {step === "services" && selectedProfessional && (
            <div className="flex flex-col gap-4">
              {availableServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esse profissional ainda não tem serviços vinculados.
                </p>
              ) : (
                <>
                  {availableServices.length > 4 && (
                    <SearchInput
                      value={serviceSearch}
                      onChange={setServiceSearch}
                      placeholder="Buscar serviço..."
                    />
                  )}

                  {filteredServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum serviço encontrado.
                    </p>
                  ) : (
                    <>
                      {serviceGroups.popular.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Mais agendados
                          </p>
                          <ServicePickerList
                            services={serviceGroups.popular}
                            quantities={serviceQuantities}
                            onChangeQuantity={setServiceQuantity}
                          />
                        </div>
                      )}

                      {serviceGroups.others.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {serviceGroups.popular.length > 0 && (
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Outros serviços
                            </p>
                          )}
                          <ServicePickerList
                            services={serviceGroups.others}
                            quantities={serviceQuantities}
                            onChangeQuantity={setServiceQuantity}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {step === "time" && selectedProfessional && (
            <div className="flex flex-col gap-4">
              {ownerFreeMode && (
                <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                  Você pode agendar em qualquer horário. Horários já ocupados
                  precisam ser encaixe ou serviço extra na comanda.
                </p>
              )}

              {!isEncaixe && !ownerFreeMode && loadingSlots ? (
                <SlotGridSkeleton />
              ) : !isEncaixe && !ownerFreeMode && slotsError ? (
                <p className="booking-notice rounded-xl px-4 py-6 text-center text-sm">
                  {slotsError}
                </p>
              ) : (
                <TimeSlotGrid
                  slots={timeSlots}
                  value={startTime}
                  onChange={setStartTime}
                  isSlotDisabled={(slot) =>
                    ownerFreeMode && blockedSlots.has(slot)
                  }
                  scrollable={false}
                  className="booking-slot-grid"
                />
              )}

              {ownerFreeMode && startTime && selectedOutsideSchedule && (
                <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                  Fora do horário de funcionamento deste barbeiro.
                </p>
              )}

              {isEncaixe && startTime && selectedOutsideSchedule && (
                <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                  Fora do horário de funcionamento deste barbeiro.
                </p>
              )}

              {isEncaixe && startTime && selectedConflicts.length > 0 && (
                <div className="booking-notice rounded-xl px-4 py-3 text-sm">
                  <p className="font-medium">
                    Vai sobrepor{" "}
                    {selectedConflicts.length === 1
                      ? "1 agendamento"
                      : `${selectedConflicts.length} agendamentos`}
                    :
                  </p>
                  <ul className="mt-2 space-y-1">
                    {selectedConflicts.map((c, i) => (
                      <li key={`${c.startTime}-${i}`}>
                        {c.customerFirstName} {c.customerLastName} ·{" "}
                        {formatTime(c.startTime)} – {formatTime(c.endTime)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "client" && selectedProfessional && (
            <form
              id="new-appointment-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
            >
              {isEncaixe &&
                (selectedOutsideSchedule || selectedConflicts.length > 0) && (
                  <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                    Este é um encaixe manual
                    {selectedOutsideSchedule ? ", fora do expediente" : ""}
                    {selectedConflicts.length > 0
                      ? `, sobrepondo ${selectedConflicts.length} agendamento${selectedConflicts.length > 1 ? "s" : ""}`
                      : ""}
                    .
                  </p>
                )}

              <AdminCustomerFields
                firstName={firstName}
                lastName={lastName}
                whatsapp={whatsapp}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onWhatsappChange={setWhatsapp}
                enabled={open && step === "client"}
                idPrefix="newCustomer"
              />
            </form>
          )}
        </div>

        <div className="booking-footer min-w-0 shrink-0 overflow-hidden rounded-b-2xl border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
          {step === "client" ? (
            <ModalActions
              showBack
              onBack={goBack}
              onCancel={() => onOpenChange(false)}
              primaryLabel={isEncaixe ? "Confirmar encaixe" : "Confirmar agendamento"}
              onPrimary={() => {
                void submitAppointment();
              }}
              loading={saving}
            />
          ) : (
            <ModalActions
              showBack={showBack}
              onBack={goBack}
              onCancel={() => onOpenChange(false)}
              primaryLabel="Continuar"
              onPrimary={goNext}
              summary={servicesFooterSummary}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
