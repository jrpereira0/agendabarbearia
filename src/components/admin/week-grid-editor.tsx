"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS } from "@/lib/format";
import type { BusinessDay } from "@/components/admin/business-hours-form";
import type { DayRanges, TimeRange } from "@/lib/week-schedule";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

export type { DayRanges, TimeRange } from "@/lib/week-schedule";
export { emptyWeek, fillWeek } from "@/lib/week-schedule";

type WeekGridEditorProps = {
  days: DayRanges[];
  businessDays: BusinessDay[];
  onChange?: (days: DayRanges[]) => void;
  readOnly?: boolean;
  /** "dark" = formulário do painel escuro. */
  tone?: "default" | "dark";
};

// Editor da grade semanal de um profissional. Dia sem faixa = folga.
export function WeekGridEditor({
  days,
  businessDays,
  onChange,
  readOnly = false,
  tone = "default",
}: WeekGridEditorProps) {
  const dark = tone === "dark";

  function updateDay(weekday: number, ranges: TimeRange[]) {
    onChange?.(
      days.map((d) => (d.weekday === weekday ? { ...d, ranges } : d))
    );
  }

  function addRange(weekday: number) {
    const business = businessDays.find((b) => b.weekday === weekday);
    const day = days.find((d) => d.weekday === weekday);
    const last = day?.ranges[day.ranges.length - 1];
    updateDay(weekday, [
      ...(day?.ranges ?? []),
      {
        startTime: last?.endTime ?? business?.openTime ?? "09:00",
        endTime: business?.closeTime ?? "19:00",
      },
    ]);
  }

  return (
    <div
      className={cn(
        "flex flex-col divide-y",
        dark && "divide-white/10"
      )}
    >
      {days.map((day) => {
        const businessDay = businessDays.find((b) => b.weekday === day.weekday);
        const shopClosed = !businessDay?.active;

        return (
          <div
            key={day.weekday}
            className="flex flex-col gap-2.5 py-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3"
          >
            <div className="flex w-full items-center gap-3 sm:w-32 sm:pt-1.5">
              <Switch
                checked={day.ranges.length > 0}
                disabled={readOnly || shopClosed}
                onCheckedChange={(checked) =>
                  checked ? addRange(day.weekday) : updateDay(day.weekday, [])
                }
                aria-label={`${WEEKDAYS[day.weekday]} trabalha`}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  dark && "text-[#f5f5f5]"
                )}
              >
                {WEEKDAYS[day.weekday]}
              </span>
            </div>

            {shopClosed ? (
              <span
                className={cn(
                  "text-sm sm:pt-1.5",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                Barbearia fechada
              </span>
            ) : day.ranges.length === 0 ? (
              <span
                className={cn(
                  "text-sm sm:pt-1.5",
                  dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                )}
              >
                Folga
              </span>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:w-auto">
                {day.ranges.map((range, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Input
                      type="time"
                      value={range.startTime}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateDay(
                          day.weekday,
                          day.ranges.map((r, j) =>
                            j === i ? { ...r, startTime: e.target.value } : r
                          )
                        )
                      }
                      className={cn(
                        "h-10 w-[7.25rem] sm:h-9 sm:w-28",
                        dark && ADMIN_SURFACE.input
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        dark ? ADMIN_SURFACE.muted : "text-muted-foreground"
                      )}
                    >
                      às
                    </span>
                    <Input
                      type="time"
                      value={range.endTime}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateDay(
                          day.weekday,
                          day.ranges.map((r, j) =>
                            j === i ? { ...r, endTime: e.target.value } : r
                          )
                        )
                      }
                      className={cn(
                        "h-10 w-[7.25rem] sm:h-9 sm:w-28",
                        dark && ADMIN_SURFACE.input
                      )}
                    />
                    {!readOnly && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            dark &&
                              "text-[#f87171] hover:bg-[rgb(248_113_113_/_12%)] hover:text-[#fca5a5]"
                          )}
                          onClick={() =>
                            updateDay(
                              day.weekday,
                              day.ranges.filter((_, j) => j !== i)
                            )
                          }
                          aria-label="Remover faixa"
                        >
                          <Trash2 />
                        </Button>
                        {i === day.ranges.length - 1 &&
                          day.ranges.length < 4 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={cn(
                                dark &&
                                  "text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
                              )}
                              onClick={() => addRange(day.weekday)}
                              aria-label="Adicionar faixa"
                            >
                              <Plus />
                            </Button>
                          )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
