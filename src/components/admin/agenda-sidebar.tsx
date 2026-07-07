"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AgendaMiniCalendar } from "@/components/admin/agenda-mini-calendar";
import { ScheduleBlocksPanel } from "@/components/admin/schedule-blocks-panel";
import { agendaLegend } from "@/lib/agenda-colors";
import { formatDateBR } from "@/lib/format";
import type { ScheduleBlockItem } from "@/lib/get-agenda-day";
import { cn } from "@/lib/utils";

type AgendaSidebarProps = {
  date: string;
  today: string;
  canBookNormal: boolean;
  canBookEncaixe: boolean;
  isOwner: boolean;
  professionalId: string | null;
  canManageScheduleBlocks: boolean;
  slotStepMinutes: number;
  scheduleBlocks: ScheduleBlockItem[];
  professionals: { id: string; nickname: string }[];
  onDateChange: (date: string) => void;
  onNewAppointment: () => void;
  onEncaixe: () => void;
  layout?: "desktop" | "mobile";
  mobileSection?: "date" | "tools";
};

const LEGEND_ITEMS = [
  { swatchClass: agendaLegend.free, label: "Livre" },
  { swatchClass: agendaLegend.outside, label: "Fora do expediente" },
  { swatchClass: agendaLegend.blocked, label: "Bloqueado" },
  { swatchClass: agendaLegend.scheduled, label: "Agendado" },
  { swatchClass: agendaLegend.confirmed, label: "Confirmado" },
  { swatchClass: agendaLegend.onSite, label: "No local" },
  { swatchClass: agendaLegend.cancelled, label: "Cancelado" },
  { swatchClass: agendaLegend.squeezeIn, label: "Encaixe" },
  { swatchClass: agendaLegend.comandaExtra, label: "Serviço extra" },
  { swatchClass: agendaLegend.done, label: "Atendido" },
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
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{title}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t px-3.5 pb-3.5 pt-3">{children}</div>
      )}
    </div>
  );
}

function LegendGrid({ compact }: { compact?: boolean }) {
  return (
    <ul
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-2 text-xs" : "flex flex-col gap-2.5 text-sm"
      )}
    >
      {LEGEND_ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-sm shadow-sm",
              compact ? "size-3" : "size-4",
              item.swatchClass
            )}
            aria-hidden
          />
          <span className="leading-snug">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function AgendaMobileDateSection({
  date,
  today,
  onDateChange,
}: Pick<AgendaSidebarProps, "date" | "today" | "onDateChange">) {
  const [open, setOpen] = useState(false);
  const isToday = date === today;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">
            {formatDateBR(date)}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {isToday
              ? "Hoje · toque para ver o mês"
              : "Toque para escolher outro dia"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t px-3.5 pb-3.5 pt-3">
          <AgendaMiniCalendar
            selectedDate={date}
            today={today}
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
    <div className="flex flex-col gap-2">
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
        title="Legenda da grade"
        subtitle="Cores dos horários e status"
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
  canBookNormal,
  canBookEncaixe,
  isOwner,
  professionalId,
  canManageScheduleBlocks,
  slotStepMinutes,
  scheduleBlocks,
  professionals,
  onDateChange,
  onNewAppointment,
  onEncaixe,
  layout = "desktop",
  mobileSection,
}: AgendaSidebarProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  if (layout === "mobile") {
    if (mobileSection === "date") {
      return (
        <AgendaMobileDateSection
          date={date}
          today={today}
          onDateChange={onDateChange}
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
    <aside className="flex w-full flex-col gap-4 lg:w-56 lg:shrink-0">
      <div className="rounded-lg border p-4">
        <AgendaMiniCalendar
          selectedDate={date}
          today={today}
          onSelectDate={onDateChange}
        />
      </div>

      <div className="flex flex-col gap-2">
        {canBookNormal && (
          <Button className="w-full justify-start" onClick={onNewAppointment}>
            <Plus />
            Agendar
          </Button>
        )}
        {canBookEncaixe && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onEncaixe}
          >
            Encaixe
          </Button>
        )}
      </div>

      {canManageScheduleBlocks && (
        <ScheduleBlocksPanel
          date={date}
          blocks={scheduleBlocks}
          professionals={professionals}
          isOwner={isOwner}
          defaultProfessionalId={professionalId}
          slotStepMinutes={slotStepMinutes}
        />
      )}

      <Separator />

      <div className="rounded-lg border p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          aria-controls="agenda-legend-list"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Legenda da grade
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              legendOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {legendOpen && (
          <div id="agenda-legend-list" className="mt-3">
            <LegendGrid />
          </div>
        )}
      </div>
    </aside>
  );
}
