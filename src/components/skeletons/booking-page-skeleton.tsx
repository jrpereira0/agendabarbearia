import { Skeleton } from "@/components/ui/skeleton";

export function BookingPageSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="bg-foreground px-4 pb-8 pt-6 text-background sm:px-6 sm:pb-10 sm:pt-8">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
          <Skeleton className="size-16 rounded-2xl bg-background/20" />
          <Skeleton className="mt-4 h-7 w-48 bg-background/20" />
          <Skeleton className="mt-2 h-4 w-64 bg-background/20" />
          <div className="mt-5 flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="size-10 rounded-full bg-background/20"
              />
            ))}
          </div>
        </div>
      </div>
      <main className="relative flex-1 rounded-t-[1.75rem] bg-background px-4 pb-8 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border bg-muted/30 p-1">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-5 py-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
            </div>
            <div className="space-y-3 px-5 py-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
