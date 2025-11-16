import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { useGetAppStoreListings } from '@/hooks/useAppStore';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Badge } from '../ui/badge';
import { ShieldCheck } from 'lucide-react';

interface SimilarAppsProps {
  // The ID is the hex string of the current app's WASM hash
  currentServerNamespace: string;
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
export function SimilarApps({ currentServerNamespace }: SimilarAppsProps) {
  const { data: allApps, isLoading, isError } = useGetAppStoreListings();

  // --- 2. THE LOGIC IS NOW SMARTER AND USES THE NEW SCHEMA ---
  const similarApps = useMemo(() => {
    if (!allApps || allApps.length < 2) return [];

    // First, find the current app to determine its category.
    const currentApp = allApps.find(
      (app) => app.namespace === currentServerNamespace,
    );

    // If for some reason the current app isn't in the list, fall back to showing any other apps.
    if (!currentApp) {
      return allApps
        .filter((app) => app.namespace !== currentServerNamespace)
        .slice(0, 6);
    }

    // A much better UX: "Similar" means "in the same category".
    return allApps
      .filter(
        (app) =>
          app.category === currentApp.category &&
          app.namespace !== currentServerNamespace, // Exclude the current app itself
      )
      .slice(0, 6); // Take up to 6 similar apps.
  }, [allApps, currentServerNamespace]);

  if (isLoading) {
    return <SimilarAppsSkeleton />;
  }
  if (isError || similarApps.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight md:mt-0 mt-10 mb-5">
        Similar Apps
      </h2>
      <div className="space-y-2">
        {similarApps.map((app) => {
          // --- 3. THE RENDER LOGIC NOW ACCESSES THE NESTED `latestVersion` OBJECT ---
          const { latestVersion } = app;
          const tierInfo = getTierInfo(latestVersion.securityTier);

          return (
            <Link
              // Use the stable namespace for the React key and the URL.
              key={app.namespace}
              to={`/app/${app.namespace}`}
              className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-muted/50 -mx-2">
              <ImageWithFallback
                src={app.iconUrl} // This is a stable, top-level property.
                alt={app.name}
                className="w-11 h-11 rounded-md"
              />
              <div className="flex-1">
                <h3 className="font-semibold leading-tight">{app.name}</h3>
                <p className="text-sm text-muted-foreground">{app.category}</p>
              </div>

              {/* 2. Use a proper, contextual status badge */}
              <div className="mr-1.5">
                {app.latestVersion.status === 'Pending' ? (
                  // --- Badge for PENDING apps ---
                  <Badge
                    variant="secondary"
                    className="text-xs bg-grey-900/50 border-grey-700 text-grey-300">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Build Verified
                  </Badge>
                ) : (
                  // --- Badge for LISTED apps ---
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      tierInfo.borderColorClass,
                      tierInfo.textColorClass,
                    )}>
                    <tierInfo.Icon className="h-3 w-3 mr-1" />
                    {tierInfo.name}
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
