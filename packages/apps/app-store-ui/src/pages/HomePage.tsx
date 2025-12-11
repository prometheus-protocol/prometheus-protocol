import { useMemo } from 'react';
import { ServerGrid } from '@/components/ServerGrid';
import { ValuePropBanner } from '@/components/ValuePropBanner';
import { WinnerBanner } from '@/components/WinnerBanner';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { OfferBanner } from '@/components/OfferBanner';
import { PokedBotsBanner } from '@/components/PokedBotsBanner';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { truncatePrincipal } from '@/lib/utils';
import { useGetAppStoreListings } from '@/hooks/useAppStore';
import { AppStoreListing } from '@prometheus-protocol/ic-js';
import { HomePageSkeleton } from '@/components/HomePageSkeleton';
import { HomePageError } from '@/components/HomePageError';

// Hardcoded featured servers to always show at the front of the carousel
const FEATURED_NAMESPACES = [
  'io.github.jneums.pokedbots-racing',
  'io.github.jneums.final-score',
  'io.github.jneums.ext-wallet',
  'io.github.jneums.cycle-buddy',
  'org.prometheusprotocol.token-watchlist',
  'io.github.jneums.sui-wallet',
];

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
        (app) => app.latestVersion.securityTier === 'Gold',
      );
      const pendingApps = allServers.filter(
        (app) => app.latestVersion.securityTier === 'Unranked',
      );
      const otherListedApps = allServers.filter(
        (app) => app.latestVersion.status === 'Verified',
      );

      // 2. Create the list for the main carousel with hybrid approach:
      //    - Start with hardcoded featured servers (if they exist)
      //    - Fill remaining slots with gold tier apps and new releases
      const featuredApps = allServers.filter((app) =>
        FEATURED_NAMESPACES.includes(app.namespace),
      );

      // Get the featured servers in the order they're defined in FEATURED_NAMESPACES
      const orderedFeaturedApps = FEATURED_NAMESPACES.map((namespace) =>
        featuredApps.find((app) => app.namespace === namespace),
      ).filter((app): app is AppStoreListing => app !== undefined);

      // Add remaining gold apps and pending apps to fill out the carousel
      const remainingApps = [
        ...goldApps.filter(
          (app) => !FEATURED_NAMESPACES.includes(app.namespace),
        ),
        ...pendingApps.filter(
          (app) => !FEATURED_NAMESPACES.includes(app.namespace),
        ),
      ].slice(0, 6 - orderedFeaturedApps.length);

      const carouselApps = [...orderedFeaturedApps, ...remainingApps];

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

      <PokedBotsBanner />

      {/* --- Render sections with banners distributed evenly --- */}

      {comingSoonApps.length > 0 && (
        <ServerGrid title="New Releases" servers={comingSoonApps} />
      )}

      {/* Calculate how many category sections to show before each banner */}
      {(() => {
        const totalSections = categorySections.length;
        const totalBanners = 2; // WinnerBanner and PokedBotsBanner

        // Distribute categories evenly: split into 3 groups (before WinnerBanner, between banners, after PokedBotsBanner)
        const sectionsPerGroup = Math.ceil(totalSections / (totalBanners + 1));

        let renderedCount = 0;
        const result = [];

        // First group of categories
        const firstGroup = categorySections.slice(0, sectionsPerGroup);
        firstGroup.forEach((section) => {
          result.push(
            <ServerGrid
              key={section.title}
              title={section.title}
              servers={section.servers}
            />,
          );
        });
        renderedCount += firstGroup.length;

        // WinnerBanner after first group
        if (renderedCount < totalSections) {
          result.push(<ValuePropBanner key="value-prop-banner" />);
        }

        // Second group of categories
        const secondGroup = categorySections.slice(
          sectionsPerGroup,
          sectionsPerGroup * 2,
        );
        secondGroup.forEach((section) => {
          result.push(
            <ServerGrid
              key={section.title}
              title={section.title}
              servers={section.servers}
            />,
          );
        });
        renderedCount += secondGroup.length;

        // WinnerBanner after second group
        if (renderedCount < totalSections) {
          result.push(<WinnerBanner key="winner-banner" />);
        }

        // Third group of categories (remaining)
        const thirdGroup = categorySections.slice(sectionsPerGroup * 2);
        thirdGroup.forEach((section) => {
          result.push(
            <ServerGrid
              key={section.title}
              title={section.title}
              servers={section.servers}
            />,
          );
        });

        // If we didn't use all banners (fewer categories than expected), add them at the end
        if (renderedCount >= totalSections) {
          result.push(<ValuePropBanner key="value-prop-banner-fallback" />);
          result.push(<WinnerBanner key="winner-banner-fallback" />);
        }

        return result;
      })()}

      {/* OfferBanner moved to the bottom */}
      <OfferBanner />
    </div>
  );
}

export default HomePage;
