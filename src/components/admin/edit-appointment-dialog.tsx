"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import { SearchInput } from "@/components/admin/search-input";
import {
  BookingContextBar,
  ModalActions,
  ServicePickerList,
  StepProgress,
  type ProfessionalOption,
  type ServiceOption,
} from "@/components/admin/new-appointment-dialog";
import { AdminCustomerFields } from "@/components/admin/admin-customer-fields";
import { TimeSlotGrid } from "@/components/admin/time-slot-grid";
import { SlotGridSkeleton } from "@/components/skeletons/slot-grid-skeleton";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import type { MinuteRange } from "@/lib/availability";
import { timeToMinutes } from "@/lib/availability";
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
  updateAppointment,
  getEditAvailabilitySlots,
} from "@/app/admin/(panel)/agenda/actions";

type Step = "professional" | "services" | "time" | "client";

type EditAppointmentDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: ProfessionalOption[];
  services: ServiceOption[];
  isOwner: boolean;
  slotStepMinutes: number;
  appointments: AppointmentItem[];
  professionalSchedules: { id: string; availableRanges: MinuteRange[] }[];
};

function stepOrder(isOwner: boolean): Step[] {
  return isOwner
    ? ["professional", "services", "time", "client"]
    : ["services", "time", "client"];
}

function getStepMeta(
  step: Step,
  isEncaixe: boolean
): { title: string; description: string } {
  const meta: Record<Step, { title: string; description: string }> = {
    professional: {
      title: "Quem atende?",
      description: "Troque o barbeiro deste horário, se precisar.",
    },
    services: {
      title: "Serviços",
      description: "Ajuste o que será feito neste atendimento.",
    },
    time: {
      title: isEncaixe ? "Horário do encaixe" : "Horário",
      description: isEncaixe
        ? "Pode sobrepor outros agendamentos."
        : "Mantenha o atual ou escolha outro livre.",
    },
    client: {
      title: "Cliente",
      description: "Confira o resumo e os dados de quem será atendido.",
    },
  };
  return meta[step];
}

export function EditAppointmentDialog({
  appointment,
  open,
  onOpenChange,
  professionals,
  services,
  isOwner,
  slotStepMinutes,
  appointments,
  professionalSchedules,
}: EditAppointmentDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("services");
  const [professionalId, setProfessionalId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEncaixe = appointment?.isSqueezeIn ?? false;
  const ownerFreeMode = isOwner && !isEncaixe;
  const selectedProfessional = professionals.find((p) => p.id === professionalId);
  const order = stepOrder(isOwner);
  const stepsTotal = order.length;
  const currentStep = order.indexOf(step) + 1;

  const availableServices = useMemo(() => {
    const allowed = new Set(selectedProfessional?.serviceIds ?? []);
    return services.filter((s) => allowed.has(s.id));
  }, [services, selectedProfessional]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return availableServices;
    return availableServices.filter((s) => matchesSearch(s.name, serviceSearch));
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

  const encaixeSlots = useMemo(
    () => encaixeTimeSlots(slotStepMinutes),
    [slotStepMinutes]
  );

  const timeSlots = useMemo(() => {
    const base = isEncaixe || ownerFreeMode ? encaixeSlots : availableSlots;
    if (startTime && !base.includes(startTime)) {
      return [...base, startTime].sort();
    }
    return base;
  }, [isEncaixe, ownerFreeMode, encaixeSlots, availableSlots, startTime]);

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
      if (timeToMinutes(slot) + totalMinutes > 24 * 60) {
        blocked.add(slot);
        continue;
      }

      const conflicts = findAppointmentConflicts(
        professionalId,
        slot,
        totalMinutes,
        conflictAppointments,
        appointment?.id,
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
    appointment?.id,
  ]);

  const selectedRanges = useMemo(
    () =>
      professionalSchedules.find((p) => p.id === professionalId)
        ?.availableRanges ?? [],
    [professionalSchedules, professionalId]
  );

  const selectedConflicts = useMemo(() => {
    if (!appointment || !startTime || totalMinutes === 0 || !professionalId) {
      return [];
    }
    return findAppointmentConflicts(
      professionalId,
      startTime,
      totalMinutes,
      conflictAppointments,
      appointment.id,
      { ignoreSqueezeIn: isOwner && !isEncaixe }
    );
  }, [
    appointment,
    professionalId,
    startTime,
    totalMinutes,
    conflictAppointments,
    isOwner,
    isEncaixe,
  ]);

  const selectedOutsideSchedule = useMemo(() => {
    if (!startTime || totalMinutes === 0) return false;
    return isOutsideProfessionalSchedule(
      startTime,
      totalMinutes,
      selectedRanges
    );
  }, [startTime, totalMinutes, selectedRanges]);

  const [syncedFor, setSyncedFor] = useState({
    open,
    appointmentId: appointment?.id ?? null,
  });
  if (
    open !== syncedFor.open ||
    (appointment?.id ?? null) !== syncedFor.appointmentId
  ) {
    setSyncedFor({ open, appointmentId: appointment?.id ?? null });

    if (open && appointment) {
      setSaving(false);
      setStep("services");
      setProfessionalId(appointment.professionalId);
      setFirstName(appointment.customerFirstName);
      setLastName(appointment.customerLastName);
      setWhatsapp(formatWhatsapp(appointment.customerWhatsapp));
      setServiceIds(appointment.services.map((s) => s.id));
      setStartTime(appointment.startTime);
      setServiceSearch("");
      setAvailableSlots([]);
      setSlotsError(null);
    }
  }

  const [serviceFilterSyncedFor, setServiceFilterSyncedFor] = useState({
    open,
    professionalId,
    professionals,
  });
  if (
    open &&
    professionalId &&
    (professionalId !== serviceFilterSyncedFor.professionalId ||
      professionals !== serviceFilterSyncedFor.professionals ||
      open !== serviceFilterSyncedFor.open)
  ) {
    setServiceFilterSyncedFor({ open, professionalId, professionals });
    const allowed = new Set(
      professionals.find((p) => p.id === professionalId)?.serviceIds ?? []
    );
    setServiceIds((prev) => prev.filter((id) => allowed.has(id)));
  }

  useEffect(() => {
    if (!open || step !== "time" || !appointment) return;
    if (isEncaixe || ownerFreeMode) return;
    if (serviceIds.length === 0 || !professionalId) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoadingSlots(true);
      setSlotsError(null);

      getEditAvailabilitySlots({
        professionalId,
        date: appointment.date,
        serviceIds,
        excludeAppointmentId: appointment.id,
      })
        .then((result) => {
          if (cancelled) return;
          if (!result.ok) {
            setAvailableSlots([]);
            setSlotsError(result.error);
            return;
          }
          setAvailableSlots(result.slots);
          if (result.slots.length === 0 && appointment.startTime) {
            setSlotsError(null);
          } else if (result.slots.length === 0) {
            setSlotsError(
              "Nenhum horário livre neste dia para esses serviços."
            );
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
    appointment,
    isEncaixe,
    ownerFreeMode,
    serviceIds,
    professionalId,
  ]);

  function setServiceQuantity(id: string, quantity: number) {
    const nextQty = Math.max(0, Math.min(20, quantity));
    setServiceIds((prev) => {
      const without = prev.filter((v) => v !== id);
      if (nextQty === 0) return without;
      return [...without, ...Array.from({ length: nextQty }, () => id)];
    });
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
      setStep("client");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;

    if (!firstName.trim() || !lastName.trim() || !whatsapp.replace(/\D/g, "")) {
      toast.error("Preencha os dados do cliente.");
      return;
    }

    if (serviceIds.length === 0) {
      toast.error("Escolha pelo menos um serviço.");
      return;
    }

    if (!startTime) {
      toast.error("Escolha um horário.");
      return;
    }

    if (!professionalId) {
      toast.error("Escolha o profissional.");
      return;
    }

    setSaving(true);
    const result = await updateAppointment({
      appointmentId: appointment.id,
      professionalId,
      startTime,
      serviceIds,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsapp: whatsapp.replace(/\D/g, ""),
    });

    if (result.ok) {
      toast.success("Agendamento atualizado.");
      setSaving(false);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
      setSaving(false);
    }
  }

  if (!appointment) return null;

  const stepMeta = getStepMeta(step, isEncaixe);
  const showBack =
    step === "time" ||
    step === "client" ||
    (step === "services" && isOwner);

  const servicesFooterSummary =
    step === "services" && serviceIds.length > 0 ? (
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
      </p>
    ) : null;

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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Editar · passo {currentStep} de {stepsTotal}
            </p>
          </div>
          <StepProgress current={currentStep} total={stepsTotal} />
          <div className="space-y-1">
            <DialogTitle className="booking-display text-lg tracking-tight text-[#f5f5f5]">
              {isEncaixe && step !== "client" ? "Editar encaixe" : stepMeta.title}
            </DialogTitle>
            <DialogDescription>{stepMeta.description}</DialogDescription>
          </div>
          {selectedProfessional && step !== "professional" && (
            <BookingContextBar
              professional={selectedProfessional}
              date={appointment.date}
              startTime={
                step === "services"
                  ? appointment.startTime
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
                        <p className="text-xs text-muted-foreground">
                          Barbeiro
                        </p>
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
                  Como dono, você pode escolher qualquer horário. Se estiver
                  ocupado, use encaixe.
                </p>
              )}

              {!isEncaixe && !ownerFreeMode && (
                <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                  O horário atual sempre pode ser mantido para corrigir
                  serviços ou dados.
                </p>
              )}

              {!isEncaixe && !ownerFreeMode && loadingSlots ? (
                <SlotGridSkeleton />
              ) : !isEncaixe && !ownerFreeMode && slotsError ? (
                <p className="booking-notice rounded-xl px-4 py-6 text-center text-sm">
                  {slotsError}
                </p>
              ) : (
                <>
                  {!isEncaixe &&
                    !ownerFreeMode &&
                    availableSlots.length === 0 &&
                    startTime && (
                      <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                        Só o horário atual está disponível — você ainda pode
                        mantê-lo e salvar.
                      </p>
                    )}
                  <TimeSlotGrid
                    slots={timeSlots}
                    value={startTime}
                    onChange={setStartTime}
                    buttonSize="sm"
                    buttonClassName="h-9"
                    className="booking-slot-grid"
                    isSlotDisabled={(slot) =>
                      Boolean(
                        ownerFreeMode &&
                          blockedSlots.has(slot) &&
                          slot !== startTime
                      )
                    }
                  />
                </>
              )}

              {(ownerFreeMode || isEncaixe) &&
                startTime &&
                selectedOutsideSchedule && (
                  <p className="booking-notice rounded-xl px-4 py-3 text-sm">
                    Fora do horário de funcionamento deste barbeiro.
                  </p>
                )}

              {isEncaixe && selectedConflicts.length > 0 && startTime && (
                <div className="booking-notice rounded-xl px-4 py-3 text-sm">
                  <p className="font-medium text-[#f5f5f5]">
                    Sobrepõe {selectedConflicts.length} agendamento
                    {selectedConflicts.length > 1 ? "s" : ""}:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {selectedConflicts.map((c) => (
                      <li key={`${c.startTime}-${c.customerFirstName}`}>
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
              id="edit-appointment-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
            >
              <div className="booking-context space-y-2 rounded-xl px-3.5 py-3 text-sm">
                <p className="font-medium text-[#f5f5f5]">
                  {formatDateBR(appointment.date)} · {formatTime(startTime!)}
                  {isEncaixe ? " · encaixe" : ""}
                </p>
                <p className="text-muted-foreground">
                  {selectedServices.map((s) => s.name).join(" · ")}
                </p>
                <p className="tabular-nums text-muted-foreground">
                  {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
                </p>
              </div>

              <AdminCustomerFields
                firstName={firstName}
                lastName={lastName}
                whatsapp={whatsapp}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onWhatsappChange={setWhatsapp}
                enabled={open && step === "client"}
                idPrefix="editCustomer"
                hint="Cliente deste horário. Busque outro ou edite os dados se precisar."
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
              primaryLabel="Salvar alterações"
              primaryType="submit"
              formId="edit-appointment-form"
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
