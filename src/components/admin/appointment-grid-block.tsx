"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatPriceBRL,
  formatTime,
} from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppointmentItem } from "@/components/admin/appointment-item";
import type { BookingSource } from "@/lib/booking-source";
import {
  BOOKING_SOURCE_ICONS,
  BOOKING_SOURCE_LABELS,
} from "@/lib/booking-source";
import {
  agendaAppointmentClass,
  agendaStatusBarColor,
  agendaStatusBarKey,
} from "@/lib/agenda-colors";
import { STATUS_LABELS } from "@/lib/appointment-status";
import { AppointmentStatusMenu } from "@/components/admin/appointment-status-menu";

type AppointmentGridBlockProps = {
  appointment: AppointmentItem;
  rowSpan: number;
  onClick: () => void;
  gridColumn: number;
  gridRow: string;
  columnIndex?: number;
  columnCount?: number;
  /** Informa o horário sob o mouse enquanto passa pelo bloco. */
  onHoverTime?: (clientY: number, top: number, height: number) => void;
};

function BookingSourceBadge({ source }: { source: BookingSource }) {
  const Icon = BOOKING_SOURCE_ICONS[source];
  const label = BOOKING_SOURCE_LABELS[source];

  return (
    <span
      className="pointer-events-none absolute top-0.5 right-0.5 z-10 inline-flex size-3 shrink-0 items-center justify-center rounded-sm bg-black/15 text-current opacity-80"
      aria-label={`Agendado: ${label}`}
      title={`Agendado: ${label}`}
    >
      <Icon className="size-2" strokeWidth={2.25} />
    </span>
  );
}

function AppointmentTooltipContent({
  appointment: apt,
}: {
  appointment: AppointmentItem;
}) {
  const name = `${apt.customerFirstName} ${apt.customerLastName}`;
  const services = apt.services.map((s) => s.name);
  const totalMinutes = apt.services.reduce((s, svc) => s + svc.durationMinutes, 0);
  const totalPrice = apt.services.reduce((s, svc) => s + svc.priceCents, 0);
  const timeRange = `${formatTime(apt.startTime)} – ${formatTime(apt.endTime)}`;

  return (
    <div className="flex flex-col gap-1.5 text-left">
      <p className="font-medium leading-snug text-[#f5f5f5]">{name}</p>

      {services.length > 0 && (
        <p className="leading-snug text-[#c8c9cc]">{services.join(" · ")}</p>
      )}

      <p className="tabular-nums text-[#e8e8ea]">{timeRange}</p>

      <p className="text-[var(--agenda-muted,#8b8d93)]">
        {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
      </p>

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <span className="rounded-md bg-[rgb(236_241_94_/_16%)] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--agenda-accent,#ecf15e)] uppercase">
          {STATUS_LABELS[apt.status]}
        </span>
        {apt.isComandaExtra && apt.status !== "cancelled" && (
          <span className="rounded-md border border-dashed border-white/25 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#e8e8ea] uppercase">
            Serviço extra
          </span>
        )}
        {apt.isSqueezeIn &&
          !apt.isComandaExtra &&
          apt.status !== "cancelled" && (
            <span className="rounded-md border border-dashed border-white/25 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#e8e8ea] uppercase">
              Encaixe
            </span>
          )}
        {apt.bookingSource && (
          <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#c8c9cc] uppercase">
            {BOOKING_SOURCE_LABELS[apt.bookingSource]}
          </span>
        )}
      </div>
    </div>
  );
}

export function AppointmentGridBlock({
  appointment: apt,
  rowSpan,
  onClick,
  gridColumn,
  gridRow,
  columnIndex = 0,
  columnCount = 1,
  onHoverTime,
}: AppointmentGridBlockProps) {
  const isMobile = useIsMobile();
  const [statusMenu, setStatusMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const name = `${apt.customerFirstName} ${apt.customerLastName}`;
  const startTime = formatTime(apt.startTime);
  const endTime = formatTime(apt.endTime);
  const sideBySide = columnCount > 1;
  const tight = rowSpan <= 1 || (sideBySide && rowSpan <= 2);
  const barColor = agendaStatusBarColor[agendaStatusBarKey(apt)];

  const blockButton = (
    <button
      type="button"
      className={cn(
        "agenda-apt-card relative z-20 my-0.5 flex min-h-0 self-stretch overflow-hidden rounded-sm text-left",
        sideBySide ? "mx-0.5" : "mx-1",
        tight ? "py-0 pr-0.5 pl-3" : "py-0.5 pr-1 pl-3.5 sm:pr-1.5",
        agendaAppointmentClass(apt)
      )}
      style={{
        gridColumn,
        gridRow,
        zIndex: 20 + columnIndex,
        ["--apt-bar" as string]: barColor,
        ...(sideBySide
          ? {
              width: `calc(${100 / columnCount}% - 6px)`,
              marginLeft: `calc(${(columnIndex / columnCount) * 100}% + 3px)`,
            }
          : {}),
      }}
      onClick={onClick}
      onMouseMove={
        onHoverTime
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onHoverTime(event.clientY, rect.top, rect.height);
            }
          : undefined
      }
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setStatusMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {apt.bookingSource ? (
        <BookingSourceBadge source={apt.bookingSource} />
      ) : null}
      <div className="relative z-[2] flex min-h-0 w-full flex-col justify-center gap-px">
        <p
          className={cn(
            "truncate font-medium leading-none",
            apt.bookingSource && "pr-3.5",
            tight ? "text-[10px]" : "text-[11px] sm:text-xs"
          )}
        >
          {name}
        </p>
        <p
          className={cn(
            "truncate leading-none tabular-nums opacity-85",
            tight ? "text-[9px]" : "text-[10px]"
          )}
        >
          {startTime} – {endTime}
        </p>
      </div>
    </button>
  );

  return (
    <>
      {isMobile ? (
        blockButton
      ) : (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>{blockButton}</TooltipTrigger>

          <TooltipContent
            side="right"
            align="start"
            sideOffset={6}
            className="agenda-apt-tooltip max-w-[240px] items-start p-3 text-xs"
          >
            <AppointmentTooltipContent appointment={apt} />
          </TooltipContent>
        </Tooltip>
      )}

      <AppointmentStatusMenu
        appointmentId={apt.id}
        currentStatus={apt.status}
        open={statusMenu !== null}
        position={statusMenu ?? { x: 0, y: 0 }}
        onClose={() => setStatusMenu(null)}
      />
    </>
  );
}
