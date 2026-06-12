"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingFlow } from "@/components/booking/booking-flow";
import { MyAppointments } from "@/components/booking/my-appointments";
import type { ShopCatalog } from "@/lib/get-shop-catalog";

type Mode = "book" | "manage";

type BookingSectionProps = {
  catalog: ShopCatalog;
  today: string;
};

export function BookingSection({ catalog, today }: BookingSectionProps) {
  const [mode, setMode] = useState<Mode>("book");

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#meus-agendamentos") {
        setMode("manage");
      }
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectMode(next: Mode) {
    setMode(next);
    if (next === "manage") {
      window.history.replaceState(null, "", "#meus-agendamentos");
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  return (
    <div id="meus-agendamentos" className="scroll-mt-6">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => selectMode("book")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
            mode === "book"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarPlus className="size-4 shrink-0" />
          Agendar
        </button>
        <button
          type="button"
          onClick={() => selectMode("manage")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
            mode === "manage"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarClock className="size-4 shrink-0" />
          Meus horários
        </button>
      </div>

      {mode === "book" ? (
        <BookingFlow catalog={catalog} today={today} />
      ) : (
        <MyAppointments catalog={catalog} today={today} />
      )}
    </div>
  );
}
