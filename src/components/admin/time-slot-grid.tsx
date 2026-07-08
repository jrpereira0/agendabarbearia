"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { groupTimeSlotsByPeriod } from "@/lib/time-periods";
import { cn } from "@/lib/utils";

type TimeSlotGridProps = {
  slots: string[];
  value: string | null;
  onChange: (slot: string) => void;
  isSlotDisabled?: (slot: string) => boolean;
  disabled?: boolean;
  formatSlot?: (slot: string) => string;
  buttonSize?: "sm" | "default";
  buttonClassName?: string;
  className?: string;
  /** Quando false, a grade rola junto com o conteúdo pai (ex.: modal). */
  scrollable?: boolean;
};

export function TimeSlotGrid({
  slots,
  value,
  onChange,
  isSlotDisabled,
  disabled = false,
  formatSlot = (slot) => slot,
  buttonSize = "default",
  buttonClassName,
  className,
  scrollable = true,
}: TimeSlotGridProps) {
  const groups = useMemo(() => groupTimeSlotsByPeriod(slots), [slots]);
  const showPeriodHeaders = groups.length > 1;

  if (slots.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-4",
        scrollable &&
          "max-h-56 overflow-y-auto rounded-lg border p-2 sm:max-h-64",
        className
      )}
    >
      {groups.map((group) => (
        <div key={group.period}>
          {showPeriodHeaders && (
            <p className="mb-2 px-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.slots.map((slot) => {
              const slotDisabled = disabled || (isSlotDisabled?.(slot) ?? false);
              return (
                <Button
                  key={slot}
                  type="button"
                  variant={value === slot ? "default" : "outline"}
                  size={buttonSize}
                  className={cn(
                    "tabular-nums",
                    buttonSize === "sm" ? "h-9" : "h-10",
                    buttonClassName
                  )}
                  disabled={slotDisabled}
                  onClick={() => onChange(slot)}
                >
                  {formatSlot(slot)}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
