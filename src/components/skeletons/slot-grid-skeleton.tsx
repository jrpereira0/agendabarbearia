import { Skeleton } from "@/components/ui/skeleton";

export function SlotGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-lg" />
      ))}
    </div>
  );
}
