import { useMemo } from 'react';
import { ServerGrid } from '@/components/ServerGrid';
import { ValuePropBanner } from '@/components/ValuePropBanner';
import { PromoBanner } from '@/components/PromoBanner';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { OfferBanner } from '@/components/OfferBanner';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { truncatePrincipal } from '@/lib/utils';
import { useGetAppStoreListings } from '@/hooks/useAppStore';
import { AppStoreListing } from '@prometheus-protocol/ic-js';
import { HomePageSkeleton } from '@/components/HomePageSkeleton';
import { HomePageError } from '@/components/HomePageError';

function HomePage() {
  const {
    data: allServers,
    isLoading,
    isError,
    refetch,
  } = useGetAppStoreListings();
  const { identity } = useInternetIdentity();
  const userName = identity
    ? truncatePrincipal(identity.getPrincipal().toText())
    : 'Guest';

  // --- REFACTORED: Process data into meaningful, data-driven sections ---
  const { carouselApps, goldTierApps, comingSoonApps, categorySections } =
    useMemo(() => {
      if (!allServers || allServers.length === 0) {
        return {
          carouselApps: [],
          goldTierApps: [],
          comingSoonApps: [],
          categorySections: [],
        };
      }

      // 1. Filter apps into primary groups
      const goldApps = allServers.filter(
        (app) =>
          app.latestVersion.status === 'Verified' &&
          app.latestVersion.securityTier === 'Gold',
      );
      const pendingApps = allServers.filter(
        (app) => app.latestVersion.status === 'Pending',
      );
      const otherListedApps = allServers.filter(
        (app) => app.latestVersion.status === 'Verified',
      );

      // 2. Create the list for the main carousel (mix of best and newest)
      const carouselApps = [
        ...goldApps.slice(0, 3),
        ...pendingApps.slice(0, 3),
      ].sort(() => 0.5 - Math.random());

      // 3. Group remaining listed apps by category
      const categoryMap = new Map<string, AppStoreListing[]>();
      otherListedApps.forEach((app) => {
        const category = app.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(app);
      });

      // Convert map to an array of objects for easier rendering
      const categorySections = Array.from(categoryMap.entries()).map(
        ([title, servers]) => ({
          title,
          servers,
        }),
      );

      return {
        carouselApps,
        goldTierApps: goldApps,
        comingSoonApps: pendingApps,
        categorySections,
      };
    }, [allServers]);

  if (isLoading) return <HomePageSkeleton />;
  if (isError) return <HomePageError onRetry={refetch} />;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <section className="my-16">
        <h1 className="font-header text-4xl font-bold tracking-tight mb-12 uppercase">
          Welcome {userName}
        </h1>
        {carouselApps.length > 0 && <FeaturedCarousel servers={carouselApps} />}
      </section>

      <ValuePropBanner />

      {/* --- Render the new, data-driven sections --- */}

      {goldTierApps.length > 0 && (
        <ServerGrid title="Gold Tier Apps" servers={goldTierApps} />
      )}

      <PromoBanner
        imageUrl="/images/wchl-banner-1920.webp"
        altText="World Computer Hacker League 2025"
        linkTo="https://dorahacks.io/org/3634"
      />

      {comingSoonApps.length > 0 && (
        <ServerGrid title="Coming Soon" servers={comingSoonApps} />
      )}

      {/* Dynamically render a grid for each category */}
      {categorySections.map((section) => (
        <ServerGrid
          key={section.title}
          title={section.title}
          servers={section.servers}
        />
      ))}

      <OfferBanner />
    </div>
  );
}

export default HomePage;
