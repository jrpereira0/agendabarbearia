"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import { SearchInput } from "@/components/admin/search-input";
import { BookingDatePicker } from "@/components/booking/booking-date-picker";
import { ServiceThumbnail } from "@/components/booking/service-thumbnail";
import {
  formatDateBR,
  formatDuration,
  formatPriceBRL,
  formatWhatsapp,
} from "@/lib/format";
import { matchesSearch } from "@/lib/text";
import {
  formatPublicServicePriceLabel,
  formatPublicServicesTotalLabel,
  sumPublicServicesPriceCents,
} from "@/lib/public-service-prices";
import { groupServicesForBooking } from "@/lib/booking-service-groups";
import { normalizeWhatsapp, whatsappLookupDelayMs } from "@/lib/whatsapp";
import { SlotGridSkeleton } from "@/components/skeletons/slot-grid-skeleton";
import { cn } from "@/lib/utils";
import type { PublicService, ShopCatalog } from "@/lib/get-shop-catalog";

type Step = "professional" | "services" | "datetime" | "confirm";

const NO_PREFERENCE_ID = "__any__";
const MAX_DAYS_AHEAD = 60;
const stepOrder: Step[] = ["professional", "services", "datetime", "confirm"];

const stepMeta: Record<Step, { title: string; hint: string }> = {
  professional: {
    title: "Quem te atende?",
    hint: "Escolha o barbeiro ou deixe qualquer um.",
  },
  services: {
    title: "Qual serviço?",
    hint: "Toque pra marcar. Pode escolher mais de um.",
  },
  datetime: {
    title: "Quando você vem?",
    hint: "Dia e horário livre.",
  },
  confirm: {
    title: "Seus dados",
    hint: "WhatsApp e nome pra confirmar.",
  },
};

type BookingFlowProps = {
  catalog: ShopCatalog;
  today: string;
};

type Confirmation = {
  professionalId: string;
  professionalName: string;
  professionalPhotoUrl: string | null;
  professionalPhotoPosition: string;
  date: string;
  startTime: string;
  serviceNames: string[];
  totalPriceCents: number;
  totalMinutes: number;
  customerName: string;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, index) => {
        const active = index + 1 <= current;
        return (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-all",
              active ? "w-5 bg-primary" : "w-1.5 bg-white/15"
            )}
          />
        );
      })}
    </div>
  );
}

function ServicePickerRow({
  service,
  checked,
  onToggle,
}: {
  service: PublicService;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3.5 transition-all",
        checked
          ? "border-primary bg-primary/10"
          : "border-white/10 bg-white/[0.03] active:bg-white/[0.06]"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onToggle(value === true)}
        className="shrink-0"
      />
      <ServiceThumbnail
        photoUrl={service.photoUrl}
        photoPosition={service.photoPosition}
        name={service.name}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{service.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDuration(service.durationMinutes)} ·{" "}
          {formatPublicServicePriceLabel(service)}
        </p>
      </div>
    </label>
  );
}

const SLOT_PERIODS = [
  { label: "Manhã", from: 0, to: 12 },
  { label: "Tarde", from: 12, to: 18 },
  { label: "Noite", from: 18, to: 24 },
] as const;

function QuickDateChips({
  today,
  maxDate,
  selectedDate,
  onSelectDate,
}: {
  today: string;
  maxDate: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const chips = [
    { label: "Hoje", date: today },
    { label: "Amanhã", date: addDays(today, 1) },
    {
      label: new Date(`${addDays(today, 2)}T12:00:00`)
        .toLocaleDateString("pt-BR", { weekday: "short" })
        .replace(".", ""),
      date: addDays(today, 2),
    },
  ].filter((chip) => chip.date <= maxDate);

  return (
    <div className="flex gap-2">
      {chips.map((chip) => {
        const active = chip.date === selectedDate;
        return (
          <button
            key={chip.date}
            type="button"
            onClick={() => onSelectDate(chip.date)}
            className={cn(
              "h-12 flex-1 rounded-2xl border text-sm font-semibold capitalize transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/10 bg-white/[0.03]"
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function SlotGroups({
  slots,
  selected,
  onSelect,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (slot: string) => void;
}) {
  const groups = SLOT_PERIODS.map((period) => ({
    label: period.label,
    slots: slots.filter((s) => {
      const hour = parseInt(s.split(":")[0], 10);
      return hour >= period.from && hour < period.to;
    }),
  })).filter((g) => g.slots.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {group.label}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(slot)}
                className={cn(
                  "h-12 rounded-2xl border text-base font-semibold tabular-nums transition-colors",
                  selected === slot
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/10 bg-white/[0.03]"
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BookingFlow({ catalog, today }: BookingFlowProps) {
  const maxDate = addDays(today, MAX_DAYS_AHEAD);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const skipInitialScrollRef = useRef(true);

  const [step, setStep] = useState<Step>("professional");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [customerFound, setCustomerFound] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lastLookupDigitsRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (skipInitialScrollRef.current) {
      skipInitialScrollRef.current = false;
      return;
    }

    bodyRef.current?.scrollTo({ top: 0 });
    const card = rootRef.current;
    if (!card || card.offsetParent === null) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      });
    });
  }, [step, confirmation]);

  const { services } = catalog;
  const professionals = catalog.professionals.filter(
    (p) => p.serviceIds.length > 0
  );

  const anyPreference = professionalId === NO_PREFERENCE_ID;
  const selectedProfessional = anyPreference
    ? null
    : (professionals.find((p) => p.id === professionalId) ?? null);
  const currentStep = stepOrder.indexOf(step) + 1;
  const meta = stepMeta[step];

  const availableServices = useMemo(() => {
    if (!professionalId) return [];
    if (anyPreference) {
      const allowed = new Set(professionals.flatMap((p) => p.serviceIds));
      return services.filter((s) => allowed.has(s.id));
    }
    const allowed = new Set(selectedProfessional?.serviceIds ?? []);
    return services.filter((s) => allowed.has(s.id));
  }, [
    anyPreference,
    professionalId,
    professionals,
    selectedProfessional,
    services,
  ]);

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

  const selectedServices = services.filter((s) => serviceIds.includes(s.id));
  const priceDate =
    step === "datetime" || step === "confirm" ? date : undefined;
  const totalMinutes = selectedServices.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const totalPrice = sumPublicServicesPriceCents(selectedServices, priceDate);
  const totalPriceLabel = formatPublicServicesTotalLabel(
    selectedServices,
    priceDate
  );

  useEffect(() => {
    if (step !== "datetime" || !professionalId || serviceIds.length === 0) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoadingSlots(true);
      setSlotsError(null);
      setStartTime(null);

      const params = new URLSearchParams({
        date,
        serviceIds: serviceIds.join(","),
      });
      if (anyPreference) {
        params.set("anyProfessional", "1");
      } else {
        params.set("professionalId", professionalId);
      }

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
            setSlotsError(
              body.message ??
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
  }, [step, professionalId, anyPreference, serviceIds, date]);

  useEffect(() => {
    if (step !== "confirm") return;

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

      fetch(`/api/v1/customers/lookup?whatsapp=${encodeURIComponent(current)}`)
        .then(async (res) => {
          const body = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            lastLookupDigitsRef.current = "";
            toast.error(body.error ?? "Não foi possível buscar seus dados.");
            return;
          }
          if (body.found) {
            setFirstName(body.firstName);
            setLastName(body.lastName);
            setCustomerFound(true);
          } else {
            setCustomerFound(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            lastLookupDigitsRef.current = "";
            toast.error("Não foi possível buscar seus dados. Tente de novo.");
          }
        })
        .finally(() => {
          if (!cancelled) setLookupLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [whatsapp, step]);

  function selectProfessional(id: string) {
    setProfessionalId(id);
    setServiceIds([]);
    setStartTime(null);
  }

  function toggleService(id: string, checked: boolean) {
    setServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id)
    );
    setStartTime(null);
  }

  function resetCustomer() {
    setCustomerFound(false);
    setFirstName("");
    setLastName("");
    setWhatsapp("");
    lastLookupDigitsRef.current = "";
  }

  function handleNotMe() {
    lastLookupDigitsRef.current = "";
    setWhatsapp("");
    setFirstName("");
    setLastName("");
    setCustomerFound(false);
  }

  function goBack() {
    if (step === "confirm") {
      resetCustomer();
      setStep("datetime");
      return;
    }
    if (step === "datetime") setStep("services");
    else if (step === "services") setStep("professional");
  }

  function goNext() {
    if (step === "professional") {
      if (!professionalId) {
        toast.error("Escolha quem vai te atender.");
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
      setStep("datetime");
      return;
    }
    if (step === "datetime") {
      if (!startTime) {
        toast.error("Escolha um horário.");
        return;
      }
      resetCustomer();
      setStep("confirm");
    }
  }

  async function handleConfirm() {
    const digits = normalizeWhatsapp(whatsapp);
    if (!firstName.trim() || !lastName.trim() || !digits || !startTime) {
      toast.error("Preencha nome e WhatsApp.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(anyPreference ? { anyProfessional: true } : { professionalId }),
          date,
          startTime,
          serviceIds,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          whatsapp: digits,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível confirmar.");
        setSaving(false);
        return;
      }

      const assignedId =
        (typeof body.professionalId === "string" && body.professionalId) ||
        professionalId;
      const assignedPro = catalog.professionals.find((p) => p.id === assignedId);
      const assignedName =
        (typeof body.professionalNickname === "string" &&
          body.professionalNickname) ||
        assignedPro?.nickname ||
        selectedProfessional?.nickname ||
        "Barbeiro";

      setConfirmation({
        professionalId: assignedId,
        professionalName: assignedName,
        professionalPhotoUrl: assignedPro?.photoUrl ?? null,
        professionalPhotoPosition: assignedPro?.photoPosition ?? "50% 50%",
        date,
        startTime,
        serviceNames: selectedServices.map((s) => s.name),
        totalPriceCents: totalPrice,
        totalMinutes,
        customerName: `${firstName.trim()} ${lastName.trim()}`,
      });
      setSaving(false);
    } catch {
      toast.error("Não foi possível confirmar. Tente de novo.");
      setSaving(false);
    }
  }

  const primaryLabel =
    step === "professional"
      ? "Escolher serviço"
      : step === "services"
        ? "Escolher horário"
        : step === "datetime"
          ? "Informar meus dados"
          : saving
            ? "Confirmando..."
            : "Confirmar horário";

  const primaryDisabled =
    (step === "professional" && !professionalId) ||
    (step === "services" && serviceIds.length === 0) ||
    (step === "datetime" && !startTime) ||
    (step === "confirm" &&
      (saving ||
        lookupLoading ||
        !normalizeWhatsapp(whatsapp) ||
        !firstName.trim() ||
        !lastName.trim()));

  if (confirmation) {
    const confirmedProfessional = catalog.professionals.find(
      (p) => p.id === confirmation.professionalId
    );
    const professionalPhotoUrl =
      confirmedProfessional?.photoUrl?.trim() ||
      confirmation.professionalPhotoUrl?.trim() ||
      null;
    const professionalPhotoPosition =
      confirmedProfessional?.photoPosition ||
      confirmation.professionalPhotoPosition;

    return (
      <div
        ref={rootRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="bg-primary px-5 py-10 text-center text-primary-foreground">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary-foreground/10">
            <CheckCircle2 className="size-7" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            Horário agendado
          </h2>
          <p className="mt-1.5 text-sm text-primary-foreground/70">
            {confirmation.customerName}, te esperamos!
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Data
                </p>
                <p className="mt-1 font-semibold capitalize">
                  {formatDateBR(confirmation.date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Horário
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {confirmation.startTime}
                </p>
              </div>
            </div>
            <div className="my-4 h-px bg-white/10" />
            <div className="flex items-center gap-3">
              <ProfessionalAvatar
                photoUrl={professionalPhotoUrl}
                photoPosition={professionalPhotoPosition}
                name={confirmation.professionalName}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Barbeiro</p>
                <p className="truncate font-semibold">
                  {confirmation.professionalName}
                </p>
              </div>
            </div>
            <div className="my-4 h-px bg-white/10" />
            <p className="text-xs text-muted-foreground">Serviços</p>
            <p className="mt-1 font-medium">
              {confirmation.serviceNames.join(", ")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDuration(confirmation.totalMinutes)} ·{" "}
              {formatPriceBRL(confirmation.totalPriceCents)}
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Precisa mudar? Use Horários no menu de baixo.
          </p>
        </div>
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
        A barbearia ainda não tem barbeiros disponíveis para agendamento online.
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <StepDots current={currentStep} total={stepOrder.length} />
          <span className="text-xs tabular-nums text-muted-foreground">
            {currentStep}/{stepOrder.length}
          </span>
        </div>
        <h2 className="booking-display mt-3 text-[1.65rem] font-medium tracking-tight">
          {meta.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{meta.hint}</p>

        {(step === "services" || step === "datetime" || step === "confirm") &&
          (anyPreference || selectedProfessional) && (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 py-2.5">
              {anyPreference ? (
                <div className="flex size-8 items-center justify-center rounded-full bg-white/10">
                  <Users className="size-3.5 text-muted-foreground" />
                </div>
              ) : (
                <ProfessionalAvatar
                  photoUrl={selectedProfessional!.photoUrl}
                  photoPosition={selectedProfessional!.photoPosition}
                  name={selectedProfessional!.nickname}
                  size="sm"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {anyPreference
                    ? "Qualquer barbeiro"
                    : selectedProfessional!.nickname}
                  {selectedServices.length > 0
                    ? ` · ${selectedServices.map((s) => s.name).join(", ")}`
                    : ""}
                </p>
                {startTime && step === "confirm" ? (
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(date)} às {startTime} · {totalPriceLabel}
                  </p>
                ) : selectedServices.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(totalMinutes)} · {totalPriceLabel}
                  </p>
                ) : null}
              </div>
            </div>
          )}
      </div>

      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3"
      >
        {step === "professional" && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => selectProfessional(NO_PREFERENCE_ID)}
              className={cn(
                "flex min-h-[7.5rem] flex-col items-center justify-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-colors",
                anyPreference
                  ? "border-primary bg-primary/10"
                  : "border-white/10 bg-white/[0.03]"
              )}
            >
              <div
                className={cn(
                  "flex size-14 items-center justify-center rounded-full",
                  anyPreference
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10"
                )}
              >
                <Users className="size-6" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold">Qualquer</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                Encaixamos no horário
              </span>
            </button>

            {professionals.map((pro) => {
              const selected = professionalId === pro.id;
              return (
                <button
                  key={pro.id}
                  type="button"
                  onClick={() => selectProfessional(pro.id)}
                  className={cn(
                    "flex min-h-[7.5rem] flex-col items-center justify-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-colors",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-white/10 bg-white/[0.03]"
                  )}
                >
                  <div className="relative">
                    <ProfessionalAvatar
                      photoUrl={pro.photoUrl}
                      photoPosition={pro.photoPosition}
                      name={pro.nickname}
                      size="lg"
                    />
                    {selected && (
                      <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-sm font-semibold">
                    {pro.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === "services" && (
          <div className="flex flex-col gap-3">
            {availableServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esse barbeiro ainda não tem serviços disponíveis.
              </p>
            ) : (
              <>
                {availableServices.length > 6 && (
                  <SearchInput
                    value={serviceSearch}
                    onChange={setServiceSearch}
                    placeholder="Buscar serviço..."
                  />
                )}
                {serviceGroups.popular.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Mais pedidos
                    </p>
                    {serviceGroups.popular.map((svc) => (
                      <ServicePickerRow
                        key={svc.id}
                        service={svc}
                        checked={serviceIds.includes(svc.id)}
                        onToggle={(checked) => toggleService(svc.id, checked)}
                      />
                    ))}
                  </div>
                )}
                {serviceGroups.others.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {serviceGroups.popular.length > 0 && (
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Outros
                      </p>
                    )}
                    {serviceGroups.others.map((svc) => (
                      <ServicePickerRow
                        key={svc.id}
                        service={svc}
                        checked={serviceIds.includes(svc.id)}
                        onToggle={(checked) => toggleService(svc.id, checked)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === "datetime" && (
          <div className="flex flex-col gap-4">
            <QuickDateChips
              today={today}
              maxDate={maxDate}
              selectedDate={date}
              onSelectDate={(next) => {
                setDate(next);
                setStartTime(null);
              }}
            />

            <details className="group rounded-2xl border border-white/10">
              <summary className="cursor-pointer list-none px-3.5 py-3 text-sm text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Outra data no calendário</span>
                <span className="hidden group-open:inline">Fechar calendário</span>
              </summary>
              <div className="border-t border-white/10 px-3 pb-3 pt-2">
                <BookingDatePicker
                  selectedDate={date}
                  today={today}
                  maxDate={maxDate}
                  onSelectDate={(next) => {
                    setDate(next);
                    setStartTime(null);
                  }}
                />
              </div>
            </details>

            {loadingSlots ? (
              <SlotGridSkeleton />
            ) : slotsError ? (
              <p className="rounded-2xl bg-white/[0.04] px-4 py-6 text-center text-sm text-muted-foreground">
                {slotsError}
              </p>
            ) : (
              <SlotGroups
                slots={availableSlots}
                selected={startTime}
                onSelect={setStartTime}
              />
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bookingWhatsapp" className="text-xs">
                WhatsApp
              </Label>
              <Input
                id="bookingWhatsapp"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(formatWhatsapp(e.target.value));
                  setCustomerFound(false);
                }}
                autoComplete="tel"
                className="h-12 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                {lookupLoading
                  ? "Buscando..."
                  : customerFound
                    ? "Encontramos você."
                    : "Usamos pra te reconhecer e avisar."}
              </p>
            </div>

            {customerFound ? (
              <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-[#151618]">
                    <User className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {firstName} {lastName}
                    </p>
                    <button
                      type="button"
                      onClick={handleNotMe}
                      className="mt-0.5 text-xs font-medium text-primary"
                    >
                      Não sou eu
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bookingFirstName" className="text-xs">
                    Nome
                  </Label>
                  <Input
                    id="bookingFirstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bookingLastName" className="text-xs">
                    Sobrenome
                  </Label>
                  <Input
                    id="bookingLastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-white/10 bg-[#0e0f11] px-4 py-3">
        {step !== "professional" && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={goBack}
            className="h-12 shrink-0 rounded-xl"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          disabled={primaryDisabled}
          onClick={() => {
            if (step === "confirm") void handleConfirm();
            else goNext();
          }}
          className="ml-auto h-12 min-w-0 flex-1 rounded-xl text-base sm:flex-none sm:px-8"
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
