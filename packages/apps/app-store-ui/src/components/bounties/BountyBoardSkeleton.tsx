// src/components/bounties/BountyBoardSkeleton.tsx

const BountyListItemSkeleton = () => (
  <div className="border border-gray-700 rounded-lg mb-4 p-4">
    <div className="grid grid-cols-12 gap-4 w-full">
      {/* Project Info Skeleton */}
      <div className="col-span-12 md:col-span-7 space-y-2">
        <div className="h-5 w-1/2 bg-muted rounded" />
        <div className="h-4 w-full bg-muted/50 rounded" />
      </div>
      {/* Amount Skeleton */}
      <div className="col-span-6 md:col-span-3 flex items-center justify-start md:justify-end">
        <div className="h-5 w-16 bg-muted rounded" />
      </div>
      {/* Status Skeleton */}
      <div className="col-span-6 md:col-span-2 flex items-center justify-end">
        <div className="h-5 w-20 bg-muted rounded" />
      </div>
    </div>
  </div>
);

export const BountyBoardSkeleton = () => (
  <div className="w-full max-w-5xl mx-auto pt-16 pb-24 animate-pulse">
    {/* Header Skeleton */}
    <div className="h-4 w-1/4 bg-muted rounded mb-12" /> {/* Breadcrumbs */}
    <header className="mb-32 space-y-4">
      <div className="h-10 w-3/4 bg-muted rounded" /> {/* Title */}
      <div className="h-10 w-full max-w-3xl bg-muted/50 rounded" />{' '}
      {/* Subtitle */}
    </header>
    {/* Search Skeleton */}
    <div className="h-12 w-full bg-muted/50 rounded-lg mb-8" />
    {/* List Skeleton */}
    <div className="space-y-4">
      {/* List Header Skeleton */}
      <div className="hidden md:grid grid-cols-12 gap-4 pr-12 py-2">
        <div className="col-span-7 h-4 bg-muted/50 rounded" />
        <div className="col-span-3 h-4 bg-muted/50 rounded" />
        <div className="col-span-2 h-4 bg-muted/50 rounded" />
      </div>
      {/* List Items Skeleton */}
      <div>
        <BountyListItemSkeleton />
        <BountyListItemSkeleton />
        <BountyListItemSkeleton />
      </div>
    </div>
  </div>
);
