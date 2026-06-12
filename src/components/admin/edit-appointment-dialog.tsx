"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Scissors, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import { SearchInput } from "@/components/admin/search-input";
import type { ServiceOption, ProfessionalOption } from "@/components/admin/new-appointment-dialog";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatTime,
  formatWhatsapp,
} from "@/lib/format";
import type { MinuteRange } from "@/lib/availability";
import {
  encaixeTimeSlots,
  findAppointmentConflicts,
  isOutsideProfessionalSchedule,
} from "@/lib/encaixe";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
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
    const base = isEncaixe ? encaixeSlots : availableSlots;
    if (startTime && !base.includes(startTime)) {
      return [...base, startTime].sort();
    }
    return base;
  }, [isEncaixe, encaixeSlots, availableSlots, startTime]);

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
      appointments.map((a) => ({
        id: a.id,
        customerFirstName: a.customerFirstName,
        customerLastName: a.customerLastName,
        startTime: a.startTime,
        endTime: a.endTime,
        professionalId: a.professionalId,
        status: a.status,
      })),
      appointment.id
    );
  }, [appointment, professionalId, startTime, totalMinutes, appointments]);

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
    if (!open || !appointment || isEncaixe || serviceIds.length === 0 || !professionalId) {
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
  }, [open, appointment, isEncaixe, serviceIds, professionalId]);

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
      <DialogContent className="flex max-h-[min(90dvh,720px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
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
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="size-4" />
                Barbeiro
              </div>
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
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="size-4" />
                Cliente
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editFirstName">Nome</Label>
                  <Input
                    id="editFirstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="editLastName">Sobrenome</Label>
                  <Input
                    id="editLastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="editWhatsapp">WhatsApp</Label>
                <Input
                  id="editWhatsapp"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Scissors className="size-4" />
                Serviços
              </div>
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
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
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
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="size-4" />
                Horário
              </div>

              {isEncaixe ? (
                <p className="text-sm text-muted-foreground">
                  Encaixe: qualquer horário do dia.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Horários livres no expediente. Na edição, o horário atual
                  sempre pode ser mantido para corrigir barbeiro ou dados.
                </p>
              )}

              {!isEncaixe && loadingSlots ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Carregando horários...
                </p>
              ) : !isEncaixe && slotsError ? (
                <p className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
                  {slotsError}
                </p>
              ) : (
                <>
                  {availableSlots.length === 0 && startTime && (
                    <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      Só o horário atual está disponível — o painel permite
                      corrigir agendamentos mesmo fora do horário de reserva
                      online.
                    </p>
                  )}
                  <div className="grid max-h-48 grid-cols-3 gap-2 sm:grid-cols-4">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot}
                        type="button"
                        variant={startTime === slot ? "default" : "outline"}
                        className="h-9 tabular-nums"
                        onClick={() => setStartTime(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                </>
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
            </section>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-muted/30 px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
