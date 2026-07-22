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
  disabled?: boolean;
  loading?: boolean;
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
  disabled = false,
  loading = false,
}: AgendaMiniCalendarProps) {
  const { year, month } = parseIso(selectedDate);
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  function handleSelectDate(iso: string) {
    if (disabled || loading || iso === selectedDate) return;
    onSelectDate(iso);
  }

  function shiftMonth(delta: number) {
    if (disabled || loading) return;
    const d = new Date(year, month + delta, 1);
    const day = Math.min(
      parseIso(selectedDate).day,
      daysInMonth(d.getFullYear(), d.getMonth())
    );
    handleSelectDate(toIso(d.getFullYear(), d.getMonth(), day));
  }

  return (
    <div
      className={cn(
        "flex flex-col transition-opacity duration-200",
        compact ? "gap-2" : "gap-3",
        disabled && "pointer-events-none opacity-50"
      )}
      aria-busy={loading}
    >
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "agenda-btn-ghost",
            compact ? "size-8" : "size-7"
          )}
          onClick={() => shiftMonth(-1)}
          disabled={disabled || loading}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p
          className={cn(
            "agenda-display font-medium",
            compact ? "text-sm" : "text-sm"
          )}
        >
          {monthLabel(year, month)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "agenda-btn-ghost",
            compact ? "size-8" : "size-7"
          )}
          onClick={() => shiftMonth(1)}
          disabled={disabled || loading}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 text-center text-[var(--agenda-muted,#8b8d93)]",
          compact ? "gap-1 text-xs" : "gap-1 text-xs"
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
              onClick={() => handleSelectDate(iso)}
              disabled={disabled || loading}
              aria-current={isSelected ? "date" : undefined}
              aria-label={
                isToday
                  ? `Hoje, dia ${day}`
                  : isSelected
                    ? `Dia ${day}, selecionado`
                    : `Dia ${day}`
              }
              className={cn(
                "agenda-cal-day flex items-center justify-center rounded-full font-medium tabular-nums transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agenda-accent,#ecf15e)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agenda-bg,#0e0f11)]",
                "active:scale-[0.97] motion-reduce:active:scale-100",
                compact ? "size-9 text-sm" : "size-8 text-sm",
                isSelected && "cursor-default shadow-sm",
                !isSelected && isToday && "agenda-cal-today",
                !isSelected &&
                  !isToday &&
                  "text-[var(--agenda-muted,#8b8d93)] hover:bg-white/5 hover:text-[#f5f5f5]"
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
            "h-auto p-0 text-[var(--agenda-muted,#8b8d93)] hover:text-[var(--agenda-accent,#ecf15e)]",
            compact && "text-xs"
          )}
          disabled={disabled || loading}
          onClick={() => handleSelectDate(today)}
        >
          Ir para hoje
        </Button>
      )}
    </div>
  );
}
