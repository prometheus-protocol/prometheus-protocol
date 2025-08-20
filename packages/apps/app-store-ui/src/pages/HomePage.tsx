import { useMemo } from 'react';
import { ServerGrid } from '@/components/ServerGrid';
import { ValuePropBanner } from '@/components/ValuePropBanner';
import { PromoBanner } from '@/components/PromoBanner';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { OfferBanner } from '@/components/OfferBanner';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { truncatePrincipal } from '@/lib/utils';
import { useGetAppStoreListings } from '@/hooks/useAppStore';
import { AppStoreListing } from '@prometheus-protocol/ic-js'; // Import the type for clarity

// A simple loading component placeholder
const HomePageSkeleton = () => <div>Loading App Store...</div>;
// A simple error component placeholder
const HomePageError = () => (
  <div>Error loading App Store. Please try again later.</div>
);

function HomePage() {
  // 1. Fetch the live data from our React Query hook
  const { data: allServers, isLoading, isError } = useGetAppStoreListings();
  const { identity } = useInternetIdentity();
  const userName = identity
    ? truncatePrincipal(identity.getPrincipal().toText())
    : 'Guest';

  // 2. Use `useMemo` to process the data once it's loaded.
  // This prevents re-calculating on every render.
  const { featuredApps, topPicks, trending, editorsChoice } = useMemo(() => {
    // If data is not yet available, return empty arrays to prevent crashes.
    if (!allServers || allServers.length === 0) {
      return {
        featuredApps: [],
        topPicks: [],
        trending: [],
        editorsChoice: [],
      };
    }

    // A helper function to get a random, shuffled sample from any array.
    const getSample = (source: AppStoreListing[], amount: number) => {
      const shuffled = [...source].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(amount, shuffled.length));
    };

    // --- MVP Logic for Populating UI Sections ---

    // Featured Carousel: Show up to 3 of the highest-tier (Gold) apps.
    const goldTierApps = allServers.filter(
      (app) => app.securityTier === 'Gold',
    );
    const featuredApps = getSample(goldTierApps, 3);

    // Editor's Choice: A random sample of high-quality (Gold or Silver) apps.
    const highQualityApps = allServers.filter(
      (app) => app.securityTier === 'Gold',
    );
    const editorsChoice = getSample(highQualityApps, 6);

    // Top Picks & Trending: For the MVP, these are random samples from all available apps.
    const topPicks = getSample(allServers, 6);
    const trending = getSample(allServers, 6);

    return { featuredApps, topPicks, trending, editorsChoice };
  }, [allServers]); // This memo will only re-run when `allServers` data changes.

  // 3. Handle loading and error states before rendering the main content.
  if (isLoading) {
    return <HomePageSkeleton />;
  }

  if (isError) {
    return <HomePageError />;
  }

  return (
    <div className="w-full mx-auto">
      <section className="my-16">
        <h1 className="font-header text-4xl font-bold tracking-tight mb-12 uppercase">
          Welcome {userName}
        </h1>
        {/* 4. Pass the processed live data to the components */}
        <FeaturedCarousel servers={trending} />
      </section>

      <ValuePropBanner />

      <ServerGrid title="Top Picks For You" servers={trending} />

      <PromoBanner
        imageUrl="/images/wchl-banner-1920.webp"
        altText="World Computer Hacker League 2025"
        linkTo="https://dorahacks.io/org/3634"
      />

      <ServerGrid title="Trending" servers={trending} />

      <ServerGrid title="Editors Choice" servers={trending} />

      <OfferBanner />
    </div>
  );
}

export default HomePage;
