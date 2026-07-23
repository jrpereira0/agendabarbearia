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
        className="agenda-grid-header grid w-full min-w-0 border-b"
        style={{
          gridTemplateColumns: `3rem repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        <div className="h-[4.25rem]" />
        {Array.from({ length: columns }).map((_, index) => (
          <div
            key={`head-${index}`}
            className="flex min-w-0 flex-col items-center justify-center gap-2 border-l px-1 py-2.5 sm:px-2"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-14 max-w-full" />
          </div>
        ))}
      </div>

      <div className="w-full min-w-0">
        {Array.from({ length: rowCount }).map((_, row) => (
          <div
            key={`row-${row}`}
            className="grid w-full min-w-0 border-t border-white/10 first:border-t-0"
            style={{
              gridTemplateColumns: `3rem repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            <div className="flex items-start justify-end px-1.5 py-2">
              <Skeleton className="h-2.5 w-7" />
            </div>
            {Array.from({ length: columns }).map((_, col) => (
              <div
                key={`cell-${row}-${col}`}
                className="min-w-0 border-l border-white/10 px-1 py-1"
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
