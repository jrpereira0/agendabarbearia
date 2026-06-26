"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Scissors, User, UserRound, Check } from "lucide-react";
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
import type { AppointmentItem } from "@/components/admin/appointment-item";
import { SearchInput } from "@/components/admin/search-input";
import type { ServiceOption, ProfessionalOption } from "@/components/admin/new-appointment-dialog";
import { AdminCustomerFields } from "@/components/admin/admin-customer-fields";
import { DialogSection } from "@/components/admin/dialog-section";
import { TimeSlotGrid } from "@/components/admin/time-slot-grid";
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
import { cn } from "@/lib/utils";
import { adminWideDialogClassName } from "@/lib/admin-dialog";
import { updateAppointment, getEditAvailabilitySlots } from "@/app/admin/(panel)/agenda/actions";

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

  const availableServices = useMemo(() => {
    const allowed = new Set(selectedProfessional?.serviceIds ?? []);
    return services
      .filter((s) => allowed.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [services, selectedProfessional]);

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

  const encaixeSlots = useMemo(
    () => encaixeTimeSlots(slotStepMinutes),
    [slotStepMinutes]
  );

  const timeSlots = useMemo(() => {
    const base =
      isEncaixe || ownerFreeMode ? encaixeSlots : availableSlots;
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

  useEffect(() => {
    if (!open || !appointment) return;

    setSaving(false);
    setProfessionalId(appointment.professionalId);
    setFirstName(appointment.customerFirstName);
    setLastName(appointment.customerLastName);
    setWhatsapp(formatWhatsapp(appointment.customerWhatsapp));
    setServiceIds(appointment.services.map((s) => s.id));
    setStartTime(appointment.startTime);
    setServiceSearch("");
    setAvailableSlots([]);
    setSlotsError(null);
  }, [open, appointment]);

  useEffect(() => {
    if (!open || !professionalId) return;
    const allowed = new Set(
      professionals.find((p) => p.id === professionalId)?.serviceIds ?? []
    );
    setServiceIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [open, professionalId, professionals]);

  useEffect(() => {
    if (
      !open ||
      !appointment ||
      isEncaixe ||
      ownerFreeMode ||
      serviceIds.length === 0 ||
      !professionalId
    ) {
      return;
    }

    let cancelled = false;
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
          setSlotsError("Nenhum horário livre neste dia para esses serviços.");
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
  }, [open, appointment, isEncaixe, ownerFreeMode, serviceIds, professionalId]);

  function toggleService(id: string, checked: boolean) {
    setServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id)
    );
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={adminWideDialogClassName()}>
        <DialogHeader className="shrink-0 gap-1 border-b px-4 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle>Editar agendamento</DialogTitle>
          <DialogDescription>
            {formatDateBR(appointment.date)}
            {isEncaixe && " · Encaixe"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
              <div className="space-y-4">
                <DialogSection icon={User} title="Barbeiro">
              {isOwner ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {professionals.map((pro) => {
                    const selected = professionalId === pro.id;
                    return (
                      <button
                        key={pro.id}
                        type="button"
                        onClick={() => setProfessionalId(pro.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                          selected && "border-primary bg-muted/50"
                        )}
                      >
                        <ProfessionalAvatar
                          photoUrl={pro.photoUrl}
                          name={pro.nickname}
                          size="md"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {pro.nickname}
                        </span>
                        {selected && (
                          <Check className="size-4 shrink-0 text-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : selectedProfessional ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                  <ProfessionalAvatar
                    photoUrl={selectedProfessional.photoUrl}
                    name={selectedProfessional.nickname}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {selectedProfessional.nickname}
                    </p>
                    <p className="text-sm text-muted-foreground">Barbeiro</p>
                  </div>
                </div>
              ) : null}
                </DialogSection>

                <DialogSection
                  icon={UserRound}
                  title="Cliente"
                  description="Nome e WhatsApp para contato."
                >
              <AdminCustomerFields
                firstName={firstName}
                lastName={lastName}
                whatsapp={whatsapp}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onWhatsappChange={setWhatsapp}
                enabled={open}
                idPrefix="editCustomer"
              />
                </DialogSection>
              </div>

              <div className="space-y-4">
                <DialogSection
                  icon={Scissors}
                  title="Serviços"
                  description="Escolha o que será feito no atendimento."
                >
                  <div className="space-y-3">
              <SearchInput
                value={serviceSearch}
                onChange={setServiceSearch}
                placeholder="Buscar serviço..."
              />
              {availableServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esse profissional não tem serviços vinculados.
                </p>
              ) : filteredServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço encontrado.
                </p>
              ) : (
                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto sm:max-h-64">
                  {filteredServices.map((svc) => {
                    const checked = serviceIds.includes(svc.id);
                    return (
                      <label
                        key={svc.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
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
                          <p className="text-sm font-medium leading-snug">
                            {svc.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">
                  Total: {formatDuration(totalMinutes)} ·{" "}
                  {formatPriceBRL(totalPrice)}
                </p>
              )}
                  </div>
                </DialogSection>

                <DialogSection
                  icon={Clock}
                  title="Horário"
                  description={
                    isEncaixe
                      ? "Encaixe: qualquer horário do dia."
                      : isOwner
                        ? "Qualquer horário do dia, exceto se já tiver outro agendamento."
                        : "Horários livres no expediente."
                  }
                >

              {!isEncaixe && !loadingSlots && !slotsError && !isOwner && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Na edição, o horário atual sempre pode ser mantido para
                  corrigir barbeiro ou dados.
                </p>
              )}

              {!isEncaixe && isOwner && !loadingSlots && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Como dono, você pode escolher qualquer horário — inclusive
                  fora do expediente ou em datas passadas. Se o horário já
                  estiver ocupado, use encaixe.
                </p>
              )}

              {!isEncaixe && !ownerFreeMode && loadingSlots ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Carregando horários...
                </p>
              ) : !isEncaixe && !ownerFreeMode && slotsError ? (
                <p className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
                  {slotsError}
                </p>
              ) : (
                <>
                  {!isEncaixe &&
                    !ownerFreeMode &&
                    availableSlots.length === 0 &&
                    startTime && (
                    <p className="mb-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      Só o horário atual está disponível — o painel permite
                      corrigir agendamentos mesmo fora do horário de reserva
                      online.
                    </p>
                  )}
                  <TimeSlotGrid
                    slots={timeSlots}
                    value={startTime}
                    onChange={setStartTime}
                    buttonSize="sm"
                    buttonClassName="h-9"
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

              {ownerFreeMode && startTime && selectedOutsideSchedule && (
                <p className="mt-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Fora do horário de funcionamento deste barbeiro.
                </p>
              )}

              {isEncaixe && selectedOutsideSchedule && startTime && (
                <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Fora do horário de funcionamento deste barbeiro.
                </p>
              )}

              {isEncaixe && selectedConflicts.length > 0 && startTime && (
                <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Sobrepõe {selectedConflicts.length} agendamento
                    {selectedConflicts.length > 1 ? "s" : ""}:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {selectedConflicts.map((c) => (
                      <li key={`${c.startTime}-${c.customerFirstName}`}>
                        {c.customerFirstName} {c.customerLastName} ·{" "}
                        {formatTime(c.startTime)} – {formatTime(c.endTime)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
                </DialogSection>
              </div>
            </div>
          </div>

          <div className="min-w-0 shrink-0 overflow-hidden rounded-b-xl border-t bg-muted/30 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full sm:h-9 sm:w-auto"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-10 w-full sm:h-9 sm:w-auto"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
