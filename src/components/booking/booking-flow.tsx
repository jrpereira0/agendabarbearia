"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import type {
  PublicProfessional,
  PublicService,
  ShopCatalog,
} from "@/lib/get-shop-catalog";

type Step = "professional" | "services" | "datetime" | "confirm";
type CustomerSubstep = "whatsapp" | "identity";

const MAX_DAYS_AHEAD = 60;
const stepOrder: Step[] = ["professional", "services", "datetime", "confirm"];

const stepMeta: Record<
  Step,
  { title: string; description: string }
> = {
  professional: {
    title: "Escolha o barbeiro",
    description: "Quem vai te atender?",
  },
  services: {
    title: "Escolha os serviços",
    description: "Pode marcar mais de um. O valor pode mudar conforme o dia.",
  },
  datetime: {
    title: "Escolha data e horário",
    description: "Só aparecem horários livres.",
  },
  confirm: {
    title: "Seus dados",
    description: "Pra confirmar o agendamento.",
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
        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-all",
        checked
          ? "border-foreground bg-muted/40"
          : "border-transparent bg-muted/30 hover:bg-muted/50"
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
        {service.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {service.description}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDuration(service.durationMinutes)} ·{" "}
          {formatPublicServicePriceLabel(service)}
        </p>
      </div>
    </label>
  );
}

function ServicePickerList({
  services,
  serviceIds,
  onToggle,
}: {
  services: PublicService[];
  serviceIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {services.map((svc) => (
        <li key={svc.id}>
          <ServicePickerRow
            service={svc}
            checked={serviceIds.includes(svc.id)}
            onToggle={(checked) => onToggle(svc.id, checked)}
          />
        </li>
      ))}
    </ul>
  );
}

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1">
      {stepOrder.map((_, index) => {
        const done = index + 1 < current;
        const active = index + 1 === current;
        return (
          <div
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              done || active ? "bg-foreground" : "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}

function SelectionSummary({
  professional,
  services,
  date,
  startTime,
  totalMinutes,
  totalPriceLabel,
}: {
  professional: PublicProfessional;
  services: PublicService[];
  date?: string;
  startTime?: string | null;
  totalMinutes: number;
  totalPriceLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
      <ProfessionalAvatar
        photoUrl={professional.photoUrl}
        photoPosition={professional.photoPosition}
        name={professional.nickname}
        size="sm"
      />
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">{professional.nickname}</p>
        <p className="truncate">
          {services.map((s) => s.name).join(", ")}
          {date && startTime && (
            <>
              {" · "}
              {formatDateBR(date)} às {startTime}
            </>
          )}
        </p>
        <p>
          {formatDuration(totalMinutes)} · {totalPriceLabel}
        </p>
      </div>
    </div>
  );
}

const SLOT_PERIODS = [
  { label: "Manhã", from: 0, to: 12 },
  { label: "Tarde", from: 12, to: 18 },
  { label: "Noite", from: 18, to: 24 },
] as const;

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
          <div className="grid grid-cols-4 gap-2">
            {group.slots.map((slot) => (
              <Button
                key={slot}
                type="button"
                variant={selected === slot ? "default" : "outline"}
                size="sm"
                className="h-9 tabular-nums"
                onClick={() => onSelect(slot)}
              >
                {slot}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BookingFlow({ catalog, today }: BookingFlowProps) {
  const maxDate = addDays(today, MAX_DAYS_AHEAD);

  const [step, setStep] = useState<Step>("professional");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [customerSubstep, setCustomerSubstep] =
    useState<CustomerSubstep>("whatsapp");
  const [customerFound, setCustomerFound] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lastLookupDigitsRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const { services } = catalog;
  const professionals = catalog.professionals.filter(
    (p) => p.serviceIds.length > 0
  );

  const selectedProfessional = professionals.find((p) => p.id === professionalId);
  const currentStep = stepOrder.indexOf(step) + 1;
  const meta = stepMeta[step];

  const availableServices = useMemo(() => {
    const allowed = new Set(selectedProfessional?.serviceIds ?? []);
    return services.filter((s) => allowed.has(s.id));
  }, [selectedProfessional, services]);

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
    if (step !== "datetime" || !professionalId || serviceIds.length === 0) return;

    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);
    setStartTime(null);

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
          setSlotsError(
            body.message ?? "Nenhum horário livre neste dia para esses serviços."
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

    return () => {
      cancelled = true;
    };
  }, [step, professionalId, serviceIds, date]);

  function selectProfessional(id: string) {
    setProfessionalId(id);
    setServiceIds([]);
    setStartTime(null);
  }

  function toggleService(id: string, checked: boolean) {
    setServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id)
    );
    setStartTime(null);
  }

  function resetCustomerStep() {
    setCustomerSubstep("whatsapp");
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
    setCustomerSubstep("whatsapp");
  }

  function goBack() {
    if (step === "confirm") {
      if (customerSubstep === "identity") {
        lastLookupDigitsRef.current = normalizeWhatsapp(whatsapp) ?? "";
        setCustomerSubstep("whatsapp");
        setCustomerFound(false);
        setFirstName("");
        setLastName("");
        return;
      }
      resetCustomerStep();
      setStep("datetime");
      return;
    }
    if (step === "datetime") setStep("services");
    else if (step === "services") setStep("professional");
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
      setStep("datetime");
      return;
    }

    if (step === "datetime") {
      if (!startTime) {
        toast.error("Escolha um horário.");
        return;
      }
      resetCustomerStep();
      setStep("confirm");
    }
  }

  useEffect(() => {
    if (step !== "confirm" || customerSubstep !== "whatsapp") return;

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

      fetch(
        `/api/v1/customers/lookup?whatsapp=${encodeURIComponent(current)}`
      )
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
            setFirstName("");
            setLastName("");
            setCustomerFound(false);
          }

          setCustomerSubstep("identity");
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
  }, [whatsapp, step, customerSubstep]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const digits = normalizeWhatsapp(whatsapp);
    if (!firstName.trim() || !lastName.trim() || !digits) {
      toast.error("Preencha nome e WhatsApp.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId,
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

      setConfirmation({
        professionalId,
        professionalName: selectedProfessional!.nickname,
        professionalPhotoUrl: selectedProfessional!.photoUrl,
        professionalPhotoPosition: selectedProfessional!.photoPosition,
        date,
        startTime: startTime!,
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
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="bg-foreground px-5 py-8 text-center text-background sm:px-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-background/15 bg-background/10">
            <CheckCircle2 className="size-7" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            Horário agendado
          </h2>
          <p className="mt-1.5 text-sm text-background/70">
            {confirmation.customerName}, te esperamos!
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-xl border p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Data
                </p>
                <p className="mt-1 text-base font-semibold capitalize">
                  {formatDateBR(confirmation.date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Horário
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums leading-none">
                  {confirmation.startTime}
                </p>
              </div>
            </div>

            <div className="my-4 h-px bg-border" />

            <div className="flex items-center gap-3.5">
              <ProfessionalAvatar
                photoUrl={professionalPhotoUrl}
                photoPosition={professionalPhotoPosition}
                name={confirmation.professionalName}
                size="xl"
                className="border-2 border-border shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Barbeiro</p>
                <p className="truncate text-base font-semibold">
                  {confirmation.professionalName}
                </p>
              </div>
            </div>

            <div className="my-4 h-px bg-border" />

            <div>
              <p className="text-xs text-muted-foreground">Serviços</p>
              <p className="mt-1 font-medium leading-snug">
                {confirmation.serviceNames.join(", ")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDuration(confirmation.totalMinutes)} ·{" "}
                {formatPriceBRL(confirmation.totalPriceCents)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Precisa mudar? Acesse a aba{" "}
            <span className="font-medium text-foreground">Meus horários</span>{" "}
            com seu WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
        A barbearia ainda não tem barbeiros disponíveis para agendamento online.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Passo {currentStep} de {stepOrder.length}
          </span>
        </div>
        <StepProgress current={currentStep} />
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          {meta.title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {meta.description}
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {step === "professional" && (
          <ul className="flex flex-col gap-2">
            {professionals.map((pro) => {
              const selected = professionalId === pro.id;
              return (
                <li key={pro.id}>
                  <button
                    type="button"
                    onClick={() => selectProfessional(pro.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all",
                      selected
                        ? "border-foreground bg-muted/40"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
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
                        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-muted-foreground/30"
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
            <SelectionSummary
              professional={selectedProfessional}
              services={selectedServices}
              totalMinutes={totalMinutes}
              totalPriceLabel={totalPriceLabel}
            />

            {availableServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esse profissional ainda não tem serviços disponíveis.
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

                {serviceGroups.popular.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mais agendados
                    </p>
                    <ServicePickerList
                      services={serviceGroups.popular}
                      serviceIds={serviceIds}
                      onToggle={toggleService}
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
                      serviceIds={serviceIds}
                      onToggle={toggleService}
                    />
                  </div>
                )}

                {serviceGroups.popular.length === 0 &&
                  serviceGroups.others.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum serviço encontrado.
                    </p>
                  )}

                {serviceIds.length > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Total: {formatDuration(totalMinutes)} · {totalPriceLabel}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {step === "datetime" && selectedProfessional && (
          <div className="flex flex-col gap-4">
            <SelectionSummary
              professional={selectedProfessional}
              services={selectedServices}
              totalMinutes={totalMinutes}
              totalPriceLabel={totalPriceLabel}
            />

            <BookingDatePicker
              selectedDate={date}
              today={today}
              maxDate={maxDate}
              onSelectDate={setDate}
            />

            {loadingSlots ? (
              <SlotGridSkeleton />
            ) : slotsError ? (
              <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
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

        {step === "confirm" && selectedProfessional && (
          <form
            id="booking-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <SelectionSummary
              professional={selectedProfessional}
              services={selectedServices}
              date={date}
              startTime={startTime}
              totalMinutes={totalMinutes}
              totalPriceLabel={totalPriceLabel}
            />

            {customerSubstep === "whatsapp" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bookingWhatsapp" className="text-xs">
                  Seu WhatsApp
                </Label>
                <Input
                  id="bookingWhatsapp"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                  autoComplete="tel"
                  required
                />
                <div className="text-xs text-muted-foreground" aria-live="polite">
                  {lookupLoading ? (
                    <Skeleton className="inline-block h-3 w-44" aria-hidden />
                  ) : (
                    "Assim que você terminar de digitar, a gente identifica você."
                  )}
                </div>
              </div>
            )}

            {customerSubstep === "identity" && customerFound && (
              <div className="rounded-xl border bg-muted/30 px-4 py-5 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-background">
                  <User className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-base font-semibold">
                  É você, {firstName} {lastName}?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatWhatsapp(whatsapp.replace(/\D/g, ""))}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={handleNotMe}
                >
                  Não sou eu — usar outro número
                </Button>
              </div>
            )}

            {customerSubstep === "identity" && !customerFound && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Primeira vez por aqui? Informe seu nome pra confirmar.
                  </p>
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
                        required
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
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    WhatsApp: {formatWhatsapp(whatsapp.replace(/\D/g, ""))}
                  </p>
                </>
              )}
          </form>
        )}
      </div>

      <div className="flex gap-2 border-t bg-muted/20 px-5 py-4 sm:px-6">
        {step !== "professional" && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={goBack}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        )}
        {step === "confirm" ? (
          customerSubstep === "identity" && (
            <Button
              type="submit"
              form="booking-form"
              disabled={saving}
              size="lg"
              className="ml-auto min-w-0 flex-1 sm:flex-none sm:px-8"
            >
              {saving ? "Confirmando..." : "Confirmar agendamento"}
            </Button>
          )
        ) : (
          <Button
            type="button"
            onClick={goNext}
            size="lg"
            className="ml-auto min-w-0 flex-1 sm:flex-none sm:px-8"
          >
            Continuar
          </Button>
        )}
      </div>
    </div>
  );
}
