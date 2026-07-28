"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  buildTimeSlots,
  computeOverlapLayouts,
  expandAppointmentsToServiceCards,
  appointmentGridRows,
  packServiceCardsToGridRows,
  isSlotStartAvailable,
  rowHeightForStep,
  shouldShowTimeLabel,
  timeLabel,
} from "@/lib/agenda-grid-utils";
import {
  canDragAppointment,
  validateAgendaMove,
  type AgendaColumnBounds,
} from "@/lib/agenda-drag";
import {
  useAgendaCardDrag,
  type AgendaDragCard,
} from "@/components/admin/use-agenda-card-drag";
import {
  minuteRangeOverlaps,
  minutesToTime,
  nowMinutesInTimezone,
  timeToMinutes,
} from "@/lib/availability";
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
  date: string;
  today: string;
  gridStart: number;
  gridEnd: number;
  slotStepMinutes: number;
  professionals: AgendaProfessionalColumn[];
  appointments: AppointmentItem[];
  isOwner: boolean;
  canBookClients: boolean;
  canEditAppointments: boolean;
  sessionProfessionalId: string | null;
  onSlotClick: (professionalId: string, startTime: string) => void;
  onAppointmentClick: (appointment: AppointmentItem, serviceIndex?: number) => void;
  /** Arraste do card: novo barbeiro e/ou novo horário. */
  onAppointmentMove: (
    appointment: AppointmentItem,
    professionalId: string,
    startTime: string
  ) => void;
  /** Colunas mais largas e linhas mais altas (uso no celular). */
  mobileLayout?: boolean;
  className?: string;
};

const gridLineHour = "agenda-grid-line-hour";
const gridLineSlot = "agenda-grid-line-slot";
const gridLineColumn = "agenda-grid-line-col";
const gridLineOuter = "border-white/15";

function slotLineClass(minute: number): string {
  return minute % 60 === 0
    ? `border-t border-solid ${gridLineHour}`
    : `border-t border-dashed ${gridLineSlot}`;
}

export function AgendaGrid({
  date,
  today,
  gridStart,
  gridEnd,
  slotStepMinutes,
  professionals,
  appointments,
  isOwner,
  canBookClients,
  canEditAppointments,
  sessionProfessionalId,
  onSlotClick,
  onAppointmentClick,
  onAppointmentMove,
  mobileLayout = false,
  className,
}: AgendaGridProps) {
  const [hoverMinute, setHoverMinute] = useState<number | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const rowHeight = mobileLayout
    ? Math.max(14, Math.round(rowHeightForStep(slotStepMinutes) * 1.4))
    : rowHeightForStep(slotStepMinutes);

  const timeSlots = useMemo(
    () => buildTimeSlots(gridStart, gridEnd, slotStepMinutes),
    [gridStart, gridEnd, slotStepMinutes]
  );

  useEffect(() => {
    if (date !== today) return;

    function tick() {
      setNowMinutes(nowMinutesInTimezone());
    }

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [date, today]);

  const displayNowMinutes = date === today ? nowMinutes : null;

  const nowLine = useMemo(() => {
    if (displayNowMinutes == null) return null;
    if (displayNowMinutes < gridStart || displayNowMinutes >= gridEnd) return null;
    const fromStart = displayNowMinutes - gridStart;
    const slotIndex = Math.floor(fromStart / slotStepMinutes);
    const offset =
      ((fromStart % slotStepMinutes) / slotStepMinutes) * rowHeight;
    return {
      row: slotIndex + 2,
      offset,
      label: timeLabel(displayNowMinutes),
    };
  }, [displayNowMinutes, gridStart, gridEnd, slotStepMinutes, rowHeight]);

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
      const cards = expandAppointmentsToServiceCards(
        appointments.filter(
          (apt) =>
            apt.professionalId === pro.id && sharesAgendaColumnLayout(apt)
        )
      );
      map.set(pro.id, computeOverlapLayouts(cards));
    }
    return map;
  }, [appointments, professionals]);

  const serviceCards = useMemo(
    () => expandAppointmentsToServiceCards(appointments),
    [appointments]
  );

  const serviceCardRows = useMemo(
    () =>
      packServiceCardsToGridRows(
        serviceCards,
        gridStart,
        gridEnd,
        slotStepMinutes
      ),
    [serviceCards, gridStart, gridEnd, slotStepMinutes]
  );

  const proColumnIndex = useMemo(() => {
    const map = new Map<string, number>();
    professionals.forEach((p, i) => map.set(p.id, i + 2));
    return map;
  }, [professionals]);

  const appointmentById = useMemo(() => {
    const map = new Map<string, AppointmentItem>();
    for (const apt of appointments) map.set(apt.id, apt);
    return map;
  }, [appointments]);

  const professionalById = useMemo(() => {
    const map = new Map<string, AgendaProfessionalColumn>();
    for (const pro of professionals) map.set(pro.id, pro);
    return map;
  }, [professionals]);

  const measureColumns = useCallback((): AgendaColumnBounds[] => {
    const root = shellRef.current;
    if (!root) return [];

    const offsetX = window.scrollX;
    const bounds: AgendaColumnBounds[] = [];

    for (const pro of professionals) {
      const cell = root.querySelector<HTMLElement>(
        `[data-agenda-column="${pro.id}"]`
      );
      if (!cell) continue;
      const rect = cell.getBoundingClientRect();
      bounds.push({
        professionalId: pro.id,
        left: rect.left + offsetX,
        right: rect.right + offsetX,
      });
    }

    return bounds;
  }, [professionals]);

  const evaluateDrop = useCallback(
    (card: AgendaDragCard, professionalId: string, startMinutes: number) => {
      const apt = appointmentById.get(card.appointmentId);
      const target = professionalById.get(professionalId);
      if (!apt || !target) {
        return { valid: false, error: "Coluna inválida." };
      }

      const result = validateAgendaMove({
        appointmentId: apt.id,
        isSqueezeIn: Boolean(apt.isSqueezeIn),
        serviceIds: apt.services.map((service) => service.id),
        durationMinutes: card.durationMinutes,
        targetStartMinutes: startMinutes,
        target: {
          professionalId: target.id,
          nickname: target.nickname,
          serviceIds: target.serviceIds,
          availableRanges: target.availableRanges,
          blockRanges: target.blockRanges,
        },
        busy: (appointmentsByPro.get(professionalId) ?? []).map((other) => ({
          appointmentId: other.id,
          start: timeToMinutes(other.startTime),
          end: timeToMinutes(other.endTime),
        })),
        isOwner,
        sessionProfessionalId,
      });

      return result.ok
        ? { valid: true, error: null }
        : { valid: false, error: result.error };
    },
    [
      appointmentById,
      appointmentsByPro,
      isOwner,
      professionalById,
      sessionProfessionalId,
    ]
  );

  const drag = useAgendaCardDrag({
    enabled: canEditAppointments,
    rowHeight,
    slotStepMinutes,
    gridStart,
    gridEnd,
    measureColumns,
    evaluate: evaluateDrop,
    onDrop: (card, professionalId, startMinutes) => {
      const apt = appointmentById.get(card.appointmentId);
      if (!apt) return;
      onAppointmentMove(apt, professionalId, minutesToTime(startMinutes));
    },
    onRejected: (error) => toast.error(error),
  });

  if (professionals.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        Cadastre profissionais ativos para ver a grade.
      </div>
    );
  }

  const footerRow = timeSlots.length + 2;
  const compactProHeader = mobileLayout && professionals.length === 1;

  const dropPreview = (() => {
    const target = drag.target;
    if (!target) return null;

    const column = proColumnIndex.get(target.professionalId);
    if (!column) return null;

    const startTime = minutesToTime(target.startMinutes);
    const endTime = minutesToTime(
      target.startMinutes + target.card.durationMinutes
    );
    const rows = appointmentGridRows(
      startTime,
      endTime,
      gridStart,
      gridEnd,
      slotStepMinutes
    );
    if (!rows) return null;

    return {
      column,
      rows,
      startTime,
      endTime,
      valid: target.valid,
      error: target.error,
      movedColumn: target.professionalId !== target.card.professionalId,
      nickname: professionalById.get(target.professionalId)?.nickname ?? "",
    };
  })();

  // Colunas encolhem pra caber na largura — sem scroll horizontal.
  const gridStyle = {
    gridTemplateColumns: compactProHeader
      ? `3rem minmax(0, 1fr)`
      : `3rem repeat(${professionals.length}, minmax(0, 1fr))`,
    gridTemplateRows: `auto repeat(${timeSlots.length}, ${rowHeight}px) auto`,
  } as React.CSSProperties;

  return (
    <div
      ref={shellRef}
      className={cn(
        "agenda-grid-shell min-w-0 overflow-hidden rounded-2xl border",
        drag.target && "agenda-grid-dragging",
        gridLineOuter,
        className
      )}
      onMouseLeave={() => setHoverMinute(null)}
    >
      <div className="relative grid w-full min-w-0" style={gridStyle}>
        <div
          className={cn(
            "agenda-grid-header border-b",
            !compactProHeader && "sticky top-0 z-30",
            gridLineHour
          )}
          style={{ gridRow: 1, gridColumn: 1 }}
        />
        {professionals.map((pro, i) => (
          <div
            key={pro.id}
            data-agenda-column={pro.id}
            className={cn(
              "agenda-grid-header agenda-grid-pro-header min-w-0 border-b border-l",
              !compactProHeader && "sticky top-0 z-30",
              gridLineHour,
              gridLineColumn,
              compactProHeader
                ? "flex flex-row items-center gap-2.5 px-3 py-2"
                : "flex flex-col items-center gap-1.5 px-1 py-2 sm:gap-2 sm:px-2 sm:py-2.5"
            )}
            style={{ gridRow: 1, gridColumn: i + 2 }}
          >
            <ProfessionalAvatar
              photoUrl={pro.photoUrl}
              photoPosition={pro.photoPosition}
              name={pro.nickname}
              size={
                compactProHeader
                  ? "sm"
                  : professionals.length >= 5
                    ? "sm"
                    : "md"
              }
            />
            <span
              className={cn(
                "min-w-0 font-medium",
                compactProHeader
                  ? "truncate text-sm"
                  : "line-clamp-2 w-full text-center text-xs sm:text-sm"
              )}
            >
              {pro.nickname}
            </span>
          </div>
        ))}

        {timeSlots.map((minute, index) => {
          const row = index + 2;
          const isLast = index === timeSlots.length - 1;

          return (
            <TimeSlotCells
              key={minute}
              minute={minute}
              row={row}
              isLast={isLast}
              isHovered={hoverMinute === minute}
              stickyTimeColumn={false}
              slotStepMinutes={slotStepMinutes}
              professionals={professionals}
              appointmentsByPro={appointmentsByPro}
              isOwner={isOwner}
              canBookClients={canBookClients}
              onSlotClick={onSlotClick}
              onHoverMinute={setHoverMinute}
            />
          );
        })}

        {nowLine ? (
          <div
            className="pointer-events-none z-40"
            style={{
              gridColumn: `1 / -1`,
              gridRow: nowLine.row,
              marginTop: nowLine.offset,
              height: 0,
            }}
            aria-hidden
          >
            <div className="relative flex items-center">
              <span className="absolute left-0 z-10 -translate-y-1/2 rounded-full bg-[var(--agenda-accent,#ecf15e)] px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--agenda-accent-fg,#0e0f11)] shadow-sm">
                {nowLine.label}
              </span>
              <div className="ml-10 h-px w-full bg-[var(--agenda-accent,#ecf15e)] shadow-[0_0_8px_rgb(236_241_94_/_45%)]" />
            </div>
          </div>
        ) : null}

        <div
          className="agenda-grid-header relative"
          style={{ gridRow: footerRow, gridColumn: 1 }}
        >
          <span className="absolute top-1.5 right-1.5 text-[10px] leading-none tabular-nums text-[var(--agenda-muted,#8b8d93)] sm:right-2 sm:text-[11px]">
            {timeLabel(gridEnd)}
          </span>
        </div>
        {!compactProHeader &&
          professionals.map((pro, i) => (
            <div
              key={`foot-${pro.id}`}
              className={cn(
                "agenda-grid-header flex min-w-0 flex-col items-center gap-1.5 border-l px-1 py-2 sm:px-2",
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
              <span className="line-clamp-1 w-full min-w-0 text-center text-xs text-[var(--agenda-muted,#8b8d93)]">
                {pro.nickname}
              </span>
            </div>
          ))}
        {compactProHeader ? (
          <div
            className={cn("agenda-grid-header border-l", gridLineColumn)}
            style={{ gridRow: footerRow, gridColumn: 2 }}
          />
        ) : null}

        {serviceCards.map((card) => {
          const apt = card.appointment;
          const col = proColumnIndex.get(apt.professionalId);
          if (!col) return null;

          const rows =
            serviceCardRows.get(card.id) ??
            appointmentGridRows(
              card.startTime,
              card.endTime,
              gridStart,
              gridEnd,
              slotStepMinutes
            );
          if (!rows) return null;

          const layout = overlapLayoutsByPro.get(apt.professionalId)?.get(
            card.id
          );
          const cardStart = timeToMinutes(card.startTime);
          const cardEnd = timeToMinutes(card.endTime);
          const draggable = canDragAppointment(apt, {
            canEditAppointments,
            isOwner,
            sessionProfessionalId,
          });

          return (
            <AppointmentGridBlock
              key={card.id}
              appointment={apt}
              rowSpan={rows.rowSpan}
              gridColumn={col}
              gridRow={`${rows.rowStart} / ${rows.rowEnd}`}
              columnIndex={layout?.columnIndex}
              columnCount={layout?.columnCount}
              focusedServiceName={card.serviceName}
              showBookingSource
              segmentStartTime={card.startTime}
              segmentEndTime={card.endTime}
              serviceIndex={card.serviceIndex}
              serviceCount={card.serviceCount}
              draggable={draggable}
              isDragging={drag.target?.card.appointmentId === apt.id}
              onDragPointerDown={
                draggable
                  ? (event) =>
                      drag.startDrag(event, {
                        appointmentId: apt.id,
                        professionalId: apt.professionalId,
                        startMinutes: timeToMinutes(apt.startTime),
                        durationMinutes:
                          timeToMinutes(apt.endTime) -
                          timeToMinutes(apt.startTime),
                      })
                  : undefined
              }
              onClick={() => {
                if (drag.shouldIgnoreClick()) return;
                onAppointmentClick(apt);
              }}
              onHoverTime={(clientY, top, height) => {
                if (height <= 0) {
                  setHoverMinute(
                    Math.floor(cardStart / slotStepMinutes) * slotStepMinutes
                  );
                  return;
                }
                const ratio = Math.min(
                  1,
                  Math.max(0, (clientY - top) / height)
                );
                const raw = cardStart + ratio * (cardEnd - cardStart);
                const snapped =
                  Math.floor(raw / slotStepMinutes) * slotStepMinutes;
                const clamped = Math.min(
                  Math.max(snapped, gridStart),
                  gridEnd - slotStepMinutes
                );
                setHoverMinute(clamped);
              }}
            />
          );
        })}

        {dropPreview ? (
          <div
            className={cn(
              "agenda-drop-preview pointer-events-none my-0.5 mx-1 flex min-h-0 items-center justify-center overflow-hidden rounded-sm px-1 text-center",
              !dropPreview.valid && "agenda-drop-preview-invalid"
            )}
            style={{
              gridColumn: dropPreview.column,
              gridRow: `${dropPreview.rows.rowStart} / ${dropPreview.rows.rowEnd}`,
              zIndex: 60,
            }}
            title={dropPreview.error ?? undefined}
            aria-hidden
          >
            <span className="truncate text-[10px] font-semibold leading-tight tabular-nums">
              {dropPreview.startTime} – {dropPreview.endTime}
              {dropPreview.movedColumn && dropPreview.nickname
                ? ` · ${dropPreview.nickname}`
                : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TimeSlotCellsProps = {
  minute: number;
  row: number;
  isLast: boolean;
  isHovered: boolean;
  stickyTimeColumn?: boolean;
  slotStepMinutes: number;
  professionals: AgendaProfessionalColumn[];
  appointmentsByPro: Map<string, AppointmentItem[]>;
  isOwner: boolean;
  canBookClients: boolean;
  onSlotClick: (professionalId: string, startTime: string) => void;
  onHoverMinute: (minute: number | null) => void;
};

function TimeSlotCells({
  minute,
  row,
  isLast,
  isHovered,
  stickyTimeColumn = true,
  slotStepMinutes,
  professionals,
  appointmentsByPro,
  isOwner,
  canBookClients,
  onSlotClick,
  onHoverMinute,
}: TimeSlotCellsProps) {
  return (
    <>
      <div
        className={cn(
          "agenda-grid-header relative",
          stickyTimeColumn && "sticky left-0 z-20",
          slotLineClass(minute),
          isLast && `border-b border-solid ${gridLineHour}`,
          isHovered && "bg-[rgb(236_241_94_/_10%)]"
        )}
        style={{ gridRow: row, gridColumn: 1 }}
        onMouseEnter={() => onHoverMinute(minute)}
      >
        {shouldShowTimeLabel(minute, slotStepMinutes) && (
          <span
            className={cn(
              "absolute top-0.5 right-1.5 text-[10px] leading-none tabular-nums sm:right-2 sm:text-[11px]",
              isHovered
                ? "font-semibold text-[var(--agenda-accent,#ecf15e)]"
                : "text-[var(--agenda-muted,#8b8d93)]"
            )}
          >
            {timeLabel(minute)}
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
              `relative min-w-0 border-l ${gridLineColumn}`,
              slotLineClass(minute),
              isLast && `border-b border-solid ${gridLineHour}`,
              agendaCellClass({ inSchedule, occupied, blocked })
            )}
            style={{ gridRow: row, gridColumn: i + 2 }}
            onMouseEnter={() => onHoverMinute(minute)}
            title={timeLabel(minute)}
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
