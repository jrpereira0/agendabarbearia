import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AgendaGridSkeletonProps = {
  professionalCount?: number;
  rowCount?: number;
  className?: string;
};

export function AgendaGridSkeleton({
  professionalCount = 3,
  rowCount = 12,
  className,
}: AgendaGridSkeletonProps) {
  const columns = Math.max(1, Math.min(professionalCount, 6));

  return (
    <div
      className={cn(
        "agenda-grid-shell animate-in fade-in duration-300 overflow-hidden rounded-2xl border",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Carregando agenda do dia"
    >
      <div
        className="agenda-grid-header grid min-w-max border-b"
        style={{
          gridTemplateColumns: `3.25rem repeat(${columns}, minmax(7.5rem, 1fr))`,
        }}
      >
        <div className="h-[4.25rem]" />
        {Array.from({ length: columns }).map((_, index) => (
          <div
            key={`head-${index}`}
            className="flex flex-col items-center justify-center gap-2 border-l px-2 py-2.5"
          >
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-3 w-14 max-w-full" />
          </div>
        ))}
      </div>

      <div className="min-w-max">
        {Array.from({ length: rowCount }).map((_, row) => (
          <div
            key={`row-${row}`}
            className="grid border-t border-white/10 first:border-t-0"
            style={{
              gridTemplateColumns: `3.25rem repeat(${columns}, minmax(7.5rem, 1fr))`,
            }}
          >
            <div className="flex items-start justify-end px-1.5 py-2">
              <Skeleton className="h-2.5 w-7" />
            </div>
            {Array.from({ length: columns }).map((_, col) => (
              <div
                key={`cell-${row}-${col}`}
                className="border-l border-white/10 px-1 py-1"
              >
                <Skeleton
                  className={cn(
                    "h-3 w-full rounded-sm",
                    col % 3 === 0 && "opacity-40",
                    col % 3 === 1 && "opacity-55",
                    col % 3 === 2 && "opacity-70"
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
