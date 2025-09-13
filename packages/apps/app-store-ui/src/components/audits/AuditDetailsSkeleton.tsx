export const AuditDetailsSkeleton = () => (
  <div className="w-full max-w-6xl mx-auto pt-12 pb-24 animate-pulse">
    {/* Breadcrumbs Skeleton */}
    <div className="h-4 w-1/3 bg-muted rounded mb-8" />

    {/* Balance Skeleton */}
    <div className="h-4 w-24 bg-muted/50 rounded ml-auto mb-8" />

    {/* Header Skeleton */}
    <header className="mb-12">
      <div className="h-10 w-3/4 bg-muted rounded" />
    </header>

    {/* Main Content Skeleton */}
    <div className="space-y-10">
      {/* Details Section Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-1/2 bg-muted/50 rounded" />
        <div className="h-6 w-1/3 bg-muted/50 rounded" />
        <div className="h-6 w-1/2 bg-muted/50 rounded" />
        <div className="h-6 w-2/3 bg-muted/50 rounded" />
        <div className="h-6 w-1/3 bg-muted/50 rounded" />
      </div>

      {/* Key Requirements Skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-1/4 bg-muted rounded" />
        <div className="h-5 w-full max-w-md bg-muted/50 rounded" />
        <div className="h-5 w-full max-w-lg bg-muted/50 rounded" />
        <div className="h-5 w-full max-w-sm bg-muted/50 rounded" />
      </div>

      {/* Resources Skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-1/5 bg-muted rounded" />
        <div className="h-5 w-1/3 bg-muted/50 rounded" />
      </div>
    </div>

    {/* Action Button Skeleton */}
    <div className="mt-16 flex justify-center">
      <div className="h-14 w-40 bg-muted rounded-lg" />
    </div>
  </div>
);
