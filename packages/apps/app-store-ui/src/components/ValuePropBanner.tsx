export function ValuePropBanner() {
  return (
    <section className="bg-primary/80 rounded-2xl p-8 md:p-12 my-20 flex items-center justify-between relative">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          Get Peace of Mind with Verified Apps.
        </h2>
        <p className="mt-2 text-2xl max-w-3xl text-neutral-800">
          Each app’s ribbon—Gold, Silver, or Bronze—reflects its score in our
          standardized security audits. Check the ribbon for instant trust.
        </p>
      </div>
      <img
        src="/images/promie.png"
        alt="Trust Owl Mascot"
        className="w-32 h-32 lg:w-54 lg:h-54  absolute right-0 -bottom-16 md:right-8 md:-bottom-12"
      />
    </section>
  );
}
