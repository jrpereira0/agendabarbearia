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
import { agendaAppointmentClass } from "@/lib/agenda-colors";
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
};

function BookingSourceBadge({ source }: { source: BookingSource }) {
  const Icon = BOOKING_SOURCE_ICONS[source];
  const label = BOOKING_SOURCE_LABELS[source];

  return (
    <span
      className="pointer-events-none absolute right-0.5 top-0.5 z-10 inline-flex size-3 shrink-0 items-center justify-center rounded-sm bg-background/20 text-current opacity-80"
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
      <p className="font-medium leading-snug">{name}</p>

      {services.length > 0 && (
        <p className="leading-snug opacity-90">
          {services.join(" · ")}
        </p>
      )}

      <p className="tabular-nums opacity-90">{timeRange}</p>

      <p className="opacity-75">
        {formatDuration(totalMinutes)} · {formatPriceBRL(totalPrice)}
      </p>

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <span className="rounded-sm bg-background/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          {STATUS_LABELS[apt.status]}
        </span>
        {apt.isComandaExtra &&
          apt.status !== "cancelled" && (
          <span className="rounded-sm border border-dashed border-background/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Serviço extra
          </span>
        )}
        {apt.isSqueezeIn &&
          !apt.isComandaExtra &&
          apt.status !== "cancelled" && (
          <span className="rounded-sm border border-dashed border-background/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Encaixe
          </span>
        )}
        {apt.bookingSource && (
          <span className="rounded-sm bg-background/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
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

  const blockButton = (
    <button
      type="button"
      className={cn(
        "relative z-20 my-0.5 flex min-h-0 self-stretch overflow-hidden rounded-sm text-left shadow-sm transition-[opacity,box-shadow,z-index] hover:z-50 hover:opacity-100 hover:shadow-md focus-visible:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sideBySide ? "mx-0.5" : "mx-1",
        tight ? "px-0.5 py-0" : "px-1 py-0.5 sm:px-1.5",
        agendaAppointmentClass(apt)
      )}
      style={{
        gridColumn,
        gridRow,
        zIndex: 20 + columnIndex,
        ...(sideBySide
          ? {
              width: `calc(${100 / columnCount}% - 6px)`,
              marginLeft: `calc(${(columnIndex / columnCount) * 100}% + 3px)`,
            }
          : {}),
      }}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setStatusMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {apt.bookingSource ? (
        <BookingSourceBadge source={apt.bookingSource} />
      ) : null}
      <div className="flex min-h-0 w-full flex-col justify-center gap-px">
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
            className="max-w-[240px] items-start p-3 text-xs"
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
