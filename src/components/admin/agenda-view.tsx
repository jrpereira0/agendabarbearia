"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AgendaGrid } from "@/components/admin/agenda-grid";
import { AgendaGridSkeleton } from "@/components/admin/agenda-grid-skeleton";
import { AgendaSidebar } from "@/components/admin/agenda-sidebar";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import { ComandaDialog } from "@/components/admin/comanda-dialog";
import { AgendaCashRegisterSheet } from "@/components/admin/agenda-cash-register-sheet";
import { AppointmentActionsDialog } from "@/components/admin/appointment-actions-dialog";
import { EditAppointmentDialog } from "@/components/admin/edit-appointment-dialog";
import {
  NewAppointmentDialog,
  type BookingMode,
  type ProfessionalOption,
  type ServiceOption,
} from "@/components/admin/new-appointment-dialog";
import { formatAgendaHeaderParts } from "@/lib/agenda-grid-utils";
import { shiftDate } from "@/lib/date-range";
import type { AgendaDayContext } from "@/lib/get-agenda-day";
import type { CashRegisterSession } from "@/lib/cash-register-service";
import type { CashRegisterSummary } from "@/lib/finance-reports";
import type { ProductOption } from "@/lib/product-types";
import type { CashRegisterResponsibleOption } from "@/components/admin/open-cash-register-dialog";
import type { ProfessionalPermissions } from "@/lib/professional-permissions";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import { cn } from "@/lib/utils";

type AgendaCashRegisterData = {
  cash: CashRegisterSummary;
  cashSession: CashRegisterSession | null;
  openCashRegister: CashRegisterSession | null;
  responsibleOptions: CashRegisterResponsibleOption[];
};

type AgendaViewProps = {
  date: string;
  today: string;
  isOwner: boolean;
  professionalId: string | null;
  permissions: ProfessionalPermissions;
  dayContext: AgendaDayContext;
  appointments: AppointmentItem[];
  services: ServiceOption[];
  productsCatalog?: ProductOption[];
  cashRegister?: AgendaCashRegisterData;
};

function AgendaNavProgress() {
  return (
    <div
      className="agenda-progress h-px w-full overflow-hidden"
      role="progressbar"
      aria-hidden
    >
      <div className="agenda-progress-bar h-full w-1/4 [animation:agenda-indeterminate_1.1s_ease-in-out_infinite] motion-reduce:animate-none" />
    </div>
  );
}

function AgendaToolbar({
  date,
  isToday,
  isNavigating,
  isRefreshing,
  canBookNormal,
  canBookEncaixe,
  onPrevDay,
  onToday,
  onNextDay,
  onRefresh,
  onBookNormal,
  onBookEncaixe,
  onMore,
  mobile = false,
}: {
  date: string;
  isToday: boolean;
  isNavigating: boolean;
  isRefreshing: boolean;
  canBookNormal: boolean;
  canBookEncaixe: boolean;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onRefresh: () => void;
  onBookNormal: () => void;
  onBookEncaixe: () => void;
  onMore?: () => void;
  mobile?: boolean;
}) {
  const busy = isNavigating || isRefreshing;
  const { weekday, dayMonth } = formatAgendaHeaderParts(date);

  if (mobile) {
    return (
      <div className="agenda-toolbar shrink-0 border-b border-white/10">
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="agenda-btn-ghost size-9 shrink-0"
            onClick={onPrevDay}
            disabled={busy}
            aria-label="Dia anterior"
          >
            <ChevronLeft className="size-5" />
          </Button>

          <div className="min-w-0 flex-1 text-center" aria-live="polite">
            <p className="agenda-display truncate text-[15px] font-medium leading-tight tracking-tight">
              {weekday}
              {isToday ? (
                <span className="ml-1.5 text-[11px] font-normal text-[var(--agenda-accent,#ecf15e)]">
                  Hoje
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-[11px] capitalize text-[var(--agenda-muted,#8b8d93)]">
              {dayMonth}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="agenda-btn-ghost size-9 shrink-0"
            onClick={onNextDay}
            disabled={busy}
            aria-label="Próximo dia"
          >
            <ChevronRight className="size-5" />
          </Button>

          {!isToday ? (
            <Button
              variant="outline"
              className="agenda-btn-outline h-8 shrink-0 px-2.5 text-[11px]"
              onClick={onToday}
              disabled={busy}
            >
              Hoje
            </Button>
          ) : null}

          {onMore ? (
            <Button
              variant="ghost"
              size="icon"
              className="agenda-btn-ghost size-9 shrink-0"
              onClick={onMore}
              aria-label="Mais opções"
            >
              <CalendarDays className="size-4" />
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="agenda-btn-ghost size-9 shrink-0"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
        {isNavigating ? <AgendaNavProgress /> : null}
      </div>
    );
  }

  return (
    <div className="agenda-toolbar shrink-0 border-b">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-3.5 md:px-6">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="agenda-btn-outline size-8"
            onClick={onPrevDay}
            disabled={busy}
            aria-label="Dia anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="agenda-btn-outline"
            onClick={onToday}
            disabled={isToday || busy}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="agenda-btn-outline size-8"
            onClick={onNextDay}
            disabled={busy}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </Button>
        </div>

        <div
          className="min-w-0 flex-1 px-2 text-center sm:text-left"
          aria-live="polite"
        >
          <p className="agenda-display text-lg font-medium leading-tight tracking-tight sm:text-xl">
            {weekday}
            {isToday ? (
              <span className="ml-2 align-middle text-sm font-normal text-[var(--agenda-accent,#ecf15e)]">
                Hoje
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm capitalize text-[var(--agenda-muted,#8b8d93)]">
            {dayMonth}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="agenda-btn-ghost size-8"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Atualizar"
          >
            <RefreshCw className={cn(isRefreshing && "animate-spin")} />
          </Button>
          {canBookNormal && (
            <Button
              size="sm"
              className="agenda-btn-primary"
              onClick={onBookNormal}
              disabled={busy}
            >
              Agendar
            </Button>
          )}
          {canBookEncaixe && (
            <Button
              size="sm"
              variant="outline"
              className="agenda-btn-encaixe"
              onClick={onBookEncaixe}
              disabled={busy}
            >
              Encaixe
            </Button>
          )}
        </div>
      </div>
      {isNavigating ? <AgendaNavProgress /> : null}
    </div>
  );
}

function AgendaMainContent({
  dayContext,
  appointments,
  isOwner,
  canBookClients,
  onSlotClick,
  onAppointmentClick,
  mobileLayout = false,
  focusProfessionalId = null,
  date,
  today,
}: {
  dayContext: AgendaDayContext;
  appointments: AppointmentItem[];
  isOwner: boolean;
  canBookClients: boolean;
  onSlotClick: (proId: string, startTime: string) => void;
  onAppointmentClick: (apt: AppointmentItem, serviceIndex?: number) => void;
  mobileLayout?: boolean;
  focusProfessionalId?: string | null;
  date: string;
  today: string;
}) {
  const professionals =
    focusProfessionalId == null
      ? dayContext.professionals
      : dayContext.professionals.filter((p) => p.id === focusProfessionalId);

  return (
    <div>
      {dayContext.shopClosed ? (
        <div className="agenda-closed-banner mb-4 rounded-lg border border-dashed p-6 text-center text-sm">
          A barbearia está fechada neste dia.
        </div>
      ) : null}

      <AgendaGrid
        date={date}
        today={today}
        gridStart={dayContext.gridStart}
        gridEnd={dayContext.gridEnd}
        slotStepMinutes={dayContext.slotStepMinutes}
        professionals={professionals}
        appointments={appointments}
        isOwner={isOwner}
        canBookClients={canBookClients}
        onSlotClick={onSlotClick}
        onAppointmentClick={onAppointmentClick}
        mobileLayout={mobileLayout}
      />
    </div>
  );
}

export function AgendaView({
  date,
  today,
  isOwner,
  professionalId,
  permissions,
  dayContext,
  appointments,
  services,
  productsCatalog = [],
  cashRegister,
}: AgendaViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentItem | null>(null);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState<number | null>(
    null
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  const [comandaOpen, setComandaOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<BookingMode>("normal");
  const [bookingProfessionalId, setBookingProfessionalId] = useState<
    string | null
  >(null);
  const [bookingStartTime, setBookingStartTime] = useState<string | null>(
    null
  );
  /** No celular: sempre 1 barbeiro na grade. */
  const [mobileProFocus, setMobileProFocus] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [prevDate, setPrevDate] = useState(date);

  const displayDate = pendingDate ?? date;
  const isNavigating =
    isPending || (pendingDate !== null && pendingDate !== date);

  const professionals: ProfessionalOption[] = useMemo(
    () =>
      dayContext.professionals.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        photoUrl: p.photoUrl,
        photoPosition: p.photoPosition,
        serviceIds: p.serviceIds,
      })),
    [dayContext.professionals]
  );

  const resolvedMobileProId = useMemo(() => {
    if (professionals.length === 0) return null;
    if (
      mobileProFocus &&
      professionals.some((pro) => pro.id === mobileProFocus)
    ) {
      return mobileProFocus;
    }
    if (
      professionalId &&
      professionals.some((pro) => pro.id === professionalId)
    ) {
      return professionalId;
    }
    return professionals[0]!.id;
  }, [professionals, mobileProFocus, professionalId]);

  if (
    resolvedMobileProId !== null &&
    mobileProFocus !== resolvedMobileProId
  ) {
    setMobileProFocus(resolvedMobileProId);
  }

  // A navegação (troca de dia) foi confirmada pelo servidor → some o estado otimista.
  if (date !== prevDate) {
    setPrevDate(date);
    setPendingDate(null);
  }

  // Mantém o agendamento selecionado sincronizado com dados mais recentes da agenda.
  if (selectedAppointment) {
    const fresh = appointments.find((apt) => apt.id === selectedAppointment.id);
    if (!fresh) {
      setSelectedAppointment(null);
    } else {
      const servicesChanged =
        fresh.services.length !== selectedAppointment.services.length ||
        fresh.services.some(
          (service, index) =>
            service.id !== selectedAppointment.services[index]?.id ||
            service.priceCents !==
              selectedAppointment.services[index]?.priceCents
        );

      if (
        fresh.status !== selectedAppointment.status ||
        fresh.startTime !== selectedAppointment.startTime ||
        fresh.endTime !== selectedAppointment.endTime ||
        fresh.professionalId !== selectedAppointment.professionalId ||
        fresh.customerFirstName !== selectedAppointment.customerFirstName ||
        fresh.customerLastName !== selectedAppointment.customerLastName ||
        fresh.customerWhatsapp !== selectedAppointment.customerWhatsapp ||
        servicesChanged
      ) {
        setSelectedAppointment(fresh);
      }
    }
  }

  const canBookBase =
    professionals.length > 0 &&
    services.length > 0 &&
    (isOwner || professionalId !== null);
  const canBookNormal = canBookBase && permissions.canBookClients;
  const canBookEncaixe = canBookBase && permissions.canCreateSqueezeIn;

  function goToDate(next: string) {
    if (next === displayDate && !isNavigating) return;
    setPendingDate(next);
    startTransition(() => {
      router.push(`/admin?date=${next}`, { scroll: false });
    });
  }

  function handleRefresh() {
    setIsRefreshing(true);
    startTransition(() => {
      router.refresh();
    });
  }

  // A transição do `router.refresh()` terminou → desliga o indicador de "atualizando".
  if (!isPending && isRefreshing) {
    setIsRefreshing(false);
  }

  function openBooking(
    mode: BookingMode,
    proId?: string | null,
    startTime?: string
  ) {
    if (mode === "normal" && !canBookNormal) return;
    if (mode === "encaixe" && !canBookEncaixe) return;

    setBookingMode(mode);
    // proId undefined = botão Agendar/Encaixe (dono começa no passo do barbeiro).
    // proId informado = clique na grade ou FAB mobile com barbeiro já escolhido.
    setBookingProfessionalId(
      proId !== undefined
        ? proId
        : isOwner
          ? null
          : (professionalId ?? professionals[0]?.id ?? null)
    );
    setBookingStartTime(startTime ?? null);
    setNewOpen(true);
  }

  function handleSlotClick(proId: string, startTime: string) {
    openBooking("normal", proId, startTime);
  }

  function handleAppointmentClick(apt: AppointmentItem, serviceIndex?: number) {
    setSelectedAppointment(apt);
    setSelectedServiceIndex(
      typeof serviceIndex === "number" ? serviceIndex : null
    );
    setActionsOpen(true);
  }

  function handleOpenComanda() {
    setComandaOpen(true);
  }

  function handleEditAppointment(apt?: AppointmentItem) {
    if (apt) setSelectedAppointment(apt);
    setEditOpen(true);
  }

  function handleCashComandaClick(appointmentId: string) {
    const apt = appointments.find((row) => row.id === appointmentId);
    if (!apt) return;
    setSelectedAppointment(apt);
    setComandaOpen(true);
  }

  const sidebarProps = {
    date,
    displayDate,
    today,
    isNavigating,
    isOwner,
    professionalId,
    canManageScheduleBlocks: permissions.canManageScheduleBlocks,
    slotStepMinutes: dayContext.slotStepMinutes,
    scheduleBlocks: dayContext.scheduleBlocks,
    professionals: professionals.map((p) => ({
      id: p.id,
      nickname: p.nickname,
    })),
    onDateChange: goToDate,
  };

  const toolbarProps = {
    date: displayDate,
    isToday: displayDate === today,
    isNavigating,
    isRefreshing,
    canBookNormal,
    canBookEncaixe,
    onPrevDay: () => goToDate(shiftDate(displayDate, -1)),
    onToday: () => goToDate(today),
    onNextDay: () => goToDate(shiftDate(displayDate, 1)),
    onRefresh: handleRefresh,
    onBookNormal: () => openBooking("normal"),
    onBookEncaixe: () => openBooking("encaixe"),
    onMore: () => setMobileMoreOpen(true),
  };

  const mainContentProps = {
    dayContext,
    appointments,
    isOwner,
    canBookClients: permissions.canBookClients,
    onSlotClick: handleSlotClick,
    onAppointmentClick: handleAppointmentClick,
    date: displayDate,
    today,
  };

  const showMobileProFilter = dayContext.professionals.length > 1;
  const busyMobile = isNavigating || isRefreshing;

  const gridSkeleton = (
    <AgendaGridSkeleton
      professionalCount={Math.max(dayContext.professionals.length, 1)}
    />
  );

  return (
    <div className="admin-agenda -m-4 md:-m-8 min-h-full min-w-0 overflow-x-clip">
      {/* Mobile */}
      <div className="flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden">
        <AgendaToolbar {...toolbarProps} mobile />

        {showMobileProFilter ? (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dayContext.professionals.map((pro) => {
              const selected = resolvedMobileProId === pro.id;
              return (
                <button
                  key={pro.id}
                  type="button"
                  onClick={() => setMobileProFocus(pro.id)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                    selected ? "agenda-chip-active" : "agenda-chip"
                  )}
                >
                  <ProfessionalAvatar
                    photoUrl={pro.photoUrl}
                    photoPosition={pro.photoPosition}
                    name={pro.nickname}
                    size="sm"
                    className="size-6 border-0"
                  />
                  {pro.nickname}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="px-4 py-3">
          {isNavigating ? (
            gridSkeleton
          ) : (
            <AgendaMainContent
              {...mainContentProps}
              mobileLayout
              focusProfessionalId={resolvedMobileProId}
            />
          )}
        </div>

        <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
          <SheetContent
            side="bottom"
            className="admin-agenda max-h-[85dvh] overflow-y-auto rounded-t-2xl border-white/10 bg-[var(--agenda-bg,#0e0f11)] text-[#f5f5f5]"
          >
            <SheetHeader className="text-left">
              <SheetTitle className="agenda-display text-[#f5f5f5]">
                Mais opções
              </SheetTitle>
            </SheetHeader>
            <div className="px-1 pb-4">
              <AgendaSidebar
                {...sidebarProps}
                onDateChange={(nextDate) => {
                  goToDate(nextDate);
                  setMobileMoreOpen(false);
                }}
                layout="mobile"
                mobileSection="more"
              />
            </div>
          </SheetContent>
        </Sheet>

        {(canBookNormal || canBookEncaixe) && (
          <div className="agenda-mobile-actions fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgb(14_15_17_/_96%)] px-4 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
            <div className="flex gap-2">
              {canBookNormal && (
                <Button
                  className="agenda-btn-primary h-11 flex-1"
                  onClick={() => openBooking("normal", resolvedMobileProId ?? undefined)}
                  disabled={busyMobile}
                >
                  Agendar
                </Button>
              )}
              {canBookEncaixe && (
                <Button
                  variant="outline"
                  className="agenda-btn-encaixe h-11 flex-1"
                  onClick={() =>
                    openBooking("encaixe", resolvedMobileProId ?? undefined)
                  }
                  disabled={busyMobile}
                >
                  Encaixe
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: grade preenche a largura; calendário colado à direita */}
      <div className="agenda-desktop-layout hidden min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-4 lg:p-4 xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-5 xl:p-5">
        <section className="agenda-main-frame min-w-0 rounded-2xl border">
          <AgendaToolbar {...toolbarProps} />
          <div className="px-3 pb-4 pt-3 xl:px-4">
            {isNavigating ? (
              gridSkeleton
            ) : (
              <AgendaMainContent {...mainContentProps} />
            )}
          </div>
        </section>

        <div className="min-w-0 pb-6">
          <AgendaSidebar {...sidebarProps} layout="desktop" />
        </div>
      </div>

      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        date={date}
        professionals={professionals}
        services={services}
        isOwner={isOwner}
        mode={bookingMode}
        defaultProfessionalId={bookingProfessionalId}
        defaultStartTime={bookingStartTime}
        slotStepMinutes={dayContext.slotStepMinutes}
        appointments={appointments}
        professionalSchedules={dayContext.professionals.map((p) => ({
          id: p.id,
          availableRanges: p.availableRanges,
        }))}
      />

      <AppointmentActionsDialog
        key={`${actionsOpen}-${selectedAppointment?.id}-${selectedAppointment?.status}-${selectedServiceIndex}`}
        appointment={selectedAppointment}
        focusedServiceIndex={selectedServiceIndex}
        open={actionsOpen}
        onOpenChange={(open) => {
          setActionsOpen(open);
          if (!open) setSelectedServiceIndex(null);
        }}
        isOwner={isOwner}
        permissions={permissions}
        sessionProfessionalId={professionalId}
        onOpenComanda={handleOpenComanda}
        onEditAppointment={() => handleEditAppointment()}
      />

      <ComandaDialog
        appointment={selectedAppointment}
        open={comandaOpen}
        onOpenChange={setComandaOpen}
        permissions={permissions}
        servicesCatalog={services}
        productsCatalog={productsCatalog}
        sessionProfessionalId={professionalId}
        slotStepMinutes={dayContext.slotStepMinutes}
        appointments={appointments}
        isOwnerHint={isOwner}
        initialCashRegisterOpen={
          Boolean(
            cashRegister?.openCashRegister &&
              selectedAppointment &&
              cashRegister.openCashRegister.serviceDate ===
                selectedAppointment.date
          )
        }
        initialOpenCashRegisterDate={
          cashRegister?.openCashRegister?.serviceDate ?? null
        }
        professionals={dayContext.professionals.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          photoUrl: p.photoUrl,
          serviceIds: p.serviceIds,
          commissionPercent: p.commissionPercent,
        }))}
        onEditSchedule={
          isOwner && selectedAppointment
            ? () => {
                setComandaOpen(false);
                handleEditAppointment();
              }
            : undefined
        }
      />

      <EditAppointmentDialog
        appointment={selectedAppointment}
        open={editOpen}
        onOpenChange={setEditOpen}
        professionals={professionals}
        services={services}
        isOwner={isOwner}
        slotStepMinutes={dayContext.slotStepMinutes}
        appointments={appointments}
        professionalSchedules={dayContext.professionals.map((p) => ({
          id: p.id,
          availableRanges: p.availableRanges,
        }))}
      />

      {isOwner && cashRegister && (
        <AgendaCashRegisterSheet
          date={date}
          today={today}
          cash={cashRegister.cash}
          cashSession={cashRegister.cashSession}
          openCashRegister={cashRegister.openCashRegister}
          responsibleOptions={cashRegister.responsibleOptions}
          onComandaClick={handleCashComandaClick}
        />
      )}
    </div>
  );
}
