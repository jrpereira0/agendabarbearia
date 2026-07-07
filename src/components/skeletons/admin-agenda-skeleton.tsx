import { Skeleton } from "@/components/ui/skeleton";

export function AdminAgendaSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-6">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="ml-2 h-6 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="hidden w-56 shrink-0 border-r p-4 lg:block">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <div className="grid grid-cols-[4rem_repeat(5,minmax(0,1fr))] gap-2">
            <Skeleton className="h-8" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8" />
            ))}
            {Array.from({ length: 12 }).map((_, row) => (
              <div key={row} className="contents">
                <Skeleton className="h-14" />
                {Array.from({ length: 5 }).map((_, col) => (
                  <Skeleton key={col} className="h-14 rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
