import { Skeleton } from "@/components/ui/skeleton";

export function ComandaDialogSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,24rem)] lg:gap-5 lg:px-6">
      <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
          <div className="min-h-0 flex-1 divide-y">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            ))}
          </div>
          <div className="mt-auto space-y-2 border-t px-4 py-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden lg:border-l lg:pl-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-24 w-full shrink-0 rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
