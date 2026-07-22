"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import { BookingDatePicker } from "@/components/booking/booking-date-picker";
import { AppointmentCardsSkeleton } from "@/components/skeletons/appointment-cards-skeleton";
import { SlotGridSkeleton } from "@/components/skeletons/slot-grid-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatWhatsapp,
} from "@/lib/format";
import {
  formatPublicServicePriceLabel,
  formatPublicServicesTotalLabel,
} from "@/lib/public-service-prices";
import { sortServicesByPopularity } from "@/lib/booking-service-groups";
import { normalizeWhatsapp, whatsappLookupDelayMs } from "@/lib/whatsapp";
import type { PublicAppointmentItem } from "@/lib/manage-public-appointment";
import type { ShopCatalog } from "@/lib/get-shop-catalog";
import { cn } from "@/lib/utils";

const MAX_DAYS_AHEAD = 60;

type Step = "phone" | "list" | "edit";

type MyAppointmentsProps = {
  catalog: ShopCatalog;
  today: string;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MyAppointments({ catalog, today }: MyAppointmentsProps) {
  const maxDate = addDays(today, MAX_DAYS_AHEAD);

  const [step, setStep] = useState<Step>("phone");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappDigits, setWhatsappDigits] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const lastLookupDigitsRef = useRef("");

  const [appointments, setAppointments] = useState<PublicAppointmentItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<PublicAppointmentItem | null>(
    null
  );
  const [cancelBusy, setCancelBusy] = useState(false);

  const [editing, setEditing] = useState<PublicAppointmentItem | null>(null);
  const [editDate, setEditDate] = useState(today);
  const [editStartTime, setEditStartTime] = useState<string | null>(null);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const professionals = catalog.professionals.filter(
    (p) => p.serviceIds.length > 0
  );

  const editingProfessional = professionals.find(
    (p) => p.id === editing?.professionalId
  );

  const availableServices = useMemo(() => {
    const allowed = new Set(editingProfessional?.serviceIds ?? []);
    return sortServicesByPopularity(
      catalog.services.filter((s) => allowed.has(s.id))
    );
  }, [catalog.services, editingProfessional]);

  const selectedServices = catalog.services.filter((s) =>
    editServiceIds.includes(s.id)
  );
  const editTotalMinutes = selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const editTotalPriceLabel = formatPublicServicesTotalLabel(
    selectedServices,
    editDate
  );

  const fetchAppointments = useCallback(async (canonical: string) => {
    setLoadingList(true);
    try {
      const sessionRes = await fetch("/api/agenda/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ whatsapp: canonical }),
      });

      if (!sessionRes.ok) {
        const sessionBody = await sessionRes.json().catch(() => ({}));
        toast.error(
          sessionBody.error ?? "Não foi possível verificar seu WhatsApp."
        );
        return false;
      }

      const res = await fetch(
        `/api/v1/appointments?whatsapp=${encodeURIComponent(canonical)}`,
        { credentials: "include" }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível buscar seus horários.");
        return false;
      }
      setAppointments(body.appointments ?? []);
      setWhatsappDigits(canonical);
      setStep("list");
      return true;
    } catch {
      toast.error("Não foi possível buscar seus horários.");
      return false;
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (step !== "phone") return;

    const delay = whatsappLookupDelayMs(whatsapp);
    if (delay === null) {
      lastLookupDigitsRef.current = "";
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      const current = normalizeWhatsapp(whatsapp);
      if (cancelled || !current) return;
      if (current === lastLookupDigitsRef.current) return;

      lastLookupDigitsRef.current = current;
      setLookupLoading(true);
      fetchAppointments(current).finally(() => {
        if (!cancelled) setLookupLoading(false);
      });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [whatsapp, step, fetchAppointments]);

  useEffect(() => {
    if (step !== "edit" || !editing || editServiceIds.length === 0) return;

    let cancelled = false;
    // Defer pro próximo tick: evita "setState direto no efeito" e permite
    // cancelar (abaixo) antes de sequer começar a buscar.
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoadingSlots(true);
      setSlotsError(null);

      const params = new URLSearchParams({
        professionalId: editing.professionalId,
        date: editDate,
        serviceIds: editServiceIds.join(","),
        excludeAppointmentId: editing.id,
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
          } else if (editStartTime && !loaded.includes(editStartTime)) {
            setEditStartTime(null);
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
  }, [step, editing, editDate, editServiceIds, editStartTime]);

  function startEdit(appointment: PublicAppointmentItem) {
    setEditing(appointment);
    setEditDate(appointment.date);
    setEditStartTime(appointment.startTime);
    setEditServiceIds(appointment.serviceIds);
    setStep("edit");
  }

  function toggleEditService(id: string, checked: boolean) {
    setEditServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id)
    );
    setEditStartTime(null);
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    setCancelBusy(true);

    try {
      const res = await fetch(
        `/api/v1/appointments/${cancelTarget.id}?whatsapp=${encodeURIComponent(whatsappDigits)}`,
        { method: "DELETE", credentials: "include" }
      );
      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível cancelar.");
        setCancelBusy(false);
        return;
      }

      toast.success("Agendamento cancelado.");
      setCancelTarget(null);
      await fetchAppointments(whatsappDigits);
    } catch {
      toast.error("Não foi possível cancelar.");
    }

    setCancelBusy(false);
  }

  async function handleSaveEdit() {
    if (!editing || !editStartTime || editServiceIds.length === 0) {
      toast.error("Escolha data, horário e serviços.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/v1/appointments/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp: whatsappDigits,
          professionalId: editing.professionalId,
          date: editDate,
          startTime: editStartTime,
          serviceIds: editServiceIds,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível salvar.");
        setSaving(false);
        return;
      }

      toast.success("Horário atualizado.");
      setEditing(null);
      await fetchAppointments(whatsappDigits);
    } catch {
      toast.error("Não foi possível salvar.");
    }

    setSaving(false);
  }

  function goBack() {
    if (step === "edit") {
      setEditing(null);
      setStep("list");
      return;
    }
    if (step === "list") {
      lastLookupDigitsRef.current = whatsappDigits;
      setStep("phone");
      setAppointments([]);
    }
  }

  if (step === "phone") {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6">
        <h2 className="booking-display text-[1.75rem] font-medium leading-tight tracking-tight">
          Meus horários
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Informe o WhatsApp pra consultar, remarcar ou cancelar.
        </p>

        <div className="mt-8 rounded-2xl bg-[#151618] p-4 ring-1 ring-white/8">
          <Label
            htmlFor="myAppointmentsWhatsapp"
            className="text-[11px] font-medium text-muted-foreground"
          >
            WhatsApp
          </Label>
          <Input
            id="myAppointmentsWhatsapp"
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
            autoComplete="tel"
            className="mt-2 h-12 rounded-xl border-white/10 bg-[#0e0f11] text-base"
          />
          <div className="mt-2.5 text-xs text-muted-foreground" aria-live="polite">
            {lookupLoading || loadingList ? (
              <Skeleton className="inline-block h-3 w-48" aria-hidden />
            ) : (
              "Buscamos assim que o número estiver completo."
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === "edit" && editing && editingProfessional) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pt-5">
          <h2 className="booking-display text-[1.75rem] font-medium leading-tight tracking-tight">
            Remarcar
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {editingProfessional.nickname} · data, horário ou serviços.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-[#151618] px-3 py-2.5 ring-1 ring-white/8">
            <ProfessionalAvatar
              photoUrl={editingProfessional.photoUrl}
              photoPosition={editingProfessional.photoPosition}
              name={editingProfessional.nickname}
              size="md"
            />
            <div>
              <p className="font-medium">{editingProfessional.nickname}</p>
              <p className="text-xs text-muted-foreground">
                {formatWhatsapp(whatsappDigits)}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Serviços
            </p>
            <ul className="flex flex-col gap-2">
              {availableServices.map((svc) => {
                const checked = editServiceIds.includes(svc.id);
                return (
                  <li key={svc.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-all",
                        checked
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/[0.03]"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) =>
                          toggleEditService(svc.id, c === true)
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{svc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(svc.durationMinutes)} ·{" "}
                          {formatPublicServicePriceLabel(svc, editDate)}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <BookingDatePicker
            selectedDate={editDate}
            today={today}
            maxDate={maxDate}
            onSelectDate={(d) => {
              setEditDate(d);
              setEditStartTime(null);
            }}
          />

          {editServiceIds.length > 0 && (
            <>
              {loadingSlots ? (
                <SlotGridSkeleton />
              ) : slotsError ? (
                <p className="rounded-2xl bg-white/[0.04] px-4 py-5 text-center text-sm text-muted-foreground">
                  {slotsError}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      variant={editStartTime === slot ? "default" : "outline"}
                      size="sm"
                      className="h-11 rounded-xl tabular-nums"
                      onClick={() => setEditStartTime(slot)}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              )}

              {editStartTime && (
                <p className="text-center text-xs text-muted-foreground">
                  Total: {formatDuration(editTotalMinutes)} ·{" "}
                  {editTotalPriceLabel}
                </p>
              )}
            </>
          )}
          </div>
        </div>

        <div className="relative shrink-0 px-5 pb-3 pt-2">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#0e0f11] to-transparent"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={goBack}
              className="h-12 shrink-0 rounded-2xl px-3 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-12 min-w-0 flex-1 rounded-2xl font-semibold"
              disabled={saving || !editStartTime || editServiceIds.length === 0}
              onClick={handleSaveEdit}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-5 pb-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="booking-display text-[1.75rem] font-medium leading-tight tracking-tight">
              Meus horários
            </h2>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5 shrink-0" />
              {formatWhatsapp(whatsappDigits)}
            </p>
          </div>
          <button
            type="button"
            onClick={goBack}
            className="mt-1 shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors active:bg-white/10"
          >
            Trocar
          </button>
        </div>

        <div className="mt-6">
          {loadingList ? (
            <AppointmentCardsSkeleton />
          ) : appointments.length === 0 ? (
            <div className="rounded-2xl bg-[#151618] px-5 py-12 text-center ring-1 ring-white/8">
              <CalendarDays className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} />
              <p className="mt-3 font-medium">Nenhum horário marcado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Não há agendamentos futuros com esse WhatsApp.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {appointments.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl bg-[#151618] p-4 ring-1 ring-white/8"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[1.75rem] font-semibold tabular-nums leading-none tracking-tight">
                        {a.startTime}
                      </p>
                      <p className="mt-1.5 text-sm capitalize text-muted-foreground">
                        {formatDateBR(a.date)}
                      </p>
                    </div>
                    <ProfessionalAvatar
                      photoUrl={a.professionalPhotoUrl}
                      photoPosition={a.professionalPhotoPosition}
                      name={a.professionalName}
                      size="md"
                    />
                  </div>

                  <div className="mt-4 border-t border-white/8 pt-3">
                    <p className="text-sm font-medium">{a.professionalName}</p>
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      {a.serviceNames.join(", ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(a.totalMinutes)} ·{" "}
                      {formatPriceBRL(a.totalPriceCents)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-11 rounded-xl bg-white/[0.06] hover:bg-white/10"
                      onClick={() => startEdit(a)}
                    >
                      <Pencil className="size-3.5" />
                      Remarcar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-11 rounded-xl bg-white/[0.06] text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCancelTarget(a)}
                    >
                      <Trash2 className="size-3.5" />
                      Cancelar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent className="booking-dialog gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-2 border-b px-6 py-6 pr-12 text-left">
            <DialogTitle className="text-lg font-semibold">
              Cancelar agendamento?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed">
              O horário volta a ficar livre na agenda da barbearia.
            </DialogDescription>
          </DialogHeader>

          {cancelTarget && (
            <div className="px-6 py-5">
              <div className="rounded-xl border p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Data
                    </p>
                    <p className="mt-1.5 text-sm font-semibold capitalize">
                      {formatDateBR(cancelTarget.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Horário
                    </p>
                    <p className="mt-1.5 text-xl font-semibold tabular-nums leading-none">
                      {cancelTarget.startTime}
                    </p>
                  </div>
                </div>

                <div className="my-5 h-px bg-border" />

                <div className="flex items-center gap-3.5">
                  <ProfessionalAvatar
                    photoUrl={cancelTarget.professionalPhotoUrl}
                    photoPosition={cancelTarget.professionalPhotoPosition}
                    name={cancelTarget.professionalName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Barbeiro</p>
                    <p className="mt-0.5 truncate font-semibold">
                      {cancelTarget.professionalName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {cancelTarget.serviceNames.join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="-mx-0 -mb-0 flex-col-reverse gap-3 border-t bg-muted/20 px-6 py-5 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setCancelTarget(null)}
              disabled={cancelBusy}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleCancelConfirm}
              disabled={cancelBusy}
            >
              {cancelBusy ? "Cancelando..." : "Sim, cancelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
