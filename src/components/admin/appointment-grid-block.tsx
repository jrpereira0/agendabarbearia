"use client";

import { useState } from "react";
import { Wallet, UserPlus } from "lucide-react";
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
  /** Card pode ser arrastado pra outro horário/barbeiro. */
  draggable?: boolean;
  /** Este agendamento é o que está sendo arrastado agora. */
  isDragging?: boolean;
  onDragPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
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

function FirstVisitBadge({
  mode = "full",
}: {
  mode?: "full" | "compact" | "icon";
}) {
  const label = "Primeira visita deste cliente";

  if (mode === "icon") {
    return (
      <span
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-[#0e0f11]/16 text-[#3f4f08] ring-1 ring-[#0e0f11]/12"
        aria-label={label}
        title={label}
      >
        <UserPlus className="size-2.5" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-[#0e0f11]/16 font-medium text-[#3f4f08] ring-1 ring-[#0e0f11]/12",
        mode === "compact"
          ? "px-0.5 py-px text-[8px] leading-none"
          : "px-1 py-px text-[9px] leading-tight"
      )}
      aria-label={label}
      title={label}
    >
      <UserPlus
        className={mode === "compact" ? "size-2" : "size-2.5"}
        strokeWidth={2.25}
      />
      <span>1ª visita</span>
    </span>
  );
}

function BookingSourceBadge({
  source,
  compact,
}: {
  source: BookingSource;
  compact?: boolean;
}) {
  const Icon = BOOKING_SOURCE_ICONS[source];
  const label = BOOKING_SOURCE_LABELS[source];

  return (
    <span
      className={cn(
        "pointer-events-none absolute z-10 inline-flex shrink-0 items-center justify-center rounded-sm bg-black/25 text-current ring-1 ring-black/10",
        compact
          ? "top-px right-px size-3.5"
          : "top-0.5 right-0.5 size-4"
      )}
      aria-label={`Agendado: ${label}`}
      title={`Agendado: ${label}`}
    >
      <Icon className={compact ? "size-2" : "size-2.5"} strokeWidth={2.25} />
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

      {apt.isFirstVisit ? (
        <p className="flex items-center gap-1.5 text-[var(--agenda-accent,#ecf15e)]">
          <UserPlus className="size-3 shrink-0" strokeWidth={2} />
          <span>Primeira visita</span>
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
  draggable = false,
  isDragging = false,
  onDragPointerDown,
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
  const timeShort = startTime;
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
  const showFirstVisit = Boolean(apt.isFirstVisit);

  // Altura real na grade (linhas de 5 min) — decide o que cabe sem cortar.
  // ≤3 (~15 min): bem apertado · ≤7 (~35 min): 2 linhas · maior: layout completo
  const size: "tiny" | "compact" | "full" =
    rowSpan <= 3 || (sideBySide && rowSpan <= 4)
      ? "tiny"
      : rowSpan <= 7 || (sideBySide && rowSpan <= 9)
        ? "compact"
        : "full";

  const blockButton = (
    <button
      type="button"
      className={cn(
        "agenda-apt-card relative z-20 flex min-h-0 min-w-0 self-stretch overflow-hidden rounded-sm text-left",
        size === "tiny" ? "my-px" : "my-0.5",
        sideBySide ? "mx-0.5" : "mx-1",
        size === "full" ? "py-0.5 pr-1.5 pl-3.5" : "py-0 pr-1 pl-3",
        draggable && "agenda-apt-draggable",
        isDragging && "agenda-apt-dragging",
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
      onPointerDown={onDragPointerDown}
      onDragStart={(event) => event.preventDefault()}
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
        <BookingSourceBadge
          source={apt.bookingSource}
          compact={size !== "full"}
        />
      ) : null}
      <div
        className={cn(
          "relative z-[2] flex min-h-0 w-full flex-col overflow-hidden",
          size === "full" ? "justify-center gap-0.5" : "justify-center gap-px",
          showSourceIcon && (size === "full" ? "pr-4" : "pr-3.5")
        )}
      >
        <p
          className={cn(
            "flex min-w-0 items-center gap-1 font-medium leading-none",
            size === "full" ? "text-[11px] sm:text-xs" : "text-[10px]"
          )}
        >
          {showCreditIcon ? (
            <CustomerCreditIcon cents={apt.customerCreditBalanceCents ?? 0} />
          ) : null}
          <span className="truncate">{name || "Cliente"}</span>
          {showFirstVisit ? (
            <FirstVisitBadge mode={size === "full" ? "full" : "icon"} />
          ) : null}
        </p>

        {size === "tiny" ? (
          <p className="flex min-w-0 items-center gap-1 text-[9px] leading-none">
            <span className="shrink-0 tabular-nums opacity-90">{timeShort}</span>
            {serviceLabel ? (
              <>
                <span className="opacity-40">·</span>
                <span className="min-w-0 truncate opacity-75">{serviceLabel}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {size === "compact" ? (
          <p className="flex min-w-0 items-center gap-1 text-[9px] leading-none">
            <span className="shrink-0 tabular-nums opacity-90">{timeRange}</span>
            {serviceLabel ? (
              <>
                <span className="opacity-40">·</span>
                <span className="min-w-0 truncate opacity-75">{serviceLabel}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {size === "full" ? (
          <>
            <p className="truncate text-[10px] leading-tight tabular-nums opacity-90">
              {timeRange}
            </p>
            {serviceLabel ? (
              <p className="truncate text-[10px] leading-tight opacity-75">
                {serviceLabel}
              </p>
            ) : (
              <p className="truncate text-[10px] leading-tight opacity-50">
                Sem serviço
              </p>
            )}
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
