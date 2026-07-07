"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaGrid } from "@/components/admin/agenda-grid";
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
import type { CashRegisterResponsibleOption } from "@/components/admin/open-cash-register-dialog";
import type { ProfessionalPermissions } from "@/lib/professional-permissions";

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
  cashRegister?: AgendaCashRegisterData;
};

function AgendaToolbar({
  date,
  isToday,
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
  if (mobile) {
    return (
      <div className="shrink-0 border-b bg-background">
        <div className="flex items-center gap-1 px-4 py-2.5">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onPrevDay}
            aria-label="Dia anterior"
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday} disabled={isToday}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onNextDay}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-medium">
            {formatAgendaHeaderDate(date)}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onRefresh}
            aria-label="Atualizar"
          >
            <RefreshCw />
          </Button>
        </div>
        {(canBookNormal || canBookEncaixe) && (
          <div className="flex gap-2 border-t px-4 py-2">
            {canBookNormal && (
              <Button size="sm" className="flex-1" onClick={onBookNormal}>
                + Agendar
              </Button>
            )}
            {canBookEncaixe && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onBookEncaixe}
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
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-3 md:px-6">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={onPrevDay}
          aria-label="Dia anterior"
        >
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday} disabled={isToday}>
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={onNextDay}
          aria-label="Próximo dia"
        >
          <ChevronRight />
        </Button>
      </div>

      {canBookNormal && (
        <Button size="sm" onClick={onBookNormal}>
          + Agendar
        </Button>
      )}
      {canBookEncaixe && (
        <Button size="sm" variant="outline" onClick={onBookEncaixe}>
          + Encaixe
        </Button>
      )}

      <p className="flex-1 text-center text-sm font-medium sm:text-base">
        {formatAgendaHeaderDate(date)}
      </p>

      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onRefresh}
        aria-label="Atualizar"
      >
        <RefreshCw />
      </Button>
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
}: {
  dayContext: AgendaDayContext;
  appointments: AppointmentItem[];
  isOwner: boolean;
  canBookClients: boolean;
  onSlotClick: (proId: string, startTime: string) => void;
  onAppointmentClick: (apt: AppointmentItem) => void;
}) {
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
        professionals={dayContext.professionals}
        appointments={appointments}
        isOwner={isOwner}
        canBookClients={canBookClients}
        onSlotClick={onSlotClick}
        onAppointmentClick={onAppointmentClick}
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
  cashRegister,
}: AgendaViewProps) {
  const router = useRouter();
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

  const isToday = date === today;

  const professionals: ProfessionalOption[] = useMemo(
    () =>
      dayContext.professionals.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        photoUrl: p.photoUrl,
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
    router.push(`/admin?date=${next}`);
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
    today,
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
    date,
    isToday,
    canBookNormal,
    canBookEncaixe,
    onPrevDay: () => goToDate(shiftDate(date, -1)),
    onToday: () => goToDate(today),
    onNextDay: () => goToDate(shiftDate(date, 1)),
    onRefresh: () => router.refresh(),
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

  return (
    <div className="-m-4 md:-m-8">
      {/* Mobile: grade em destaque; calendário e extras colapsáveis */}
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:hidden">
        <AgendaToolbar {...toolbarProps} mobile />

        <div className="shrink-0 px-4 pt-3">
          <AgendaSidebar {...sidebarProps} layout="mobile" mobileSection="date" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          <AgendaMainContent {...mainContentProps} />
        </div>

        <div className="shrink-0 border-t bg-muted/15 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <AgendaSidebar {...sidebarProps} layout="mobile" mobileSection="tools" />
        </div>
      </div>

      {/* Desktop: grade fixa à esquerda com scroll próprio; calendário à direita rola com a página */}
      <div className="hidden lg:flex lg:items-start lg:gap-6 lg:p-6">
        <section className="sticky top-0 flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
          <AgendaToolbar {...toolbarProps} />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pb-6 pt-4">
            <AgendaMainContent {...mainContentProps} />
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
