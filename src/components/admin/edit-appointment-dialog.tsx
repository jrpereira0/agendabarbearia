"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Scissors, User } from "lucide-react";
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
import type { AppointmentItem } from "@/components/admin/appointment-card";
import { SearchInput } from "@/components/admin/search-input";
import type { ServiceOption } from "@/components/admin/new-appointment-dialog";
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
import { updateAppointment } from "@/app/admin/(panel)/agenda/actions";

type EditAppointmentDialogProps = {
  appointment: AppointmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceOption[];
  professionalServiceIds: string[];
  slotStepMinutes: number;
  appointments: AppointmentItem[];
  professionalSchedules: { id: string; availableRanges: MinuteRange[] }[];
  showProfessional: boolean;
};

export function EditAppointmentDialog({
  appointment,
  open,
  onOpenChange,
  services,
  professionalServiceIds,
  slotStepMinutes,
  appointments,
  professionalSchedules,
  showProfessional,
}: EditAppointmentDialogProps) {
  const router = useRouter();
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

  const availableServices = useMemo(() => {
    const allowed = new Set(professionalServiceIds);
    return services
      .filter((s) => allowed.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [services, professionalServiceIds]);

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
      professionalSchedules.find((p) => p.id === appointment?.professionalId)
        ?.availableRanges ?? [],
    [professionalSchedules, appointment?.professionalId]
  );

  const selectedConflicts = useMemo(() => {
    if (!appointment || !startTime || totalMinutes === 0) return [];
    return findAppointmentConflicts(
      appointment.professionalId,
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
  }, [appointment, startTime, totalMinutes, appointments]);

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
    if (!open || !appointment || isEncaixe || serviceIds.length === 0) return;

    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);

    const params = new URLSearchParams({
      professionalId: appointment.professionalId,
      date: appointment.date,
      serviceIds: serviceIds.join(","),
      excludeAppointmentId: appointment.id,
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
  }, [open, appointment, isEncaixe, serviceIds]);

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

    setSaving(true);
    const result = await updateAppointment({
      appointmentId: appointment.id,
      startTime,
      serviceIds,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      whatsapp: whatsapp.replace(/\D/g, ""),
    });

    if (result.ok) {
      toast.success("Agendamento atualizado.");
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
            {showProfessional && ` · ${appointment.professionalNickname}`}
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
                  Só horários livres neste dia.
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
