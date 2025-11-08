import { PromoBadge } from './ui/promo-badge';

export function WinnerBanner() {
  return (
    <section
      className="rounded-4xl py-16 p-8 md:py-20 md:p-12 my-20 flex items-center justify-between relative border-4 border-primary"
      style={{ backgroundColor: '#1a131a' }}>
      <div className="relative z-10 pr-4">
        <h2 className="text-3xl font-bold tracking-tight text-primary">
          1st Place Winner — World Computer Hackathon League Global Finale!
        </h2>
        <p className="mt-3 text-xl md:text-2xl tracking-tight text-neutral-300 max-w-3xl">
          We're honored and grateful for this achievement. Thank you to our
          incredible team, mentors, and community for your support!
        </p>
      </div>
      <img
        src="/images/wchl-winner-owl.webp"
        alt="Winner Owl with Trophy"
        className="w-32 h-32 lg:w-54 lg:h-54 absolute right-0 -bottom-16 md:right-0 md:-bottom-12"
      />
      <PromoBadge className="absolute -top-px -left-px">
        Exciting Update!
      </PromoBadge>
    </section>
  );
}
