"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, MapPinned } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
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
  const shop = catalog.shop;

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
  }

  return (
    <div className="booking-app-shell flex h-dvh flex-col overflow-hidden">
      <header className="relative z-20 shrink-0 border-b border-white/10 bg-[#0e0f11]/92 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-12 items-center gap-2.5 px-4">
          {shop.logoUrl ? (
            <div className="relative size-7 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#151618]">
              <Image
                src={shop.logoUrl}
                alt=""
                fill
                className="object-contain p-0.5"
                sizes="28px"
                unoptimized={shop.logoUrl.startsWith("/")}
                priority
              />
            </div>
          ) : (
            <BrandMark className="size-7 shrink-0" />
          )}
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight">
            {shop.name}
          </p>
        </div>
      </header>

      <main
        id="agendar"
        className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col"
      >
        <div id="meus-agendamentos" className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              "min-h-0 flex-1 flex-col",
              mode === "book" ? "flex" : "hidden"
            )}
            aria-hidden={mode !== "book"}
            inert={mode !== "book" ? true : undefined}
          >
            <BookingFlow catalog={catalog} today={today} />
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
              mode === "manage" ? "flex" : "hidden"
            )}
            aria-hidden={mode !== "manage"}
            inert={mode !== "manage" ? true : undefined}
          >
            <MyAppointments catalog={catalog} today={today} />
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
              mode === "info" ? "flex" : "hidden"
            )}
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
        className="relative z-20 shrink-0 border-t border-white/10 bg-[#0e0f11]/96 backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectMode(tab.id)}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium tracking-wide transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2.35 : 1.7}
                  absoluteStrokeWidth={false}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
