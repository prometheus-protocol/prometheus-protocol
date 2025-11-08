import { Link } from 'react-router-dom';
import { PromoBadge } from './ui/promo-badge';
import { Button } from '@/components/ui/button';
import { BadgeCheck } from 'lucide-react';

export function OfferBanner() {
  return (
    <section
      className="bg-primary/90 p-8 md:p-12 my-20 text-center relative [perspective:10000px] border-primary border-4"
      style={{ borderRadius: '54px' }}>
      <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center [animation:var(--animate-flip-pause)] [transform-style:preserve-3d]">
        <BadgeCheck className="w-16 h-16 text-white" />
      </div>
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
        Build a Gold Verified Server and earn $500
      </h2>
      <p className="mt-2 text-xl md:text-2xl tracking-tight text-neutral-800 max-w-2xl mx-auto">
        Join our elite developer program. Create high-quality MCP servers that
        meet our rigorous standards and get rewarded for your excellence.
      </p>
      <Button asChild size="lg" variant="secondary" className="mt-6 font-bold">
        <Link to="/gold-verified-server">Apply for Gold Verified</Link>
      </Button>
      <PromoBadge>$500 Reward</PromoBadge>
    </section>
  );
}
