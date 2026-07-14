import { useMemo } from 'react';
import { ServerGrid } from '@/components/ServerGrid';
import { ValuePropBanner } from '@/components/ValuePropBanner';
import { WinnerBanner } from '@/components/WinnerBanner';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { PokedBotsBanner } from '@/components/PokedBotsBanner';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { truncatePrincipal } from '@/lib/utils';
import { useGetAppStoreListings } from '@/hooks/useAppStore';
import { AppStoreListing } from '@prometheus-protocol/ic-js';
import { HomePageSkeleton } from '@/components/HomePageSkeleton';
import { HomePageError } from '@/components/HomePageError';

// Hardcoded featured servers to always show at the front of the carousel
const FEATURED_NAMESPACES = [
  'io.github.jneums.app-store-scout',
  'io.github.jneums.pokedbots-racing',
  'io.github.jneums.final-score',
  'io.github.jneums.secrets-manager',
  'io.github.jneums.encrypted-mailbox',
  'io.github.jneums.faucet-mcp',
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
  const {
    carouselApps,
    auditedVerifiedCodeApps,
    comingSoonApps,
    categorySections,
  } = useMemo(() => {
    if (!allServers || allServers.length === 0) {
      return {
        carouselApps: [],
        auditedVerifiedCodeApps: [],
        comingSoonApps: [],
        categorySections: [],
      };
    }

    // 1. Filter apps into primary groups
    const auditedApps = allServers.filter(
      (app) => app.latestVersion.securityTier === 'Gold',
    );
    const pendingApps = allServers.filter(
      (app) =>
        app.latestVersion.securityTier === 'Unranked' &&
        app.latestVersion.status === 'Pending',
    );
    const otherListedApps = allServers.filter(
      (app) =>
        app.latestVersion.status === 'Verified' ||
        app.latestVersion.status === 'External',
    );

    // 2. Create the list for the main carousel with hybrid approach:
    //    - Start with hardcoded featured servers (if they exist)
    //    - Fill remaining slots with audited verified code apps and new releases
    const featuredApps = allServers.filter((app) =>
      FEATURED_NAMESPACES.includes(app.namespace),
    );

    // Get the featured servers in the order they're defined in FEATURED_NAMESPACES
    const orderedFeaturedApps = FEATURED_NAMESPACES.map((namespace) =>
      featuredApps.find((app) => app.namespace === namespace),
    ).filter((app): app is AppStoreListing => app !== undefined);

    // Add remaining audited apps and pending apps to fill out the carousel
    const remainingApps = [
      ...auditedApps.filter(
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
      auditedVerifiedCodeApps: auditedApps,
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
        const totalBanners = 1; // ValuePropBanner in the middle

        // Distribute categories: split into 2 groups (before banner, after banner)
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

        // ValuePropBanner in the middle
        if (renderedCount < totalSections) {
          result.push(<ValuePropBanner key="value-prop-banner" />);
        }

        // Second group of categories (remaining)
        const secondGroup = categorySections.slice(sectionsPerGroup);
        secondGroup.forEach((section) => {
          result.push(
            <ServerGrid
              key={section.title}
              title={section.title}
              servers={section.servers}
            />,
          );
        });

        // If we didn't use the banner (no categories), add it anyway
        if (renderedCount >= totalSections) {
          result.push(<ValuePropBanner key="value-prop-banner-fallback" />);
        }

        return result;
      })()}

      {auditedVerifiedCodeApps.length > 0 && (
        <ServerGrid
          title="Audited Verified Code"
          servers={auditedVerifiedCodeApps}
        />
      )}

      {/* Discord CTA at the bottom */}
      <WinnerBanner />
    </div>
  );
}

export default HomePage;
