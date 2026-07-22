"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AgendaMiniCalendar } from "@/components/admin/agenda-mini-calendar";
import { ScheduleBlocksPanel } from "@/components/admin/schedule-blocks-panel";
import { agendaLegend } from "@/lib/agenda-colors";
import {
  BOOKING_SOURCES,
  BOOKING_SOURCE_ICONS,
  BOOKING_SOURCE_LABELS,
} from "@/lib/booking-source";
import { formatDateBR } from "@/lib/format";
import type { ScheduleBlockItem } from "@/lib/get-agenda-day";
import { cn } from "@/lib/utils";

type AgendaSidebarProps = {
  date: string;
  today: string;
  isOwner: boolean;
  professionalId: string | null;
  canManageScheduleBlocks: boolean;
  slotStepMinutes: number;
  scheduleBlocks: ScheduleBlockItem[];
  professionals: { id: string; nickname: string }[];
  onDateChange: (date: string) => void;
  layout?: "desktop" | "mobile";
  mobileSection?: "date" | "tools";
  displayDate?: string;
  isNavigating?: boolean;
};

const LEGEND_GROUPS = [
  {
    title: "Grade",
    items: [
      { swatchClass: agendaLegend.free, label: "Livre" },
      { swatchClass: agendaLegend.outside, label: "Fora do expediente" },
      { swatchClass: agendaLegend.blocked, label: "Bloqueado" },
    ],
  },
  {
    title: "Status",
    items: [
      { swatchClass: agendaLegend.scheduled, label: "Agendado" },
      { swatchClass: agendaLegend.confirmed, label: "Confirmado" },
      { swatchClass: agendaLegend.onSite, label: "No local" },
      { swatchClass: agendaLegend.done, label: "Atendido" },
      { swatchClass: agendaLegend.cancelled, label: "Cancelado" },
    ],
  },
  {
    title: "Especiais",
    items: [
      { swatchClass: agendaLegend.squeezeIn, label: "Encaixe" },
      { swatchClass: agendaLegend.comandaExtra, label: "Serviço extra" },
    ],
  },
] as const;

function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("agenda-panel overflow-hidden rounded-2xl border", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{title}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-[var(--agenda-muted,#8b8d93)]">
              {subtitle}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--agenda-muted,#8b8d93)] transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div>
      )}
    </div>
  );
}

function LegendGrid({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-3.5" : "gap-4")}>
      {LEGEND_GROUPS.map((group) => (
        <div key={group.title}>
          <p
            className={cn(
              "mb-2 font-medium tracking-wide text-[var(--agenda-muted,#8b8d93)] uppercase",
              compact ? "text-[10px]" : "text-[11px]"
            )}
          >
            {group.title}
          </p>
          <ul
            className={cn(
              "grid gap-2",
              compact ? "grid-cols-1 text-xs" : "grid-cols-1 text-[13px]"
            )}
          >
            {group.items.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "shrink-0 rounded-md shadow-[0_0_0_1px_rgb(255_255_255_/_18%)]",
                    compact ? "size-4" : "size-[1.125rem]",
                    item.swatchClass
                  )}
                  aria-hidden
                />
                <span className="leading-snug text-[#f5f5f5]">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="border-t border-white/10 pt-3.5">
        <p
          className={cn(
            "mb-2 font-medium tracking-wide text-[var(--agenda-muted,#8b8d93)] uppercase",
            compact ? "text-[10px]" : "text-[11px]"
          )}
        >
          Origem
        </p>
        <ul
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-1 text-xs" : "grid-cols-1 text-[13px]"
          )}
        >
          {BOOKING_SOURCES.map((source) => {
            const Icon = BOOKING_SOURCE_ICONS[source];
            return (
              <li key={source} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-md border border-white/12 bg-[#1a1b1e] text-[#ecf15e]",
                    compact ? "size-3.5" : "size-4"
                  )}
                  aria-hidden
                >
                  <Icon
                    className={compact ? "size-2" : "size-2.5"}
                    strokeWidth={2.25}
                  />
                </span>
                <span className="leading-snug text-[#e8e8ea]">
                  {BOOKING_SOURCE_LABELS[source]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function AgendaMobileDateSection({
  date,
  displayDate,
  today,
  onDateChange,
  isNavigating = false,
}: Pick<
  AgendaSidebarProps,
  "date" | "displayDate" | "today" | "onDateChange" | "isNavigating"
>) {
  const [open, setOpen] = useState(false);
  const shownDate = displayDate ?? date;
  const isToday = shownDate === today;

  return (
    <div className="agenda-panel overflow-hidden rounded-2xl border">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="agenda-display text-sm font-medium leading-tight">
            {formatDateBR(shownDate)}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--agenda-muted,#8b8d93)]">
            {isToday
              ? "Hoje · toque para ver o mês"
              : "Toque para escolher outro dia"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--agenda-muted,#8b8d93)] transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          <AgendaMiniCalendar
            selectedDate={shownDate}
            today={today}
            loading={isNavigating}
            onSelectDate={(nextDate) => {
              onDateChange(nextDate);
              setOpen(false);
            }}
            compact
          />
        </div>
      )}
    </div>
  );
}

function AgendaMobileToolsSection({
  date,
  scheduleBlocks,
  professionals,
  isOwner,
  professionalId,
  slotStepMinutes,
  canManageScheduleBlocks,
}: Pick<
  AgendaSidebarProps,
  | "date"
  | "scheduleBlocks"
  | "professionals"
  | "isOwner"
  | "professionalId"
  | "slotStepMinutes"
  | "canManageScheduleBlocks"
>) {
  const blocksLabel =
    scheduleBlocks.length === 0
      ? "Nenhum bloqueio hoje"
      : `${scheduleBlocks.length} bloqueio${scheduleBlocks.length === 1 ? "" : "s"} hoje`;

  return (
    <div className="flex flex-col gap-2.5">
      {canManageScheduleBlocks && (
        <CollapsiblePanel
          title="Bloqueios do dia"
          subtitle={blocksLabel}
          defaultOpen={false}
        >
          <ScheduleBlocksPanel
            date={date}
            blocks={scheduleBlocks}
            professionals={professionals}
            isOwner={isOwner}
            defaultProfessionalId={professionalId}
            slotStepMinutes={slotStepMinutes}
            compact
          />
        </CollapsiblePanel>
      )}

      <CollapsiblePanel
        title="Legenda"
        subtitle="Cores da grade e origem"
        defaultOpen={false}
      >
        <LegendGrid compact />
      </CollapsiblePanel>
    </div>
  );
}

export function AgendaSidebar({
  date,
  today,
  isOwner,
  professionalId,
  canManageScheduleBlocks,
  slotStepMinutes,
  scheduleBlocks,
  professionals,
  onDateChange,
  layout = "desktop",
  mobileSection,
  displayDate,
  isNavigating = false,
}: AgendaSidebarProps) {
  const [legendOpen, setLegendOpen] = useState(true);
  const shownDate = displayDate ?? date;

  if (layout === "mobile") {
    if (mobileSection === "date") {
      return (
        <AgendaMobileDateSection
          date={date}
          displayDate={displayDate}
          today={today}
          onDateChange={onDateChange}
          isNavigating={isNavigating}
        />
      );
    }

    if (mobileSection === "tools") {
      return (
        <AgendaMobileToolsSection
          date={date}
          scheduleBlocks={scheduleBlocks}
          professionals={professionals}
          isOwner={isOwner}
          professionalId={professionalId}
          slotStepMinutes={slotStepMinutes}
          canManageScheduleBlocks={canManageScheduleBlocks}
        />
      );
    }
  }

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-72 lg:shrink-0">
      <div className="agenda-panel rounded-2xl border p-4">
        <p className="agenda-display mb-3 text-[11px] font-medium tracking-[0.14em] text-[var(--agenda-accent,#ecf15e)] uppercase">
          Calendário
        </p>
        <AgendaMiniCalendar
          selectedDate={shownDate}
          today={today}
          loading={isNavigating}
          onSelectDate={onDateChange}
        />
      </div>

      {canManageScheduleBlocks && (
        <div className="agenda-panel rounded-2xl border p-3.5">
          <p className="agenda-display mb-3 text-[11px] font-medium tracking-[0.14em] text-[var(--agenda-muted,#8b8d93)] uppercase">
            Bloqueios
          </p>
          <ScheduleBlocksPanel
            date={date}
            blocks={scheduleBlocks}
            professionals={professionals}
            isOwner={isOwner}
            defaultProfessionalId={professionalId}
            slotStepMinutes={slotStepMinutes}
          />
        </div>
      )}

      <div className="agenda-panel rounded-2xl border p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          aria-controls="agenda-legend-list"
        >
          <span className="agenda-display text-[11px] font-medium tracking-[0.14em] text-[var(--agenda-muted,#8b8d93)] uppercase">
            Legenda
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-[var(--agenda-muted,#8b8d93)] transition-transform duration-200",
              legendOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {legendOpen && (
          <div id="agenda-legend-list" className="mt-3.5">
            <LegendGrid />
          </div>
        )}
      </div>
    </aside>
  );
}
