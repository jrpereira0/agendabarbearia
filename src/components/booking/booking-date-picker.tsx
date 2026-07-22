"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

type BookingDatePickerProps = {
  selectedDate: string;
  today: string;
  maxDate: string;
  onSelectDate: (date: string) => void;
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

function isSelectable(iso: string, today: string, maxDate: string): boolean {
  return iso >= today && iso <= maxDate;
}

export function BookingDatePicker({
  selectedDate,
  today,
  maxDate,
  onSelectDate,
}: BookingDatePickerProps) {
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
    let next = toIso(d.getFullYear(), d.getMonth(), day);
    if (next < today) next = today;
    if (next > maxDate) {
      next = maxDate;
    }
    onSelectDate(next);
  }

  const canGoPrev =
    toIso(year, month, 1) > toIso(parseIso(today).year, parseIso(today).month, 1);
  const canGoNext =
    toIso(year, month, totalDays) < maxDate;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-medium">{monthLabel(year, month)}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => shiftMonth(1)}
          disabled={!canGoNext}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`} className="py-1 font-medium">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;

          const iso = toIso(year, month, day);
          const selectable = isSelectable(iso, today, maxDate);
          const isSelected = iso === selectedDate;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              onClick={() => onSelectDate(iso)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm transition-colors",
                isSelected &&
                  "bg-primary font-semibold text-primary-foreground",
                !isSelected &&
                  isToday &&
                  selectable &&
                  "ring-1 ring-primary/60",
                !isSelected && selectable && "hover:bg-muted",
                !selectable && "cursor-not-allowed text-muted-foreground/40"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
