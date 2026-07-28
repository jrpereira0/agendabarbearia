"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type BookingDatePickerProps = {
  selectedDate: string;
  /** Dia civil de hoje (só pra destacar o chip "hoje", se ainda aparecer). */
  today: string;
  /** Primeira data listada (ex.: amanhã se o expediente de hoje já encerrou). */
  minDate?: string;
  maxDate: string;
  onSelectDate: (date: string) => void;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MONTH_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

const DRAG_THRESHOLD_PX = 6;

function dateParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return {
    weekday: WEEKDAY_SHORT[d.getDay()],
    day,
    month: MONTH_SHORT[month - 1],
  };
}

type DragState = {
  tracking: boolean;
  dragging: boolean;
  startX: number;
  startScroll: number;
  pointerId: number;
};

export function BookingDatePicker({
  selectedDate,
  today,
  minDate,
  maxDate,
  onSelectDate,
}: BookingDatePickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<DragState>({
    tracking: false,
    dragging: false,
    startX: 0,
    startScroll: 0,
    pointerId: -1,
  });
  const startDate = minDate && minDate > today ? minDate : today;

  const dates = useMemo(() => {
    const list: string[] = [];
    let cursor = startDate;
    while (cursor <= maxDate) {
      list.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return list;
  }, [startDate, maxDate]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("[data-selected='true']");
    if (!active) return;
    const rootRect = root.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const nextLeft =
      root.scrollLeft +
      (activeRect.left - rootRect.left) -
      rootRect.width / 2 +
      activeRect.width / 2;
    root.scrollTo({ left: nextLeft, behavior: "smooth" });
  }, [selectedDate, dates]);

  function endDrag(pointerId: number) {
    const drag = dragRef.current;
    if (!drag.tracking || drag.pointerId !== pointerId) return;
    if (drag.dragging) suppressClickRef.current = true;
    drag.tracking = false;
    drag.dragging = false;
    const root = scrollRef.current;
    if (root?.hasPointerCapture(pointerId)) {
      root.releasePointerCapture(pointerId);
    }
    root?.classList.remove("cursor-grabbing");
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#0e0f11] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#0e0f11] to-transparent"
      />

      <div
        ref={scrollRef}
        role="listbox"
        aria-label="Escolher data"
        aria-orientation="horizontal"
        onPointerDown={(event) => {
          // No mouse: arrastar pra rolar. No touch: scroll nativo.
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          const root = scrollRef.current;
          if (!root) return;
          // Só começa a capturar depois de mover — senão o clique no dia some.
          dragRef.current = {
            tracking: true,
            dragging: false,
            startX: event.clientX,
            startScroll: root.scrollLeft,
            pointerId: event.pointerId,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          const root = scrollRef.current;
          if (!drag.tracking || !root || drag.pointerId !== event.pointerId) {
            return;
          }
          const delta = event.clientX - drag.startX;
          if (!drag.dragging) {
            if (Math.abs(delta) < DRAG_THRESHOLD_PX) return;
            drag.dragging = true;
            root.setPointerCapture(event.pointerId);
            root.classList.add("cursor-grabbing");
          }
          root.scrollLeft = drag.startScroll - delta;
        }}
        onPointerUp={(event) => endDrag(event.pointerId)}
        onPointerCancel={(event) => endDrag(event.pointerId)}
        className={cn(
          "flex gap-2.5 overflow-x-auto overscroll-x-contain px-3 py-1",
          "snap-x snap-mandatory touch-pan-x",
          "cursor-grab select-none",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {dates.map((iso) => {
          const { weekday, day, month } = dateParts(iso);
          const selected = iso === selectedDate;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              role="option"
              aria-selected={selected}
              data-selected={selected ? "true" : undefined}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onSelectDate(iso);
              }}
              className={cn(
                "flex w-[4.25rem] shrink-0 snap-center flex-col items-center justify-center gap-1 rounded-[1.15rem] px-2 py-3 transition-[background-color,border-color,transform,box-shadow] duration-200",
                selected
                  ? "scale-[1.02] border border-primary bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(236_241_94_/_22%)]"
                  : "border border-white/10 bg-[#151618] text-[#f5f5f5] active:scale-[0.98]",
                !selected && isToday && "border-primary/45 bg-primary/10"
              )}
            >
              <span
                className={cn(
                  "text-[0.7rem] font-medium leading-none tracking-wide",
                  selected ? "text-primary-foreground/75" : "text-muted-foreground"
                )}
              >
                {weekday}
              </span>
              <span className="text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight">
                {day}
              </span>
              <span
                className={cn(
                  "text-[0.7rem] font-medium leading-none tracking-wide",
                  selected ? "text-primary-foreground/75" : "text-muted-foreground"
                )}
              >
                {month}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
