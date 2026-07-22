import { Skeleton } from "@/components/ui/skeleton";

export function AdminAgendaSkeleton() {
  return (
    <div className="admin-agenda -m-4 min-h-[calc(100dvh-8rem)] md:-m-8">
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden border-b border-white/10 bg-[var(--agenda-bg,#0e0f11)] lg:border-0 lg:p-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 md:px-6">
          <Skeleton className="size-8 rounded-md bg-white/10" />
          <Skeleton className="h-8 w-16 bg-white/10" />
          <Skeleton className="size-8 rounded-md bg-white/10" />
          <Skeleton className="ml-2 h-6 w-40 bg-white/10" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-24 bg-white/10" />
            <Skeleton className="h-8 w-28 bg-white/10" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5">
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[var(--agenda-elevated,#151618)] p-3">
            <div className="grid grid-cols-[3.25rem_repeat(4,minmax(0,1fr))] gap-px">
              <Skeleton className="h-14 bg-white/8" />
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 bg-white/8" />
              ))}
              {Array.from({ length: 10 }).map((_, row) => (
                <div key={row} className="contents">
                  <Skeleton className="h-10 bg-white/5" />
                  {Array.from({ length: 4 }).map((_, col) => (
                    <Skeleton key={col} className="h-10 rounded-sm bg-white/5" />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden w-72 shrink-0 space-y-3 lg:block">
            <Skeleton className="h-64 w-full rounded-2xl bg-white/8" />
            <Skeleton className="h-28 w-full rounded-2xl bg-white/8" />
            <Skeleton className="h-20 w-full rounded-2xl bg-white/8" />
          </div>
        </div>
      </div>
    </div>
  );
}
