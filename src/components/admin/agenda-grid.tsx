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
import type { AppointmentItem } from "@/components/admin/appointment-card";
import {
  agendaCellClass,
  agendaCellHoverFree,
} from "@/lib/agenda-colors";
import type { AgendaProfessionalColumn } from "@/lib/get-agenda-day";

type AgendaGridProps = {
  gridStart: number;
  gridEnd: number;
  slotStepMinutes: number;
  professionals: AgendaProfessionalColumn[];
  appointments: AppointmentItem[];
  onSlotClick: (professionalId: string, startTime: string) => void;
  onAppointmentClick: (appointment: AppointmentItem) => void;
};

function slotLineClass(minute: number): string {
  return minute % 60 === 0
    ? "border-t border-solid border-border"
    : "border-t border-dashed border-border/45";
}

export function AgendaGrid({
  gridStart,
  gridEnd,
  slotStepMinutes,
  professionals,
  appointments,
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
      if (apt.status === "cancelled") continue;
      map.get(apt.professionalId)?.push(apt);
    }
    return map;
  }, [appointments, professionals]);

  const overlapLayoutsByPro = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeOverlapLayouts>>();
    for (const [proId, apts] of appointmentsByPro) {
      map.set(proId, computeOverlapLayouts(apts));
    }
    return map;
  }, [appointmentsByPro]);

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

  const visibleAppointments = appointments.filter(
    (a) => a.status !== "cancelled"
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
      <div className="grid min-w-max" style={gridStyle}>
        {/* Cabeçalho — posição explícita pra não quebrar com agendamentos */}
        <div
          className="sticky top-0 left-0 z-40 border-b border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
          style={{ gridRow: 1, gridColumn: 1 }}
        />
        {professionals.map((pro, i) => (
          <div
            key={pro.id}
            className="sticky top-0 z-40 flex flex-col items-center gap-2 border-b border-l border-neutral-200 bg-neutral-100 px-2 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
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
            className="flex flex-col items-center gap-1.5 border-l bg-muted/30 px-2 py-2"
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
  onSlotClick,
}: TimeSlotCellsProps) {
  return (
    <>
      <div
        className={cn(
          "relative sticky left-0 z-20 overflow-visible bg-white dark:bg-neutral-950",
          slotLineClass(minute),
          isLast && "border-b border-solid border-border"
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
        const available =
          isSlotStartAvailable(
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
        const occupied = busy.some(
          (b) => minute >= b.start && minute < b.end
        );

        return (
          <div
            key={`${pro.id}-${minute}`}
            className={cn(
              "relative border-l border-neutral-200 dark:border-neutral-700",
              slotLineClass(minute),
              isLast && "border-b border-solid border-neutral-300 dark:border-neutral-600",
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
