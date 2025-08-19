import { ServerGrid } from '@/components/ServerGrid';
import { ValuePropBanner } from '@/components/ValuePropBanner';
import { PromoBanner } from '@/components/PromoBanner';
import { homepageServers, allServers } from '@/lib/mock-data';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { OfferBanner } from '@/components/OfferBanner';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { truncatePrincipal } from '@/lib/utils';

// In a real app, you'd fetch this data with React Query
const getSample = (amount: number) => {
  // Get random sample of servers
  if (amount > allServers.length) {
    throw new Error('Requested amount exceeds available servers');
  }
  // Shuffle the array and take the first 'amount' items
  const shuffled = allServers.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, amount);
};

const editorsChoiceServers = getSample(6);
const trendingServers = getSample(6);
const topPicksServers = getSample(6);

function HomePage() {
  const { identity } = useInternetIdentity();
  // In a real app, you'd use useAuth() here to get user info
  const userName = identity
    ? truncatePrincipal(identity.getPrincipal().toText())
    : 'Guest';

  return (
    <div className="w-full mx-auto">
      {/* This would be a personalized section, maybe shown only when logged in */}
      <section className="my-16">
        <h1 className="font-header text-4xl font-bold tracking-tight mb-12 uppercase">
          Welcome {userName}
        </h1>
        {/* The three large featured cards from the design would go here */}
        <FeaturedCarousel servers={homepageServers} />
      </section>

      <ValuePropBanner />

      {/* In a real app, this list would be personalized */}
      <ServerGrid title="Top Picks For You" servers={topPicksServers} />

      <PromoBanner
        imageUrl="/images/wchl-banner-1920.webp"
        altText="World Computer Hacker League 2025"
        linkTo="https://dorahacks.io/org/3634"
      />

      <ServerGrid title="Trending" servers={trendingServers} />

      <ServerGrid title="Editors Choice" servers={editorsChoiceServers} />

      <OfferBanner />
    </div>
  );
}

export default HomePage;
