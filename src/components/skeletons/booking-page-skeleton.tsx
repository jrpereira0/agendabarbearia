import { Skeleton } from "@/components/ui/skeleton";
import "@/styles/booking-theme.css";

export function BookingPageSkeleton() {
  return (
    <div className="booking-theme relative h-dvh overflow-hidden">
      <div className="booking-app-shell flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
        <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-5 pb-2 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-1.5 w-7 rounded-full bg-primary/70" />
                  <Skeleton className="size-1.5 rounded-full bg-white/20" />
                  <Skeleton className="size-1.5 rounded-full bg-white/20" />
                  <Skeleton className="size-1.5 rounded-full bg-white/20" />
                </div>
                <Skeleton className="h-3 w-10 bg-white/15" />
              </div>
              <Skeleton className="mt-2.5 h-7 w-52 max-w-full bg-white/15" />
              <Skeleton className="mt-2 h-4 w-64 max-w-full bg-white/10" />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-5 pt-2 pb-2">
              <div className="grid grid-cols-2 content-start gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#151618] px-2 py-2.5 ring-1 ring-white/8"
                  >
                    <Skeleton className="size-14 rounded-full bg-white/10" />
                    <Skeleton className="h-3.5 w-16 bg-white/12" />
                    {index === 0 ? (
                      <Skeleton className="h-2.5 w-20 bg-white/8" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative shrink-0 px-5 pb-3 pt-1">
              <Skeleton className="h-12 w-full rounded-2xl bg-primary/35" />
            </div>
          </div>
        </main>

        <nav
          aria-hidden
          className="relative z-20 shrink-0 border-t border-white/10 bg-[#0e0f11]"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 px-1 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1"
              >
                <Skeleton className="size-[22px] rounded-md bg-white/12" />
                <Skeleton className="h-2 w-10 bg-white/10" />
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
