"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatAgendaHeaderDate } from "@/lib/agenda-grid-utils";
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
  mobile?: boolean;
}) {
  const busy = isNavigating || isRefreshing;
  const dateLabel = formatAgendaHeaderDate(date);

  if (mobile) {
    return (
      <div className="agenda-toolbar shrink-0 border-b">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Button
            variant="outline"
            size="icon"
            className="agenda-btn-outline size-10"
            onClick={onPrevDay}
            disabled={busy}
            aria-label="Dia anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="agenda-btn-outline h-10 px-3"
            onClick={onToday}
            disabled={isToday || busy}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="agenda-btn-outline size-10"
            onClick={onNextDay}
            disabled={busy}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="agenda-btn-ghost ml-auto size-10 shrink-0"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Atualizar"
          >
            <RefreshCw className={cn(isRefreshing && "animate-spin")} />
          </Button>
        </div>
        <p
          className="agenda-display px-4 pb-2.5 pt-1.5 text-center text-base font-medium capitalize"
          aria-live="polite"
        >
          {dateLabel}
        </p>
        {isNavigating ? <AgendaNavProgress /> : null}
        {(canBookNormal || canBookEncaixe) && (
          <div className="flex gap-2 border-t border-white/10 px-4 py-2.5">
            {canBookNormal && (
              <Button
                className="agenda-btn-primary h-10 flex-1"
                onClick={onBookNormal}
                disabled={busy}
              >
                + Agendar
              </Button>
            )}
            {canBookEncaixe && (
              <Button
                variant="outline"
                className="agenda-btn-encaixe h-10 flex-1"
                onClick={onBookEncaixe}
                disabled={busy}
              >
                + Encaixe
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="agenda-toolbar shrink-0 border-b">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 md:px-6">
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

        {canBookNormal && (
          <Button
            size="sm"
            className="agenda-btn-primary"
            onClick={onBookNormal}
            disabled={busy}
          >
            + Agendar
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
            + Encaixe
          </Button>
        )}

        <p
          className="agenda-display min-w-0 flex-1 text-center text-sm font-medium sm:text-base"
          aria-live="polite"
        >
          {dateLabel}
        </p>

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
}: {
  dayContext: AgendaDayContext;
  appointments: AppointmentItem[];
  isOwner: boolean;
  canBookClients: boolean;
  onSlotClick: (proId: string, startTime: string) => void;
  onAppointmentClick: (apt: AppointmentItem) => void;
  mobileLayout?: boolean;
  focusProfessionalId?: string | null;
}) {
  const professionals =
    focusProfessionalId == null
      ? dayContext.professionals
      : dayContext.professionals.filter((p) => p.id === focusProfessionalId);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        mobileLayout ? "h-full" : "flex-1"
      )}
    >
      {dayContext.shopClosed ? (
        <div className="agenda-closed-banner mb-4 shrink-0 rounded-lg border border-dashed p-6 text-center text-sm">
          A barbearia está fechada neste dia.
        </div>
      ) : null}

      <AgendaGrid
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
        className="min-h-0 flex-1"
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
  /** No celular: filtrar a grade por um barbeiro (`null` = todos). */
  const [mobileProFocus, setMobileProFocus] = useState<string | null>(null);
  const [prevDate, setPrevDate] = useState(date);

  const displayDate = pendingDate ?? date;
  const isNavigating =
    isPending || (pendingDate !== null && pendingDate !== date);

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
    proId?: string,
    startTime?: string
  ) {
    if (mode === "normal" && !canBookNormal) return;
    if (mode === "encaixe" && !canBookEncaixe) return;

    setBookingMode(mode);
    setBookingProfessionalId(
      proId ?? (isOwner ? null : professionalId ?? professionals[0]?.id ?? null)
    );
    setBookingStartTime(startTime ?? null);
    setNewOpen(true);
  }

  function handleSlotClick(proId: string, startTime: string) {
    openBooking("normal", proId, startTime);
  }

  function handleAppointmentClick(apt: AppointmentItem) {
    setSelectedAppointment(apt);
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
  };

  const mainContentProps = {
    dayContext,
    appointments,
    isOwner,
    canBookClients: permissions.canBookClients,
    onSlotClick: handleSlotClick,
    onAppointmentClick: handleAppointmentClick,
  };

  const showMobileProFilter = dayContext.professionals.length > 1;

  const gridSkeleton = (
    <AgendaGridSkeleton
      professionalCount={Math.max(dayContext.professionals.length, 1)}
    />
  );

  return (
    <div className="admin-agenda -m-4 md:-m-8 min-h-full">
      {/* Mobile: grade com altura fixa e scroll próprio; calendário e extras rolam com a página */}
      <div className="flex flex-col lg:hidden">
        <AgendaToolbar {...toolbarProps} mobile />

        <div className="px-4 pt-3">
          <AgendaSidebar {...sidebarProps} layout="mobile" mobileSection="date" />
        </div>

        {showMobileProFilter ? (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setMobileProFocus(null)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                mobileProFocus == null ? "agenda-chip-active" : "agenda-chip"
              )}
            >
              Todos
            </button>
            {dayContext.professionals.map((pro) => {
              const selected = mobileProFocus === pro.id;
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

        {showMobileProFilter && mobileProFocus == null ? (
          <p className="px-4 pt-2 text-xs text-[var(--agenda-muted)]">
            Deslize a grade → para ver todos os barbeiros, ou escolha um acima.
          </p>
        ) : null}

        <div className="h-[min(62dvh,calc(100dvh-14rem))] min-h-[240px] shrink-0 overflow-hidden px-4 py-3">
          {isNavigating ? (
            gridSkeleton
          ) : (
            <AgendaMainContent
              {...mainContentProps}
              mobileLayout
              focusProfessionalId={mobileProFocus}
            />
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <AgendaSidebar {...sidebarProps} layout="mobile" mobileSection="tools" />
        </div>
      </div>

      {/* Desktop: grade fixa à esquerda; painel à direita */}
      <div className="hidden lg:flex lg:items-start lg:gap-5 lg:p-5 xl:gap-6 xl:p-6">
        <section className="agenda-main-frame sticky top-0 flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
          <AgendaToolbar {...toolbarProps} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-5 pt-4 xl:px-5">
            {isNavigating ? (
              gridSkeleton
            ) : (
              <AgendaMainContent {...mainContentProps} />
            )}
          </div>
        </section>

        <aside className="w-72 shrink-0 pb-6">
          <AgendaSidebar {...sidebarProps} layout="desktop" />
        </aside>
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
        key={`${actionsOpen}-${selectedAppointment?.id}-${selectedAppointment?.status}`}
        appointment={selectedAppointment}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
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
