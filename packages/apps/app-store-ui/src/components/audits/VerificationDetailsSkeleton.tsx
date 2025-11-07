export const VerificationDetailsSkeleton = () => (
  <div className="w-full max-w-6xl mx-auto pt-12 pb-24 animate-pulse">
    {/* Breadcrumbs Skeleton */}
    <div className="h-4 w-1/3 bg-muted rounded mb-12" />

    {/* Header Section */}
    <div className="mb-12 space-y-6">
      {/* WASM ID */}
      <div className="h-10 w-2/3 bg-muted rounded" />

      {/* Status Badge */}
      <div className="h-6 w-32 bg-muted/50 rounded" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted/50 rounded" />
          <div className="h-8 w-32 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted/50 rounded" />
          <div className="h-8 w-20 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 bg-muted/50 rounded" />
          <div className="h-8 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>

    {/* Progress Section */}
    <div className="bg-card rounded-lg border border-border p-6 mb-8 space-y-4">
      <div className="h-5 w-48 bg-muted rounded" />
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 bg-muted/50 rounded" />
          <div className="flex-1 h-3 bg-muted/30 rounded-full" />
          <div className="h-4 w-12 bg-muted/50 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 bg-muted/50 rounded" />
          <div className="flex-1 h-3 bg-muted/30 rounded-full" />
          <div className="h-4 w-12 bg-muted/50 rounded" />
        </div>
      </div>
      <div className="h-4 w-64 bg-muted/50 rounded mt-4" />
    </div>

    {/* Bounties Section */}
    <div className="space-y-6">
      <div className="h-6 w-48 bg-muted rounded" />

      {/* Bounty Cards Skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-4 w-48 bg-muted/50 rounded" />
              <div className="h-4 w-40 bg-muted/50 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-20 bg-muted rounded ml-auto" />
              <div className="h-4 w-24 bg-muted/50 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
