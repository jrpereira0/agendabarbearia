"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaGrid } from "@/components/admin/agenda-grid";
import { AgendaSidebar } from "@/components/admin/agenda-sidebar";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import { AppointmentDetailDialog } from "@/components/admin/appointment-detail-dialog";
import { EditAppointmentDialog } from "@/components/admin/edit-appointment-dialog";
import {
  NewAppointmentDialog,
  type BookingMode,
  type ProfessionalOption,
  type ServiceOption,
} from "@/components/admin/new-appointment-dialog";
import { formatAgendaHeaderDate } from "@/lib/agenda-grid-utils";
import type { AgendaDayContext } from "@/lib/get-agenda-day";

type AgendaViewProps = {
  date: string;
  today: string;
  isOwner: boolean;
  professionalId: string | null;
  dayContext: AgendaDayContext;
  appointments: AppointmentItem[];
  services: ServiceOption[];
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function AgendaToolbar({
  date,
  isToday,
  canBook,
  onPrevDay,
  onToday,
  onNextDay,
  onRefresh,
  onBookNormal,
  onBookEncaixe,
}: {
  date: string;
  isToday: boolean;
  canBook: boolean;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onRefresh: () => void;
  onBookNormal: () => void;
  onBookEncaixe: () => void;
}) {
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

      {canBook && (
        <>
          <Button size="sm" onClick={onBookNormal}>
            + Agendar
          </Button>
          <Button size="sm" variant="outline" onClick={onBookEncaixe}>
            + Encaixe
          </Button>
        </>
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
  onSlotClick,
  onAppointmentClick,
}: {
  dayContext: AgendaDayContext;
  appointments: AppointmentItem[];
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
  dayContext,
  appointments,
  services,
}: AgendaViewProps) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const canBook =
    professionals.length > 0 &&
    services.length > 0 &&
    (isOwner || professionalId !== null);

  function goToDate(next: string) {
    router.push(`/admin?date=${next}`);
  }

  function openBooking(
    mode: BookingMode,
    proId?: string,
    startTime?: string
  ) {
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
    setDetailOpen(true);
  }

  function handleEditAppointment(apt: AppointmentItem) {
    setSelectedAppointment(apt);
    setEditOpen(true);
  }

  const sidebarProps = {
    date,
    today,
    canBook,
    isOwner,
    professionalId,
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
    canBook,
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
    onSlotClick: handleSlotClick,
    onAppointmentClick: handleAppointmentClick,
  };

  return (
    <div className="-m-4 md:-m-8">
      {/* Mobile: barra no topo, calendário rola com a página, grade com scroll próprio */}
      <div className="flex flex-col lg:hidden">
        <AgendaToolbar {...toolbarProps} />

        <div className="p-4">
          <AgendaSidebar {...sidebarProps} />
        </div>

        <div className="h-[55dvh] min-h-[240px] shrink-0 overflow-y-auto overscroll-y-contain px-4 pb-4">
          <AgendaMainContent {...mainContentProps} />
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
          <AgendaSidebar {...sidebarProps} />
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

      <AppointmentDetailDialog
        appointment={selectedAppointment}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        showProfessional={isOwner}
        professionalPhotoUrl={
          selectedAppointment
            ? professionals.find(
                (p) => p.id === selectedAppointment.professionalId
              )?.photoUrl ?? null
            : null
        }
        onEdit={() => handleEditAppointment(selectedAppointment!)}
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
    </div>
  );
}
