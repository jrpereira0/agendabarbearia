"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminCustomerFields } from "@/components/admin/admin-customer-fields";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import { SearchInput } from "@/components/admin/search-input";
import { TimeSlotGrid } from "@/components/admin/time-slot-grid";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatTime,
} from "@/lib/format";
import type { MinuteRange } from "@/lib/availability";
import { timeToMinutes } from "@/lib/availability";
import {
  encaixeTimeSlots,
  findAppointmentConflicts,
  isOutsideProfessionalSchedule,
} from "@/lib/encaixe";
import { matchesSearch } from "@/lib/text";
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
  serviceIds: string[];
};

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
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
};

function initialStep(
  isOwner: boolean,
  defaultProfessionalId: string | null
): Step {
  if (isOwner && !defaultProfessionalId) return "professional";
  return "services";
}

function stepNumber(step: Step, isOwner: boolean): number {
  const order: Step[] = isOwner
    ? ["professional", "services", "time", "client"]
    : ["services", "time", "client"];
  return order.indexOf(step) + 1;
}

function totalSteps(isOwner: boolean): number {
  return isOwner ? 4 : 3;
}

function ProfessionalBanner({
  professional,
}: {
  professional: ProfessionalOption;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
      <ProfessionalAvatar
        photoUrl={professional.photoUrl}
        name={professional.nickname}
        size="lg"
      />
      <div className="min-w-0">
        <p className="truncate font-medium">{professional.nickname}</p>
        <p className="text-sm text-muted-foreground">Barbeiro</p>
      </div>
    </div>
  );
}

function StepProgress({
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
            i < current ? "bg-foreground" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

function ModalActions({
  showBack,
  onBack,
  onCancel,
  primaryLabel,
  onPrimary,
  primaryType = "button",
  primaryDisabled = false,
  loading = false,
  formId,
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
}) {
  return (
    <div className="flex w-full min-w-0 flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={loading}
          className="h-10 w-full shrink-0 sm:h-9 sm:w-auto"
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
          className="h-10 w-full shrink-0 sm:h-9 sm:w-auto"
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
        className="h-10 w-full shrink-0 sm:h-9 sm:w-auto sm:min-w-36"
      >
        {loading ? "Salvando..." : primaryLabel}
        {primaryType === "button" && !loading && <ArrowRight />}
      </Button>
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
}: NewAppointmentDialogProps) {
  const isEncaixe = mode === "encaixe";
  const router = useRouter();
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
  const stepsTotal = totalSteps(isOwner);
  const currentStep = stepNumber(step, isOwner);

  const availableServices = useMemo(() => {
    const allowed = new Set(selectedProfessional?.serviceIds ?? []);
    return services
      .filter((s) => allowed.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [selectedProfessional, services]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return availableServices;
    return availableServices.filter((s) =>
      matchesSearch(s.name, serviceSearch)
    );
  }, [availableServices, serviceSearch]);

  const selectedServices = services.filter((s) => serviceIds.includes(s.id));
  const totalMinutes = selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const totalPrice = selectedServices.reduce(
    (sum, s) => sum + s.priceCents,
    0
  );

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    const proId =
      defaultProfessionalId ??
      (isOwner ? "" : professionals[0]?.id ?? "");
    setStep(initialStep(isOwner, defaultProfessionalId));
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
  }, [open, defaultProfessionalId, defaultStartTime, isOwner, professionals, mode]);

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
    setLoadingSlots(true);
    setSlotsError(null);

    const params = new URLSearchParams({
      professionalId,
      date,
      serviceIds: serviceIds.join(","),
    });

    fetch(`/api/v1/availability?${params}`)
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

    return () => {
      cancelled = true;
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

  useEffect(() => {
    if (!open || step !== "time" || !isEncaixe || !pendingStartTime) return;
    if (encaixeSlots.includes(pendingStartTime)) {
      setStartTime(pendingStartTime);
      setPendingStartTime(null);
    }
  }, [open, step, isEncaixe, pendingStartTime, encaixeSlots]);

  function toggleService(id: string, checked: boolean) {
    setServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id)
    );
    setStartTime(null);
    setPendingStartTime(null);
  }

  function goBack() {
    if (step === "client") setStep("time");
    else if (step === "time") setStep("services");
    else if (step === "services" && isOwner) setStep("professional");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !whatsapp.replace(/\D/g, "")) {
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
      router.refresh();
    } else {
      toast.error(result.error);
      setSaving(false);
    }
  }

  const stepLabels: Record<Step, string> = {
    professional: "Barbeiro",
    services: "Serviços",
    time: "Horário",
    client: "Cliente",
  };

  const showBack =
    step === "time" || step === "client" || (step === "services" && isOwner);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-3 border-b px-4 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
          <div className="space-y-1">
            <DialogTitle>
              {isEncaixe ? "Encaixe" : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              {formatDateBR(date)} · {stepLabels[step]}
            </DialogDescription>
          </div>
          <StepProgress current={currentStep} total={stepsTotal} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {step === "professional" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Quem vai atender?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {professionals.map((pro) => {
                  const selected = professionalId === pro.id;
                  return (
                    <button
                      key={pro.id}
                      type="button"
                      onClick={() => setProfessionalId(pro.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50",
                        selected && "border-primary bg-muted/50"
                      )}
                    >
                      <ProfessionalAvatar
                        photoUrl={pro.photoUrl}
                        name={pro.nickname}
                        size="lg"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {pro.nickname}
                      </span>
                      {selected && (
                        <Check className="size-4 shrink-0 text-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "services" && selectedProfessional && (
            <div className="flex flex-col gap-5">
              <ProfessionalBanner professional={selectedProfessional} />

              {availableServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esse profissional ainda não tem serviços vinculados.
                </p>
              ) : (
                <>
                  <SearchInput
                    value={serviceSearch}
                    onChange={setServiceSearch}
                    placeholder="Buscar serviço..."
                  />

                  {filteredServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum serviço encontrado.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {filteredServices.map((svc) => {
                        const checked = serviceIds.includes(svc.id);
                        return (
                          <label
                            key={svc.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50",
                              checked && "border-primary bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) =>
                                toggleService(svc.id, c === true)
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium leading-snug">
                                {svc.name}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {formatDuration(svc.durationMinutes)} ·{" "}
                                {formatPriceBRL(svc.priceCents)}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {serviceIds.length > 0 && (
                    <p className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      Total: {formatDuration(totalMinutes)} ·{" "}
                      {formatPriceBRL(totalPrice)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === "time" && selectedProfessional && (
            <div className="flex flex-col gap-5">
              <ProfessionalBanner professional={selectedProfessional} />

              {serviceIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedServices.map((s) => s.name).join(", ")} ·{" "}
                  {formatDuration(totalMinutes)}
                </p>
              )}

              {isEncaixe ? (
                <p className="text-sm text-muted-foreground">
                  Escolha qualquer horário. Encaixes podem sobrepor outros
                  agendamentos e ficar fora do expediente.
                </p>
              ) : ownerFreeMode ? (
                <p className="text-sm text-muted-foreground">
                  Você pode agendar em qualquer horário, inclusive fora do
                  expediente e em datas passadas. Horários já ocupados precisam
                  ser encaixe ou serviço extra na comanda.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Só aparecem horários livres neste dia.
                </p>
              )}

              {!isEncaixe && !ownerFreeMode && loadingSlots ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Carregando horários...
                </p>
              ) : !isEncaixe && !ownerFreeMode && slotsError ? (
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
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
                />
              )}

              {ownerFreeMode && startTime && selectedOutsideSchedule && (
                <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Fora do horário de funcionamento deste barbeiro.
                </p>
              )}

              {isEncaixe && startTime && selectedOutsideSchedule && (
                <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  Fora do horário de funcionamento deste barbeiro.
                </p>
              )}

              {isEncaixe && startTime && selectedConflicts.length > 0 && (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Vai sobrepor {selectedConflicts.length === 1 ? "1 agendamento" : `${selectedConflicts.length} agendamentos`}:
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
              <ProfessionalBanner professional={selectedProfessional} />

              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <p className="font-medium">
                    {formatDateBR(date)} às {startTime}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {selectedServices.map((s) => s.name).join(", ")} ·{" "}
                    {formatPriceBRL(totalPrice)}
                  </p>
                </div>

                {isEncaixe &&
                  (selectedOutsideSchedule || selectedConflicts.length > 0) && (
                  <p className="text-sm text-muted-foreground">
                    Este é um encaixe manual
                    {selectedOutsideSchedule ? ", fora do expediente" : ""}
                    {selectedConflicts.length > 0
                      ? `, sobrepondo ${selectedConflicts.length} agendamento${selectedConflicts.length > 1 ? "s" : ""}`
                      : ""}
                    .
                  </p>
                )}
              </div>

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

        <div className="min-w-0 shrink-0 overflow-hidden rounded-b-xl border-t bg-muted/30 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
          {step === "client" ? (
            <ModalActions
              showBack
              onBack={goBack}
              onCancel={() => onOpenChange(false)}
              primaryLabel={isEncaixe ? "Confirmar encaixe" : "Confirmar agendamento"}
              primaryType="submit"
              formId="new-appointment-form"
              loading={saving}
            />
          ) : (
            <ModalActions
              showBack={showBack}
              onBack={goBack}
              onCancel={() => onOpenChange(false)}
              primaryLabel="Continuar"
              onPrimary={goNext}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
