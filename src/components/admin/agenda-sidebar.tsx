"use client";

import { List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AgendaMiniCalendar } from "@/components/admin/agenda-mini-calendar";
import { ScheduleBlocksPanel } from "@/components/admin/schedule-blocks-panel";
import { agendaLegend } from "@/lib/agenda-colors";
import type { ScheduleBlockItem } from "@/lib/get-agenda-day";

type ViewMode = "grid" | "list";

type AgendaSidebarProps = {
  date: string;
  today: string;
  viewMode: ViewMode;
  canBook: boolean;
  isOwner: boolean;
  professionalId: string | null;
  slotStepMinutes: number;
  scheduleBlocks: ScheduleBlockItem[];
  professionals: { id: string; nickname: string }[];
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNewAppointment: () => void;
  onEncaixe: () => void;
};

function LegendItem({
  swatchClass,
  label,
}: {
  swatchClass: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`size-4 shrink-0 rounded-sm shadow-sm ${swatchClass}`}
        aria-hidden
      />
      <span className="leading-snug">{label}</span>
    </li>
  );
}

export function AgendaSidebar({
  date,
  today,
  viewMode,
  canBook,
  isOwner,
  professionalId,
  slotStepMinutes,
  scheduleBlocks,
  professionals,
  onDateChange,
  onViewModeChange,
  onNewAppointment,
  onEncaixe,
}: AgendaSidebarProps) {
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
        {canBook && (
          <>
            <Button className="w-full justify-start" onClick={onNewAppointment}>
              <Plus />
              Agendar
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onEncaixe}
            >
              Encaixe
            </Button>
          </>
        )}
        <Button
          variant={viewMode === "grid" ? "secondary" : "outline"}
          className="w-full justify-start"
          onClick={() => onViewModeChange("grid")}
        >
          Grade do dia
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "outline"}
          className="w-full justify-start"
          onClick={() => onViewModeChange("list")}
        >
          <List />
          Lista do dia
        </Button>
      </div>

      {canBook && (
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
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Legenda da grade
        </p>
        <ul className="flex flex-col gap-2.5 text-sm">
          <LegendItem swatchClass={agendaLegend.free} label="Horário livre" />
          <LegendItem
            swatchClass={agendaLegend.outside}
            label="Fora do expediente"
          />
          <LegendItem swatchClass={agendaLegend.blocked} label="Bloqueado" />
          <LegendItem
            swatchClass={agendaLegend.occupied}
            label="Horário ocupado"
          />
          <LegendItem swatchClass={agendaLegend.confirmed} label="Agendado" />
          <LegendItem swatchClass={agendaLegend.squeezeIn} label="Encaixe" />
          <LegendItem swatchClass={agendaLegend.done} label="Atendido" />
        </ul>
      </div>
    </aside>
  );
}
