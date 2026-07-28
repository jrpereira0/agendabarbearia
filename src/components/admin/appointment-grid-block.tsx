"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
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
  /** Quando o agendamento vira vários cards, o nome deste serviço. */
  focusedServiceName?: string | null;
  showBookingSource?: boolean;
  segmentStartTime?: string;
  segmentEndTime?: string;
  serviceIndex?: number;
  serviceCount?: number;
  /** Informa o horário sob o mouse enquanto passa pelo bloco. */
  onHoverTime?: (clientY: number, top: number, height: number) => void;
};

function formatCustomerName(apt: AppointmentItem): string {
  return [apt.customerFirstName, apt.customerLastName]
    .filter((part) => part.trim())
    .join(" ");
}

function CustomerCreditIcon({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const label = `Crédito disponível: ${formatPriceBRL(cents)}`;

  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-[#0e0f11]/14 ring-1 ring-[#0e0f11]/10",
        className
      )}
      aria-label={label}
      title={label}
    >
      <Wallet className="size-2.5 text-[#3f4f08]" strokeWidth={2.25} />
    </span>
  );
}

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
  const name = formatCustomerName(apt);
  const totalMinutes = apt.services.reduce((s, svc) => s + svc.durationMinutes, 0);
  const totalPrice = apt.services.reduce((s, svc) => s + svc.priceCents, 0);
  const timeRange = `${formatTime(apt.startTime)} – ${formatTime(apt.endTime)}`;
  const creditCents = apt.customerCreditBalanceCents ?? 0;

  return (
    <div className="flex flex-col gap-1.5 text-left">
      <p className="font-medium leading-snug text-[#f5f5f5]">{name}</p>

      {creditCents > 0 ? (
        <p className="flex items-center gap-1.5 text-[var(--agenda-accent,#ecf15e)]">
          <Wallet className="size-3 shrink-0" strokeWidth={2} />
          <span className="tabular-nums">
            {formatPriceBRL(creditCents)} em crédito
          </span>
        </p>
      ) : null}

      {(() => {
        const counts = new Map<string, number>();
        for (const s of apt.services) {
          counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
        }
        const services = [...counts.entries()].map(([serviceName, qty]) =>
          qty > 1 ? `${serviceName} ×${qty}` : serviceName
        );
        if (services.length === 0) return null;
        return (
          <p className="leading-snug text-[#c8c9cc]">{services.join(" · ")}</p>
        );
      })()}

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
  focusedServiceName = null,
  showBookingSource = true,
  segmentStartTime,
  segmentEndTime,
  serviceIndex = 0,
  serviceCount = 1,
  onHoverTime,
}: AppointmentGridBlockProps) {
  const isMobile = useIsMobile();
  const [statusMenu, setStatusMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const name = formatCustomerName(apt);
  const startTime = formatTime(segmentStartTime ?? apt.startTime);
  const endTime = formatTime(segmentEndTime ?? apt.endTime);
  const timeRange = `${startTime} – ${endTime}`;
  const sideBySide = columnCount > 1;
  const serviceLabel =
    focusedServiceName ??
    (() => {
      if (apt.services.length === 0) return null;
      const counts = new Map<string, number>();
      for (const s of apt.services) {
        counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
      }
      const parts = [...counts.entries()].map(([svcName, qty]) =>
        qty > 1 ? `${svcName} ×${qty}` : svcName
      );
      if (parts.length === 1) return parts[0]!;
      return `${parts[0]} +${parts.length - 1}`;
    })();
  const barColor = agendaStatusBarColor[agendaStatusBarKey(apt)];
  const showSourceIcon = Boolean(showBookingSource && apt.bookingSource);
  const showCreditIcon = (apt.customerCreditBalanceCents ?? 0) > 0;
  const cornerPadding = showSourceIcon;

  // Prioridade: nome completo, horário e ícone da origem. Serviço só se couber.
  const density: "single" | "double" | "full" =
    rowSpan <= 1 || (sideBySide && rowSpan <= 1)
      ? "single"
      : rowSpan === 2 || (sideBySide && rowSpan <= 2)
        ? "double"
        : "full";

  const blockButton = (
    <button
      type="button"
      className={cn(
        "agenda-apt-card relative z-20 my-0.5 flex min-h-0 min-w-0 self-stretch overflow-hidden rounded-sm text-left",
        sideBySide ? "mx-0.5" : "mx-1",
        density === "single" ? "py-0 pr-0.5 pl-3" : "py-0.5 pr-1 pl-3.5 sm:pr-1.5",
        agendaAppointmentClass(apt)
      )}
      style={{
        gridColumn,
        gridRow,
        zIndex: 20 + columnIndex + serviceIndex,
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
      {showSourceIcon && apt.bookingSource ? (
        <BookingSourceBadge source={apt.bookingSource} />
      ) : null}
      <div className="relative z-[2] flex min-h-0 w-full flex-col justify-center gap-0.5 overflow-hidden">
        {density === "single" ? (
          <p
            className={cn(
              "flex min-w-0 items-center gap-1 truncate text-[10px] font-medium leading-tight",
              showSourceIcon && cornerPadding && "pr-3.5"
            )}
          >
            {showCreditIcon ? (
              <CustomerCreditIcon cents={apt.customerCreditBalanceCents ?? 0} />
            ) : null}
            <span className="truncate">
              {name}
              <span className="font-normal tabular-nums opacity-85">
                {" "}
                · {startTime}
              </span>
            </span>
          </p>
        ) : null}

        {density === "double" ? (
          <>
            <p
              className={cn(
                "flex min-w-0 items-center gap-1 truncate text-[10px] font-medium leading-tight",
                showSourceIcon && cornerPadding && "pr-3.5"
              )}
            >
              {showCreditIcon ? (
                <CustomerCreditIcon cents={apt.customerCreditBalanceCents ?? 0} />
              ) : null}
              <span className="truncate">{name}</span>
            </p>
            <p className="truncate text-[9px] leading-tight tabular-nums opacity-85">
              {timeRange}
            </p>
          </>
        ) : null}

        {density === "full" ? (
          <>
            <p
              className={cn(
                "flex min-w-0 items-center gap-1 truncate text-[11px] font-medium leading-tight sm:text-xs",
                showSourceIcon && cornerPadding && "pr-3.5"
              )}
            >
              {showCreditIcon ? (
                <CustomerCreditIcon cents={apt.customerCreditBalanceCents ?? 0} />
              ) : null}
              <span className="truncate">{name}</span>
            </p>
            <p className="truncate text-[10px] leading-tight tabular-nums opacity-85">
              {timeRange}
            </p>
            {serviceLabel ? (
              <p className="truncate text-[10px] leading-tight opacity-70">
                {serviceLabel}
              </p>
            ) : null}
          </>
        ) : null}
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
        serviceIndex={serviceIndex}
        serviceCount={serviceCount}
      />
    </>
  );
}
