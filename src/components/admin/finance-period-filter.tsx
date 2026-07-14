"use client";

import type { ElementType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthStart, shiftDate } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type FinancePeriodFilterProps = {
  today: string;
  fromDate: string;
  toDate: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onPreset: (from: string, to: string) => void;
  submitLabel?: string;
  extraFields?: ReactNode;
  className?: string;
  /**
   * Quando true, renderiza como `div` (sem `<form>`).
   * Use dentro de outro formulário para evitar form aninhado.
   */
  embedded?: boolean;
};

type PresetId = "today" | "7days" | "month";

/**
 * Barra de período organizada: atalhos | datas | extras + filtrar.
 */
export function FinancePeriodFilter({
  today,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onSubmit,
  onPreset,
  submitLabel = "Filtrar",
  extraFields,
  className,
  embedded = false,
}: FinancePeriodFilterProps) {
  const activePreset: PresetId | null =
    fromDate === today && toDate === today
      ? "today"
      : fromDate === shiftDate(today, -6) && toDate === today
        ? "7days"
        : fromDate === monthStart(today) && toDate === today
          ? "month"
          : null;

  const presets: { id: PresetId; label: string; from: string; to: string }[] = [
    { id: "today", label: "Hoje", from: today, to: today },
    {
      id: "7days",
      label: "7 dias",
      from: shiftDate(today, -6),
      to: today,
    },
    { id: "month", label: "Mês", from: monthStart(today), to: today },
  ];

  const Root: ElementType = embedded ? "div" : "form";

  return (
    <Root
      {...(embedded
        ? {}
        : {
            onSubmit,
          })}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex w-full rounded-lg border bg-muted/40 p-0.5 lg:w-auto"
          role="group"
          aria-label="Atalhos de período"
        >
          {presets.map((preset) => {
            const active = activePreset === preset.id;
            return (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 flex-1 rounded-md px-3 text-xs font-medium lg:flex-none",
                  active
                    ? "bg-background text-foreground shadow-sm hover:bg-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={active}
                onClick={() => onPreset(preset.from, preset.to)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="finance-from">
              Data inicial
            </label>
            <Input
              id="finance-from"
              type="date"
              value={fromDate}
              onChange={(e) => onFromChange(e.target.value)}
              className="h-8 w-full bg-background sm:w-[9.75rem]"
            />
            <span className="shrink-0 text-xs text-muted-foreground">até</span>
            <label className="sr-only" htmlFor="finance-to">
              Data final
            </label>
            <Input
              id="finance-to"
              type="date"
              value={toDate}
              onChange={(e) => onToChange(e.target.value)}
              className="h-8 w-full bg-background sm:w-[9.75rem]"
            />
          </div>

          {(extraFields || submitLabel) && (
            <div className="flex items-center gap-2">
              {extraFields}
              <Button
                type={embedded ? "button" : "submit"}
                size="sm"
                className="h-8 shrink-0 px-4"
                onClick={
                  embedded
                    ? (event) => {
                        event.preventDefault();
                        onSubmit(event);
                      }
                    : undefined
                }
              >
                {submitLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Root>
  );
}
