"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS } from "@/lib/format";
import type { BusinessDay } from "@/components/admin/business-hours-form";
import type { DayRanges, TimeRange } from "@/lib/week-schedule";

export type { DayRanges, TimeRange } from "@/lib/week-schedule";
export { emptyWeek, fillWeek } from "@/lib/week-schedule";

type WeekGridEditorProps = {
  days: DayRanges[];
  businessDays: BusinessDay[];
  onChange?: (days: DayRanges[]) => void;
  readOnly?: boolean;
};

// Editor da grade semanal de um profissional. Dia sem faixa = folga.
export function WeekGridEditor({
  days,
  businessDays,
  onChange,
  readOnly = false,
}: WeekGridEditorProps) {
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
    <div className="flex flex-col divide-y">
      {days.map((day) => {
        const businessDay = businessDays.find((b) => b.weekday === day.weekday);
        const shopClosed = !businessDay?.active;

        return (
          <div key={day.weekday} className="flex flex-wrap items-start gap-3 py-3">
            <div className="flex w-32 items-center gap-3 pt-1.5">
              <Switch
                checked={day.ranges.length > 0}
                disabled={readOnly || shopClosed}
                onCheckedChange={(checked) =>
                  checked ? addRange(day.weekday) : updateDay(day.weekday, [])
                }
                aria-label={`${WEEKDAYS[day.weekday]} trabalha`}
              />
              <span className="text-sm font-medium">
                {WEEKDAYS[day.weekday]}
              </span>
            </div>

            {shopClosed ? (
              <span className="pt-1.5 text-sm text-muted-foreground">
                Barbearia fechada
              </span>
            ) : day.ranges.length === 0 ? (
              <span className="pt-1.5 text-sm text-muted-foreground">Folga</span>
            ) : (
              <div className="flex flex-col gap-2">
                {day.ranges.map((range, i) => (
                  <div key={i} className="flex items-center gap-2">
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
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">às</span>
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
                      className="w-28"
                    />
                    {!readOnly && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
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
                        {i === day.ranges.length - 1 && day.ranges.length < 4 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
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
