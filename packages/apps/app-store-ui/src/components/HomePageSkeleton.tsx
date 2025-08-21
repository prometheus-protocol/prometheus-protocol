import { Card, CardContent } from '@/components/ui/card';

// A skeleton for a single card in a standard grid (Correct, no changes needed)
const ServerCardSkeleton = () => (
  <div className="flex items-center gap-4 p-2 md:p-3">
    <div className="w-16 h-16 rounded-xl bg-muted/50" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-3/4 rounded bg-muted/50" />
      <div className="h-3 w-1/2 rounded bg-muted/50" />
    </div>
  </div>
);

// --- NEW: A skeleton for a single FEATURED card ---
// This accurately mimics the structure of the FeaturedServerCard component.
const FeaturedCardSkeleton = () => (
  <Card className="overflow-hidden border-transparent p-0">
    <CardContent className="p-0">
      {/* The large banner image */}
      <div className="aspect-[16/10] w-full rounded-3xl bg-muted" />
      {/* The info section below the banner */}
      <div className="py-4 flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-muted/50" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-1/2 rounded bg-muted/50" />
          <div className="h-3 w-1/3 rounded bg-muted/50" />
        </div>
        <div className="h-8 w-20 rounded-md bg-muted/50" />
      </div>
    </CardContent>
  </Card>
);

// --- CORRECTED: The skeleton for the carousel ---
// This is now a simple grid that displays three featured card skeletons.
const FeaturedCarouselSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <FeaturedCardSkeleton />
    <FeaturedCardSkeleton />
    <FeaturedCardSkeleton />
  </div>
);

// The main skeleton for the entire home page
export const HomePageSkeleton = () => {
  return (
    <div className="container w-full mx-auto animate-pulse">
      <section className="my-16">
        {/* Welcome Header Skeleton */}
        <div className="h-10 w-1/3 bg-muted rounded mb-12" />
        {/* Featured Carousel Skeleton (now a 3-column grid) */}
        <FeaturedCarouselSkeleton />
      </section>

      {/* Server Grid Skeleton (Unchanged) */}
      <section className="my-16">
        <div className="h-8 w-1/4 bg-muted rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
          <ServerCardSkeleton />
        </div>
      </section>
    </div>
  );
};
