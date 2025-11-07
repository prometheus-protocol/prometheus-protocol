export const AuditDetailsSkeleton = () => (
  <div className="w-full max-w-6xl mx-auto pt-12 pb-24 animate-pulse">
    {/* Breadcrumbs Skeleton */}
    <div className="h-4 w-1/3 bg-muted rounded mb-12" />

    {/* Grid Layout matching the actual page */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16">
      {/* Left side: Content (2 columns) */}
      <div className="md:col-span-2 space-y-12">
        {/* Header Skeleton */}
        <header className="space-y-3">
          <div className="h-10 w-48 bg-muted rounded" /> {/* Audit #123 */}
          <div className="h-7 w-64 bg-muted/50 rounded" /> {/* Audit Type */}
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
      </div>

      {/* Right side: Bounty Panel Skeleton (1 column, hidden on mobile) */}
      <div className="md:col-span-1 hidden md:block">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6 sticky top-24">
          {/* Status Badge */}
          <div className="h-8 w-24 bg-muted rounded" />

          {/* Reward Amount */}
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted/50 rounded" />
            <div className="h-10 w-32 bg-muted rounded" />
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-muted/50 rounded" />
              <div className="h-4 w-16 bg-muted/50 rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-muted/50 rounded" />
              <div className="h-4 w-20 bg-muted/50 rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-28 bg-muted/50 rounded" />
              <div className="h-4 w-24 bg-muted/50 rounded" />
            </div>
          </div>

          {/* Action Button */}
          <div className="h-12 w-full bg-muted rounded-lg" />
        </div>
      </div>

      {/* Mobile Bounty Panel (shown on mobile before content) */}
      <div className="block md:hidden mb-16">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="h-8 w-24 bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted/50 rounded" />
            <div className="h-10 w-32 bg-muted rounded" />
          </div>
          <div className="h-12 w-full bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);
