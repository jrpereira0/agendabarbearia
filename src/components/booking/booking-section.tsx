"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingFlow } from "@/components/booking/booking-flow";
import { MyAppointments } from "@/components/booking/my-appointments";
import { ShopInfoPanel } from "@/components/booking/shop-info-panel";
import type { ShopCatalog } from "@/lib/get-shop-catalog";

type Mode = "book" | "manage" | "info";

type BookingSectionProps = {
  catalog: ShopCatalog;
  today: string;
};

const tabs: {
  id: Mode;
  label: string;
  icon: typeof CalendarPlus;
  hash: string | null;
}[] = [
  { id: "book", label: "Agendar", icon: CalendarPlus, hash: null },
  {
    id: "manage",
    label: "Horários",
    icon: CalendarClock,
    hash: "#meus-agendamentos",
  },
  { id: "info", label: "Local", icon: MapPinned, hash: "#local" },
];

function modeFromHash(hash: string): Mode {
  if (hash === "#meus-agendamentos") return "manage";
  if (hash === "#local") return "info";
  return "book";
}

export function BookingSection({ catalog, today }: BookingSectionProps) {
  const [mode, setMode] = useState<Mode>("book");

  useEffect(() => {
    function syncFromHash() {
      setMode(modeFromHash(window.location.hash));
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectMode(next: Mode) {
    setMode(next);
    const tab = tabs.find((item) => item.id === next);
    window.history.replaceState(
      null,
      "",
      tab?.hash ?? window.location.pathname
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main
        id="agendar"
        className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-6"
      >
        <div id="meus-agendamentos" className="scroll-mt-4">
          <div
            className={mode === "book" ? "block" : "hidden"}
            aria-hidden={mode !== "book"}
            inert={mode !== "book" ? true : undefined}
          >
            <BookingFlow catalog={catalog} today={today} />
          </div>
          <div
            className={mode === "manage" ? "block" : "hidden"}
            aria-hidden={mode !== "manage"}
            inert={mode !== "manage" ? true : undefined}
          >
            <MyAppointments catalog={catalog} today={today} />
          </div>
          <div
            className={mode === "info" ? "block" : "hidden"}
            aria-hidden={mode !== "info"}
            inert={mode !== "info" ? true : undefined}
          >
            <ShopInfoPanel
              shop={catalog.shop}
              businessHours={catalog.businessHours}
            />
          </div>
        </div>
      </main>

      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0e0f11]/95 backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectMode(tab.id)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-colors",
                    active ? "bg-primary/15 text-primary" : "text-current"
                  )}
                >
                  <Icon className="size-[1.15rem]" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
