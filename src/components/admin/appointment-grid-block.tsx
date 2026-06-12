"use client";

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
import type { AppointmentItem } from "@/components/admin/appointment-item";
import { agendaAppointmentClass } from "@/lib/agenda-colors";

type AppointmentGridBlockProps = {
  appointment: AppointmentItem;
  rowSpan: number;
  onClick: () => void;
  gridColumn: number;
  gridRow: string;
  columnIndex?: number;
  columnCount?: number;
};

const STATUS_LABEL: Record<AppointmentItem["status"], string> = {
  confirmed: "Confirmado",
  done: "Atendido",
  cancelled: "Cancelado",
};

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
          {STATUS_LABEL[apt.status]}
        </span>
        {apt.isSqueezeIn && apt.status === "confirmed" && (
          <span className="rounded-sm border border-dashed border-background/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            Encaixe
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
  const name = `${apt.customerFirstName} ${apt.customerLastName}`;
  const startTime = formatTime(apt.startTime);
  const endTime = formatTime(apt.endTime);
  const sideBySide = columnCount > 1;
  const tight = rowSpan <= 1 || (sideBySide && rowSpan <= 2);

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "z-20 flex min-h-0 self-stretch overflow-hidden rounded-sm text-left shadow-sm transition-[opacity,box-shadow,z-index] hover:z-50 hover:opacity-100 hover:shadow-md focus-visible:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            sideBySide ? "mx-px" : "mx-0.5",
            tight ? "px-0.5 py-0" : "px-1 py-0.5 sm:px-1.5",
            agendaAppointmentClass(apt)
          )}
          style={{
            gridColumn,
            gridRow,
            zIndex: 20 + columnIndex,
            ...(sideBySide
              ? {
                  width: `calc(${100 / columnCount}% - 2px)`,
                  marginLeft: `calc(${(columnIndex / columnCount) * 100}% + 1px)`,
                }
              : {}),
          }}
          onClick={onClick}
        >
          <div className="flex min-h-0 w-full flex-col justify-center gap-px">
            <p
              className={cn(
                "truncate font-medium leading-none",
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
      </TooltipTrigger>

      <TooltipContent
        side="right"
        align="start"
        sideOffset={6}
        className="max-w-[240px] items-start p-3 text-xs"
      >
        <AppointmentTooltipContent appointment={apt} />
      </TooltipContent>
    </Tooltip>
  );
}
