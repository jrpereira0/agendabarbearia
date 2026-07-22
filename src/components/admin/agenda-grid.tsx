"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  buildTimeSlots,
  computeOverlapLayouts,
  appointmentGridRows,
  isSlotStartAvailable,
  rowHeightForStep,
  shouldShowTimeLabel,
  timeLabel,
} from "@/lib/agenda-grid-utils";
import { minuteRangeOverlaps, timeToMinutes } from "@/lib/availability";
import { AppointmentGridBlock } from "@/components/admin/appointment-grid-block";
import { ProfessionalAvatar } from "@/components/admin/professional-avatar";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import {
  agendaCellClass,
  agendaCellHoverFree,
} from "@/lib/agenda-colors";
import {
  blocksAgendaSlot,
  sharesAgendaColumnLayout,
} from "@/lib/appointment-status";
import type { AgendaProfessionalColumn } from "@/lib/get-agenda-day";

type AgendaGridProps = {
  gridStart: number;
  gridEnd: number;
  slotStepMinutes: number;
  professionals: AgendaProfessionalColumn[];
  appointments: AppointmentItem[];
  isOwner: boolean;
  canBookClients: boolean;
  onSlotClick: (professionalId: string, startTime: string) => void;
  onAppointmentClick: (appointment: AppointmentItem) => void;
  /** Colunas mais largas e linhas mais altas (uso no celular). */
  mobileLayout?: boolean;
  className?: string;
};

const gridLineHour = "agenda-grid-line-hour";
const gridLineSlot = "agenda-grid-line-slot";
const gridLineColumn = "agenda-grid-line-col";
const gridLineOuter = "border-white/10";

function slotLineClass(minute: number): string {
  return minute % 60 === 0
    ? `border-t border-solid ${gridLineHour}`
    : `border-t border-dashed ${gridLineSlot}`;
}

function isOutsideForAll(
  minute: number,
  slotStepMinutes: number,
  professionals: AgendaProfessionalColumn[]
): boolean {
  if (professionals.length === 0) return true;
  return professionals.every(
    (pro) =>
      !isSlotStartAvailable(minute, slotStepMinutes, pro.availableRanges, [])
  );
}

export function AgendaGrid({
  gridStart,
  gridEnd,
  slotStepMinutes,
  professionals,
  appointments,
  isOwner,
  canBookClients,
  onSlotClick,
  onAppointmentClick,
  mobileLayout = false,
  className,
}: AgendaGridProps) {
  const rowHeight = mobileLayout
    ? Math.max(14, Math.round(rowHeightForStep(slotStepMinutes) * 1.4))
    : rowHeightForStep(slotStepMinutes);
  const outsideRowHeight = Math.max(6, Math.round(rowHeight * 0.35));

  const timeSlots = useMemo(
    () => buildTimeSlots(gridStart, gridEnd, slotStepMinutes),
    [gridStart, gridEnd, slotStepMinutes]
  );

  const slotOutside = useMemo(
    () =>
      timeSlots.map((minute) =>
        isOutsideForAll(minute, slotStepMinutes, professionals)
      ),
    [timeSlots, slotStepMinutes, professionals]
  );

  const appointmentsByPro = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();
    for (const pro of professionals) map.set(pro.id, []);
    for (const apt of appointments) {
      if (blocksAgendaSlot(apt)) {
        map.get(apt.professionalId)?.push(apt);
      }
    }
    return map;
  }, [appointments, professionals]);

  const overlapLayoutsByPro = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeOverlapLayouts>>();
    for (const pro of professionals) {
      const apts = appointments.filter(
        (apt) =>
          apt.professionalId === pro.id && sharesAgendaColumnLayout(apt)
      );
      map.set(pro.id, computeOverlapLayouts(apts));
    }
    return map;
  }, [appointments, professionals]);

  const proColumnIndex = useMemo(() => {
    const map = new Map<string, number>();
    professionals.forEach((p, i) => map.set(p.id, i + 2));
    return map;
  }, [professionals]);

  if (professionals.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        Cadastre profissionais ativos para ver a grade.
      </div>
    );
  }

  const footerRow = timeSlots.length + 2;

  const colMin = mobileLayout
    ? professionals.length === 1
      ? "minmax(0, 1fr)"
      : "minmax(10rem, 1fr)"
    : "minmax(7.5rem, 1fr)";

  const rowTracks = timeSlots
    .map((_, index) =>
      slotOutside[index] ? `${outsideRowHeight}px` : `${rowHeight}px`
    )
    .join(" ");

  const gridStyle = {
    gridTemplateColumns: `3.25rem repeat(${professionals.length}, ${colMin})`,
    gridTemplateRows: `auto ${rowTracks} auto`,
  } as React.CSSProperties;

  const visibleAppointments = appointments;

  return (
    <div
      className={cn(
        "agenda-grid-shell min-h-0 overflow-auto rounded-2xl border",
        gridLineOuter,
        className
      )}
    >
      <div className="grid min-w-max" style={gridStyle}>
        {/* Cabeçalho fixo no scroll vertical */}
        <div
          className={cn(
            "agenda-grid-header agenda-grid-pro-header sticky top-0 left-0 z-50 border-b",
            gridLineHour
          )}
          style={{ gridRow: 1, gridColumn: 1 }}
        />
        {professionals.map((pro, i) => (
          <div
            key={pro.id}
            className={cn(
              "agenda-grid-header agenda-grid-pro-header sticky top-0 z-50 flex flex-col items-center gap-2 border-b border-l px-2 py-2.5",
              gridLineHour,
              gridLineColumn
            )}
            style={{ gridRow: 1, gridColumn: i + 2 }}
          >
            <ProfessionalAvatar
              photoUrl={pro.photoUrl}
              photoPosition={pro.photoPosition}
              name={pro.nickname}
              size="md"
            />
            <span className="line-clamp-2 text-center text-sm font-medium">
              {pro.nickname}
            </span>
          </div>
        ))}

        {timeSlots.map((minute, index) => {
          const row = index + 2;
          const isLast = index === timeSlots.length - 1;
          const outside = slotOutside[index];

          return (
            <TimeSlotCells
              key={minute}
              minute={minute}
              row={row}
              isLast={isLast}
              outside={outside}
              gridEnd={gridEnd}
              slotStepMinutes={slotStepMinutes}
              professionals={professionals}
              appointmentsByPro={appointmentsByPro}
              isOwner={isOwner}
              canBookClients={canBookClients}
              onSlotClick={onSlotClick}
            />
          );
        })}

        <div
          className="agenda-grid-header sticky left-0 z-30"
          style={{ gridRow: footerRow, gridColumn: 1 }}
        />
        {professionals.map((pro, i) => (
          <div
            key={`foot-${pro.id}`}
            className={cn(
              "agenda-grid-header flex flex-col items-center gap-1.5 border-l px-2 py-2",
              gridLineColumn
            )}
            style={{ gridRow: footerRow, gridColumn: i + 2 }}
          >
            <ProfessionalAvatar
              photoUrl={pro.photoUrl}
              photoPosition={pro.photoPosition}
              name={pro.nickname}
              size="sm"
            />
            <span className="line-clamp-1 text-center text-xs text-[var(--agenda-muted,#8b8d93)]">
              {pro.nickname}
            </span>
          </div>
        ))}

        {visibleAppointments.map((apt) => {
          const col = proColumnIndex.get(apt.professionalId);
          if (!col) return null;

          const rows = appointmentGridRows(
            apt.startTime,
            apt.endTime,
            gridStart,
            gridEnd,
            slotStepMinutes
          );
          if (!rows) return null;

          const layout = overlapLayoutsByPro.get(apt.professionalId)?.get(
            apt.id
          );

          return (
            <AppointmentGridBlock
              key={apt.id}
              appointment={apt}
              rowSpan={rows.rowSpan}
              gridColumn={col}
              gridRow={`${rows.rowStart} / ${rows.rowEnd}`}
              columnIndex={layout?.columnIndex}
              columnCount={layout?.columnCount}
              onClick={() => onAppointmentClick(apt)}
            />
          );
        })}
      </div>
    </div>
  );
}

type TimeSlotCellsProps = {
  minute: number;
  row: number;
  isLast: boolean;
  outside: boolean;
  gridEnd: number;
  slotStepMinutes: number;
  professionals: AgendaProfessionalColumn[];
  appointmentsByPro: Map<string, AppointmentItem[]>;
  isOwner: boolean;
  canBookClients: boolean;
  onSlotClick: (professionalId: string, startTime: string) => void;
};

function TimeSlotCells({
  minute,
  row,
  isLast,
  outside,
  gridEnd,
  slotStepMinutes,
  professionals,
  appointmentsByPro,
  isOwner,
  canBookClients,
  onSlotClick,
}: TimeSlotCellsProps) {
  return (
    <>
      <div
        className={cn(
          "agenda-grid-header relative sticky left-0 z-20 overflow-visible",
          slotLineClass(minute),
          isLast && `border-b border-solid ${gridLineHour}`,
          outside && "opacity-70"
        )}
        style={{ gridRow: row, gridColumn: 1 }}
      >
        {shouldShowTimeLabel(minute, slotStepMinutes) && !outside && (
          <span className="absolute -top-px right-1.5 -translate-y-1/2 bg-[var(--agenda-bg,#0e0f11)] px-0.5 text-[10px] leading-none tabular-nums text-[var(--agenda-muted,#8b8d93)] sm:right-2 sm:text-[11px]">
            {timeLabel(minute)}
          </span>
        )}
        {shouldShowTimeLabel(minute, slotStepMinutes) && outside && (
          <span className="absolute -top-px right-1.5 -translate-y-1/2 px-0.5 text-[9px] leading-none tabular-nums text-[var(--agenda-muted,#8b8d93)]/70 sm:right-2">
            {timeLabel(minute)}
          </span>
        )}
        {isLast && (
          <span className="absolute -bottom-px right-1.5 translate-y-1/2 bg-[var(--agenda-bg,#0e0f11)] px-0.5 text-[10px] leading-none tabular-nums text-[var(--agenda-muted,#8b8d93)] sm:right-2 sm:text-[11px]">
            {timeLabel(gridEnd)}
          </span>
        )}
      </div>

      {professionals.map((pro, i) => {
        const proAppointments = appointmentsByPro.get(pro.id) ?? [];
        const busy = proAppointments
          .filter((a) => !a.isSqueezeIn)
          .map((a) => ({
            start: timeToMinutes(a.startTime),
            end: timeToMinutes(a.endTime),
          }));
        const slotEnd = minute + slotStepMinutes;
        const blocked = minuteRangeOverlaps(
          minute,
          slotEnd,
          pro.blockRanges
        );
        const occupied = busy.some(
          (b) => minute >= b.start && minute < b.end
        );
        const available = isOwner
          ? !occupied
          : isSlotStartAvailable(
              minute,
              slotStepMinutes,
              pro.availableRanges,
              busy
            ) && !blocked;
        const inSchedule = isSlotStartAvailable(
          minute,
          slotStepMinutes,
          pro.availableRanges,
          []
        );

        return (
          <div
            key={`${pro.id}-${minute}`}
            className={cn(
              `relative border-l ${gridLineColumn}`,
              slotLineClass(minute),
              isLast && `border-b border-solid ${gridLineHour}`,
              agendaCellClass({ inSchedule, occupied, blocked })
            )}
            style={{ gridRow: row, gridColumn: i + 2 }}
          >
            {available && canBookClients && (
              <button
                type="button"
                className={cn(
                  "absolute inset-0 z-10 cursor-pointer",
                  agendaCellHoverFree
                )}
                onClick={() => onSlotClick(pro.id, timeLabel(minute))}
                aria-label={`Agendar às ${timeLabel(minute)} com ${pro.nickname}`}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
