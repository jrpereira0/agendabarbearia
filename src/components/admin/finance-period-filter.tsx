"use client";

import type { ElementType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/admin/date-picker-field";
import { monthStart, shiftDate } from "@/lib/date-range";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
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
  /** "dark" = identidade agenda/login. */
  tone?: "default" | "dark";
  /**
   * No celular: só atalhos visíveis; datas personalizadas ficam
   * atrás de "Outras datas" pra não poluir a tela.
   * Campos extras (ex.: métrica) ficam sempre visíveis.
   */
  mobilePresetsFirst?: boolean;
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
  tone = "default",
  mobilePresetsFirst = false,
}: FinancePeriodFilterProps) {
  const dark = tone === "dark" || Boolean(className?.includes("page-filter"));
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

  const dateFields = (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <label className="sr-only" htmlFor="finance-from">
        Data inicial
      </label>
      <DatePickerField
        id="finance-from"
        value={fromDate}
        onChange={onFromChange}
        tone={dark ? "dark" : "default"}
      />
      <span
        className={cn(
          "px-0.5 text-xs sm:shrink-0",
          dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
        )}
      >
        até
      </span>
      <label className="sr-only" htmlFor="finance-to">
        Data final
      </label>
      <DatePickerField
        id="finance-to"
        value={toDate}
        onChange={onToChange}
        tone={dark ? "dark" : "default"}
      />
    </div>
  );

  const filterButton = (
    <Button
      type={embedded ? "button" : "submit"}
      className={cn(
        "h-10 w-full shrink-0 px-4 sm:h-8 sm:w-auto",
        dark && ADMIN_SURFACE.btnPrimary
      )}
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
  );

  const customRange = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
      {dateFields}
      {(extraFields || submitLabel) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {extraFields}
          {filterButton}
        </div>
      )}
    </div>
  );

  const datesOnlyRange = (
    <div className="flex flex-col gap-2">
      {dateFields}
      {filterButton}
    </div>
  );

  return (
    <Root
      {...(embedded
        ? {}
        : {
            onSubmit,
          })}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-3",
        dark
          ? cn(ADMIN_SURFACE.panel, "shadow-none")
          : "bg-card shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className={cn(
            "inline-flex w-full rounded-lg border p-0.5 lg:w-auto",
            dark
              ? "border-white/10 bg-white/[0.04]"
              : "border bg-muted/40"
          )}
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
                  "h-10 flex-1 rounded-md px-3 text-sm font-medium sm:h-8 sm:text-xs lg:flex-none",
                  dark
                    ? active
                      ? ADMIN_SURFACE.chipActive
                      : ADMIN_SURFACE.chip
                    : active
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

        {mobilePresetsFirst ? (
          <>
            {extraFields ? (
              <div className="w-full lg:hidden">{extraFields}</div>
            ) : null}
            <details
              className={cn(
                "group rounded-xl border lg:hidden",
                dark ? "border-white/10" : "border"
              )}
              open={activePreset === null ? true : undefined}
            >
              <summary
                className={cn(
                  "cursor-pointer list-none px-3 py-2.5 text-sm marker:content-none [&::-webkit-details-marker]:hidden",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  Outras datas
                  <span className="text-xs group-open:hidden">Abrir</span>
                  <span className="hidden text-xs group-open:inline">
                    Fechar
                  </span>
                </span>
              </summary>
              <div
                className={cn(
                  "border-t px-3 py-3",
                  dark ? "border-white/10" : "border-border"
                )}
              >
                {datesOnlyRange}
              </div>
            </details>
            <div className="hidden lg:block">{customRange}</div>
          </>
        ) : (
          customRange
        )}
      </div>
    </Root>
  );
}
