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
  onSlotClick: (professionalId: string, startTime: string) => void;
  onAppointmentClick: (appointment: AppointmentItem) => void;
};

const gridLineHour = "border-neutral-400 dark:border-neutral-500";
const gridLineSlot = "border-neutral-300 dark:border-neutral-600";
const gridLineColumn = "border-neutral-300 dark:border-neutral-600";
const gridLineOuter = "border-neutral-400 dark:border-neutral-500";

function slotLineClass(minute: number): string {
  return minute % 60 === 0
    ? `border-t border-solid ${gridLineHour}`
    : `border-t border-dashed ${gridLineSlot}`;
}

export function AgendaGrid({
  gridStart,
  gridEnd,
  slotStepMinutes,
  professionals,
  appointments,
  isOwner,
  onSlotClick,
  onAppointmentClick,
}: AgendaGridProps) {
  const rowHeight = rowHeightForStep(slotStepMinutes);

  const timeSlots = useMemo(
    () => buildTimeSlots(gridStart, gridEnd, slotStepMinutes),
    [gridStart, gridEnd, slotStepMinutes]
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

  const gridStyle = {
    gridTemplateColumns: `3.25rem repeat(${professionals.length}, minmax(7.5rem, 1fr))`,
    gridTemplateRows: `auto repeat(${timeSlots.length}, ${rowHeight}px) auto`,
  } as React.CSSProperties;

  const visibleAppointments = appointments;

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border bg-white dark:bg-neutral-950",
        gridLineOuter
      )}
    >
      <div className="grid min-w-max" style={gridStyle}>
        {/* Cabeçalho — posição explícita pra não quebrar com agendamentos */}
        <div
          className={cn(
            "sticky top-0 left-0 z-40 border-b bg-neutral-100 dark:bg-neutral-900",
            gridLineHour
          )}
          style={{ gridRow: 1, gridColumn: 1 }}
        />
        {professionals.map((pro, i) => (
          <div
            key={pro.id}
            className={cn(
              "sticky top-0 z-40 flex flex-col items-center gap-2 border-b border-l bg-neutral-100 px-2 py-2.5 dark:bg-neutral-900",
              gridLineHour,
              gridLineColumn
            )}
            style={{ gridRow: 1, gridColumn: i + 2 }}
          >
            <ProfessionalAvatar
              photoUrl={pro.photoUrl}
              name={pro.nickname}
              size="md"
            />
            <span className="line-clamp-2 text-center text-sm font-medium">
              {pro.nickname}
            </span>
          </div>
        ))}

        {/* Células da grade — cada uma com linha/coluna fixas */}
        {timeSlots.map((minute, index) => {
          const row = index + 2;
          const isLast = index === timeSlots.length - 1;

          return (
            <TimeSlotCells
              key={minute}
              minute={minute}
              row={row}
              isLast={isLast}
              gridEnd={gridEnd}
              slotStepMinutes={slotStepMinutes}
              professionals={professionals}
              appointmentsByPro={appointmentsByPro}
              isOwner={isOwner}
              onSlotClick={onSlotClick}
            />
          );
        })}

        {/* Rodapé */}
        <div
          className="sticky left-0 z-30 bg-muted/30"
          style={{ gridRow: footerRow, gridColumn: 1 }}
        />
        {professionals.map((pro, i) => (
          <div
            key={`foot-${pro.id}`}
            className={cn(
              "flex flex-col items-center gap-1.5 border-l bg-muted/30 px-2 py-2",
              gridLineColumn
            )}
            style={{ gridRow: footerRow, gridColumn: i + 2 }}
          >
            <ProfessionalAvatar
              photoUrl={pro.photoUrl}
              name={pro.nickname}
              size="sm"
            />
            <span className="line-clamp-1 text-center text-xs text-muted-foreground">
              {pro.nickname}
            </span>
          </div>
        ))}

        {/* Agendamentos por cima — depois da estrutura, com posição explícita */}
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
  gridEnd: number;
  slotStepMinutes: number;
  professionals: AgendaProfessionalColumn[];
  appointmentsByPro: Map<string, AppointmentItem[]>;
  isOwner: boolean;
  onSlotClick: (professionalId: string, startTime: string) => void;
};

function TimeSlotCells({
  minute,
  row,
  isLast,
  gridEnd,
  slotStepMinutes,
  professionals,
  appointmentsByPro,
  isOwner,
  onSlotClick,
}: TimeSlotCellsProps) {
  return (
    <>
      <div
        className={cn(
          "relative sticky left-0 z-20 overflow-visible bg-white dark:bg-neutral-950",
          slotLineClass(minute),
          isLast && `border-b border-solid ${gridLineHour}`
        )}
        style={{ gridRow: row, gridColumn: 1 }}
      >
        {shouldShowTimeLabel(minute, slotStepMinutes) && (
          <span className="absolute -top-px right-1.5 -translate-y-1/2 bg-background px-0.5 text-[10px] leading-none tabular-nums text-muted-foreground sm:right-2 sm:text-[11px]">
            {timeLabel(minute)}
          </span>
        )}
        {isLast && (
          <span className="absolute -bottom-px right-1.5 translate-y-1/2 bg-background px-0.5 text-[10px] leading-none tabular-nums text-muted-foreground sm:right-2 sm:text-[11px]">
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
            {available && (
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
