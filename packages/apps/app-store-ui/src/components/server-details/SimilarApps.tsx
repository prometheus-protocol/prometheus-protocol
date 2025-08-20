import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { useGetAppStoreListings } from '@/hooks/useAppStore';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';

interface SimilarAppsProps {
  // The ID is the hex string of the current app's WASM hash
  currentServerId: string;
}

// A simple skeleton for the sidebar
const SimilarAppsSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-8 w-48 bg-muted rounded mb-5 mt-10"></div>
    <div className="space-y-2">
      <div className="flex items-center gap-4 p-2">
        <div className="w-12 h-12 rounded-lg bg-muted"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded"></div>
          <div className="h-3 w-1/2 bg-muted rounded"></div>
        </div>
      </div>
      {/* Repeat for a few items */}
      <div className="flex items-center gap-4 p-2">
        <div className="w-12 h-12 rounded-lg bg-muted"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded"></div>
          <div className="h-3 w-1/2 bg-muted rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

export function SimilarApps({ currentServerId }: SimilarAppsProps) {
  // 1. Fetch the master list of all apps. This will likely be cached by React Query.
  const { data: allApps, isLoading, isError } = useGetAppStoreListings();

  // 2. Use `useMemo` to efficiently calculate the list of similar apps.
  const similarApps = useMemo(() => {
    if (!allApps) return [];

    // Filter out the current app and take the first 3 results.
    return allApps.filter((app) => app.id !== currentServerId).slice(0, 3);
  }, [allApps, currentServerId]); // Recalculate only when the data or current server changes.

  // 3. Handle loading, error, and empty states.
  if (isLoading) {
    return <SimilarAppsSkeleton />;
  }

  // Don't render the section if the fetch failed or if there are no similar apps to show.
  if (isError || similarApps.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mt-10 mb-5">
        Similar apps
      </h2>
      <div className="space-y-2">
        {similarApps.map((app) => {
          // 4. Get dynamic tier info and the correct link URL from the live data.
          const tierInfo = getTierInfo(app.securityTier);
          const appWasmHash = app.id; // This is the unique identifier for the app
          const isCertified = app.securityTier !== 'Unranked';

          return (
            <Link
              key={appWasmHash}
              to={`/server/${appWasmHash}`} // Use the wasm hash for the link
              className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-muted/50 -mx-2">
              <ImageWithFallback
                src={app.iconUrl}
                alt={app.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h3 className="font-semibold leading-tight">{app.name}</h3>
                <p className="text-sm text-muted-foreground">{app.category}</p>
              </div>

              {isCertified && (
                <tierInfo.Icon
                  className={cn('w-5 h-5', tierInfo.textColorClass)}
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
