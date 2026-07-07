"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

type AgendaMiniCalendarProps = {
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
  compact?: boolean;
};

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function AgendaMiniCalendar({
  selectedDate,
  today,
  onSelectDate,
  compact = false,
}: AgendaMiniCalendarProps) {
  const { year, month } = parseIso(selectedDate);
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    const day = Math.min(parseIso(selectedDate).day, daysInMonth(d.getFullYear(), d.getMonth()));
    onSelectDate(toIso(d.getFullYear(), d.getMonth(), day));
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? "size-6" : "size-7"}
          onClick={() => shiftMonth(-1)}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {monthLabel(year, month)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? "size-6" : "size-7"}
          onClick={() => shiftMonth(1)}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 gap-0.5 text-center text-muted-foreground",
          compact ? "text-[10px]" : "gap-1 text-xs"
        )}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`} className="py-0.5 font-medium">
            {label}
          </span>
        ))}
      </div>

      <div className={cn("grid grid-cols-7", compact ? "gap-0.5" : "gap-1")}>
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;

          const iso = toIso(year, month, day);
          const isSelected = iso === selectedDate;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={cn(
                "flex items-center justify-center rounded-full transition-colors",
                compact ? "size-7 text-xs" : "size-8 text-sm",
                isSelected && "bg-foreground text-background font-semibold",
                !isSelected && isToday && "ring-1 ring-foreground",
                !isSelected && !isToday && "hover:bg-muted"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selectedDate !== today && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className={cn(
            "h-auto p-0 text-muted-foreground",
            compact && "text-xs"
          )}
          onClick={() => onSelectDate(today)}
        >
          Ir para hoje
        </Button>
      )}
    </div>
  );
}
