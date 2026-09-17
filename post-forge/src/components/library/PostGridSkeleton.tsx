import { Card, Skeleton } from "@/components/ui";

/** Skeleton grid shown while the Library's first page of results is loading. */
export function PostGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} noPadding className="overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton list shown while the Library's first page of results is loading, in list view. */
export function PostListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} noPadding className="flex items-center gap-4 p-3">
          <Skeleton className="h-14 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}
