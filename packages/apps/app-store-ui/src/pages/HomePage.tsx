import { ServerGrid } from '@/components/ServerGrid';
import { ValuePropBanner } from '@/components/ValuePropBanner';
import { PromoBanner } from '@/components/PromoBanner';
import { mockFeaturedServers, mockServers } from '@/lib/mock-data';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { OfferBanner } from '@/components/OfferBanner';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { truncatePrincipal } from '@/lib/utils';

// In a real app, you'd fetch this data with React Query
const editorsChoiceServers = mockServers.slice(0, 6);
const trendingServers = mockServers.slice(6, 12);

function HomePage() {
  const { identity } = useInternetIdentity();
  // In a real app, you'd use useAuth() here to get user info
  const userName = identity
    ? truncatePrincipal(identity.getPrincipal().toText())
    : 'Guest';

  return (
    <div className="w-full mx-auto">
      {/* This would be a personalized section, maybe shown only when logged in */}
      <section className="mb-16">
        <h1 className="font-header text-4xl font-bold tracking-tight mb-4 uppercase">
          Welcome {userName}
        </h1>
        {/* The three large featured cards from the design would go here */}
        <FeaturedCarousel servers={mockFeaturedServers} />
      </section>

      <ValuePropBanner />

      {/* In a real app, this list would be personalized */}
      <ServerGrid title="Top Picks For You" servers={editorsChoiceServers} />

      <PromoBanner
        imageUrl="/images/wchl-banner-1920.webp"
        altText="World Computer Hacker League 2025"
        linkTo="/events/wchl25"
      />

      <ServerGrid title="Trending" servers={trendingServers} />

      <ServerGrid title="Editors Choice" servers={editorsChoiceServers} />

      <OfferBanner />
    </div>
  );
}

export default HomePage;
