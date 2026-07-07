import { Skeleton } from "@/components/ui/skeleton";

export function ComandaDialogSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-3 h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="mt-auto grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
