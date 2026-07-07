import { Skeleton } from "@/components/ui/skeleton";

export function AppointmentCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-end justify-between gap-3 border-b bg-muted/20 px-4 py-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-3 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </li>
      ))}
    </ul>
  );
}
