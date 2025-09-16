import { Link } from 'react-router-dom';
import { PromoBadge } from './ui/promo-badge';
import { Button } from '@/components/ui/button'; // Import the Button component

export function OfferBanner() {
  return (
    <section className="bg-primary/90 rounded-4xl p-8 md:p-12 my-20 text-center relative [perspective:10000px]">
      <img
        src="/images/usdc.svg"
        alt="USDC Token"
        className="
            w-28 h-28 mx-auto mb-6 
            [animation:var(--animate-flip-pause)]
            [transform-style:preserve-3d]
          "
      />
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
        Build on Prometheus Protocol and earn USDC
      </h2>
      <p className="mt-2 text-xl md:text-2xl tracking-tight text-neutral-800 max-w-2xl mx-auto">
        Explore our public bounty board for paid opportunities. Contribute to
        the ecosystem and get rewarded for your skills.
      </p>
      {/* --- NEW: Call-to-action button linking to the bounty board --- */}
      <Button asChild size="lg" variant="secondary" className="mt-6 font-bold">
        <Link to="/bounties">Explore Bounties</Link>
      </Button>
      {/* --- UPDATED: Badge is now more relevant --- */}
      <PromoBadge>For Developers</PromoBadge>
    </section>
  );
}
