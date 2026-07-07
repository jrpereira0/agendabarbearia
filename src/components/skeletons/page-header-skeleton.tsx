import { Skeleton } from "@/components/ui/skeleton";

type PageHeaderSkeletonProps = {
  withBack?: boolean;
  withAction?: boolean;
};

export function PageHeaderSkeleton({
  withBack = false,
  withAction = true,
}: PageHeaderSkeletonProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        {withBack && <Skeleton className="h-8 w-24" />}
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-9 w-28 shrink-0" />}
    </div>
  );
}
