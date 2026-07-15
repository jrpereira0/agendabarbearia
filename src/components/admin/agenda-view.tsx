"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
      className="h-px w-full overflow-hidden bg-border"
      role="progressbar"
      aria-hidden
    >
      <div className="h-full w-1/4 bg-foreground/25 [animation:agenda-indeterminate_1.1s_ease-in-out_infinite] motion-reduce:animate-none" />
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
      <div className="shrink-0 border-b bg-background">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            onClick={onPrevDay}
            disabled={busy}
            aria-label="Dia anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="h-10 px-3"
            onClick={onToday}
            disabled={isToday || busy}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            onClick={onNextDay}
            disabled={busy}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-10 shrink-0"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Atualizar"
          >
            <RefreshCw className={cn(isRefreshing && "animate-spin")} />
          </Button>
        </div>
        <p
          className="px-4 pb-2.5 pt-1.5 text-center text-base font-semibold capitalize"
          aria-live="polite"
        >
          {dateLabel}
        </p>
        {isNavigating ? <AgendaNavProgress /> : null}
        {(canBookNormal || canBookEncaixe) && (
          <div className="flex gap-2 border-t px-4 py-2.5">
            {canBookNormal && (
              <Button
                className="h-10 flex-1"
                onClick={onBookNormal}
                disabled={busy}
              >
                + Agendar
              </Button>
            )}
            {canBookEncaixe && (
              <Button
                variant="outline"
                className="h-10 flex-1"
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
    <div className="shrink-0 border-b bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onPrevDay}
            disabled={busy}
            aria-label="Dia anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            disabled={isToday || busy}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onNextDay}
            disabled={busy}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </Button>
        </div>

        {canBookNormal && (
          <Button size="sm" onClick={onBookNormal} disabled={busy}>
            + Agendar
          </Button>
        )}
        {canBookEncaixe && (
          <Button
            size="sm"
            variant="outline"
            onClick={onBookEncaixe}
            disabled={busy}
          >
            + Encaixe
          </Button>
        )}

        <p
          className="min-w-0 flex-1 text-center text-sm font-medium sm:text-base"
          aria-live="polite"
        >
          {dateLabel}
        </p>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
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
    <>
      {dayContext.shopClosed ? (
        <div className="mb-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
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
      />
    </>
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

  const isToday = date === today;
  const displayDate = pendingDate ?? date;
  const isNavigating =
    isPending || (pendingDate !== null && pendingDate !== date);

  useEffect(() => {
    setPendingDate(null);
  }, [date]);

  useEffect(() => {
    if (!selectedAppointment) return;
    const fresh = appointments.find((apt) => apt.id === selectedAppointment.id);
    if (!fresh) {
      setSelectedAppointment(null);
      return;
    }
    if (
      fresh.status !== selectedAppointment.status ||
      fresh.startTime !== selectedAppointment.startTime ||
      fresh.endTime !== selectedAppointment.endTime ||
      fresh.professionalId !== selectedAppointment.professionalId
    ) {
      setSelectedAppointment(fresh);
    }
  }, [appointments, selectedAppointment]);

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

  useEffect(() => {
    if (!isPending) setIsRefreshing(false);
  }, [isPending]);

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
    canBookNormal,
    canBookEncaixe,
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
    onNewAppointment: () => openBooking("normal"),
    onEncaixe: () => openBooking("encaixe"),
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
    <div className="-m-4 md:-m-8">
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
                mobileProFocus == null
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
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
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground"
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
          <p className="px-4 pt-2 text-xs text-muted-foreground">
            Deslize a grade → para ver todos os barbeiros, ou escolha um acima.
          </p>
        ) : null}

        <div className="h-[min(62dvh,calc(100dvh-14rem))] min-h-[240px] shrink-0 overflow-y-auto overscroll-y-contain px-4 py-3 [-webkit-overflow-scrolling:touch] touch-pan-y">
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

        <div className="border-t bg-muted/15 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <AgendaSidebar {...sidebarProps} layout="mobile" mobileSection="tools" />
        </div>
      </div>

      {/* Desktop: grade fixa à esquerda com scroll próprio; calendário à direita rola com a página */}
      <div className="hidden lg:flex lg:items-start lg:gap-6 lg:p-6">
        <section className="sticky top-0 flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
          <AgendaToolbar {...toolbarProps} />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pb-6 pt-4">
            {isNavigating ? (
              gridSkeleton
            ) : (
              <AgendaMainContent {...mainContentProps} />
            )}
          </div>
        </section>

        <aside className="w-56 shrink-0 pb-6">
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
        professionals={dayContext.professionals.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          photoUrl: p.photoUrl,
          serviceIds: p.serviceIds,
          commissionPercent: p.commissionPercent,
        }))}
        commissionPercent={
          selectedAppointment
            ? (dayContext.professionals.find(
                (p) => p.id === selectedAppointment.professionalId
              )?.commissionPercent ?? 50)
            : 50
        }
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
