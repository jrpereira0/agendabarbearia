"use client";

import { useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DatePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** "dark" = identidade agenda/login. */
  tone?: "default" | "dark";
  className?: string;
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function formatCompactDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year!, month: (month ?? 1) - 1, day: day ?? 1 };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

export function DatePickerField({
  id,
  value,
  onChange,
  tone = "default",
  className,
}: DatePickerFieldProps) {
  const dark = tone === "dark";
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const [view, setView] = useState({
    year: selected.year,
    month: selected.month,
  });

  const openCalendar = (next: boolean) => {
    if (next) {
      const current = parseIso(value);
      setView({ year: current.year, month: current.month });
    }
    setOpen(next);
  };

  const shiftMonth = (delta: number) => {
    setView((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = todayIso();

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openCalendar}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors sm:h-8 sm:w-[9.75rem]",
            dark
              ? "border-white/10 bg-[#1a1b1e] text-[#f5f5f5] hover:border-[rgb(236_241_94_/_28%)]"
              : "border-input bg-background text-foreground hover:bg-muted/40",
            className
          )}
        >
          <span className="tabular-nums">{formatCompactDate(value)}</span>
          <CalendarDays
            className={cn(
              "size-4 shrink-0",
              dark ? "text-[#8b8d93]" : "text-muted-foreground"
            )}
          />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          data-slot="date-picker-content"
          className={cn(
            "z-50 w-[18rem] rounded-xl border p-3 shadow-xl outline-none",
            dark
              ? "border-white/10 !bg-[#151618] !text-[#f5f5f5]"
              : "border bg-popover text-popover-foreground"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mês anterior"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border transition-colors",
                dark
                  ? "border-white/10 text-[#8b8d93] hover:bg-white/5 hover:text-[#f5f5f5]"
                  : "border text-muted-foreground hover:bg-muted"
              )}
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-medium">
              {monthLabel(view.year, view.month)}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border transition-colors",
                dark
                  ? "border-white/10 text-[#8b8d93] hover:bg-white/5 hover:text-[#f5f5f5]"
                  : "border text-muted-foreground hover:bg-muted"
              )}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday, index) => (
              <span
                key={`${weekday}-${index}`}
                className={cn(
                  "flex h-7 items-center justify-center text-[10px] font-medium uppercase",
                  dark ? "text-[#8b8d93]" : "text-muted-foreground"
                )}
              >
                {weekday}
              </span>
            ))}

            {cells.map((day, index) => {
              if (day === null) {
                return <span key={`blank-${index}`} />;
              }

              const iso = toIso(view.year, view.month, day);
              const isSelected = iso === value;
              const isToday = iso === today;

              return (
                <button
                  key={iso}
                  type="button"
                  data-selected={isSelected ? "true" : undefined}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    isSelected
                      ? "bg-[#ecf15e] font-semibold text-[#0e0f11]"
                      : dark
                        ? "text-[#f5f5f5] hover:bg-white/5"
                        : "text-foreground hover:bg-muted",
                    !isSelected &&
                      isToday &&
                      (dark
                        ? "border border-[rgb(236_241_94_/_40%)] text-[#ecf15e]"
                        : "border border-primary/40 text-primary")
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(today);
              setOpen(false);
            }}
            className={cn(
              "mt-2 w-full rounded-lg border py-1.5 text-xs font-medium transition-colors",
              dark
                ? "border-white/10 text-[#8b8d93] hover:bg-white/5 hover:text-[#f5f5f5]"
                : "border text-muted-foreground hover:bg-muted"
            )}
          >
            Hoje
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
