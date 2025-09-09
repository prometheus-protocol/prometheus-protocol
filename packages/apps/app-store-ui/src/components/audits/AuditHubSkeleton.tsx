const AuditListItemSkeleton = () => (
  <div className="grid grid-cols-12 gap-4 items-center px-4 py-4 border border-gray-700 rounded-lg">
    {/* Project Name Skeleton */}
    <div className="col-span-4 h-5 bg-muted rounded" />
    {/* Audit Type Skeleton */}
    <div className="col-span-2 h-5 bg-muted/50 rounded" />
    {/* Reward Skeleton */}
    <div className="col-span-2 h-5 bg-muted rounded ml-auto w-20" />
    {/* Stake Skeleton */}
    <div className="col-span-1 h-5 bg-muted/50 rounded ml-auto w-12" />
    {/* Status Skeleton */}
    <div className="col-span-2 h-5 bg-muted rounded mx-auto w-24" />
    {/* Action Skeleton */}
    <div className="col-span-1 h-5 bg-muted/50 rounded ml-auto w-10" />
  </div>
);

export const AuditHubSkeleton = () => (
  <div className="w-full max-w-5xl mx-auto pt-12 pb-24 animate-pulse">
    {/* Header Skeleton */}
    <div className="h-4 w-1/4 bg-muted rounded mb-8" /> {/* Breadcrumbs */}
    <header className="mb-18 space-y-4">
      <div className="h-10 w-1/2 bg-muted rounded" /> {/* Title */}
      <div className="h-6 w-3/4 max-w-3xl bg-muted/50 rounded" />{' '}
      {/* Subtitle */}
    </header>
    {/* Search Skeleton */}
    <div className="h-12 w-full bg-muted/50 rounded-lg mb-8" />
    {/* List Skeleton */}
    <div className="space-y-3">
      {/* List Header Skeleton */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2">
        <div className="col-span-4 h-4 bg-muted/50 rounded" />
        <div className="col-span-2 h-4 bg-muted/50 rounded" />
        <div className="col-span-2 h-4 bg-muted/50 rounded" />
        <div className="col-span-1 h-4 bg-muted/50 rounded" />
        <div className="col-span-2 h-4 bg-muted/50 rounded" />
        <div className="col-span-1 h-4 bg-muted/50 rounded" />
      </div>

      {/* List Items Skeleton */}
      <div className="space-y-3">
        <AuditListItemSkeleton />
        <AuditListItemSkeleton />
        <AuditListItemSkeleton />
        <AuditListItemSkeleton />
      </div>
    </div>
  </div>
);
