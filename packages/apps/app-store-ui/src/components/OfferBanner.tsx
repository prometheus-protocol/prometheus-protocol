import { Link } from 'react-router-dom';
import { PromoBadge } from './ui/promo-badge';

export function OfferBanner() {
  return (
    <section className="bg-primary/80 rounded-4xl p-8 md:p-12 my-20 text-center relative [perspective:10000px]">
      <img
        src="/images/pmp-token.webp"
        alt="MCP Token"
        className="
            w-28 h-28 mx-auto mb-6 
            [animation:var(--animate-flip-pause)]
            [transform-style:preserve-3d]
          "
      />
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
        Welcome to MCP!
      </h2>
      <p className="mt-2 text-2xl md:text-3xl tracking-tight text-neutral-800">
        Publish your first MCP server now and claim 250 bonus credits when it
        goes live.
      </p>
      <PromoBadge>Special Offer</PromoBadge>
    </section>
  );
}
