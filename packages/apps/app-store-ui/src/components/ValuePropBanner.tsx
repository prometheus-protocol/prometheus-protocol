export function ValuePropBanner() {
  return (
    <section
      className="bg-primary/90 p-8 py-16 md:p-12 my-20 flex items-center justify-between relative"
      style={{ borderRadius: '54px' }}>
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          Get Peace of Mind with Verified Apps.
        </h2>
        <p className="mt-2 text-xl md:text-2xl tracking-tight text-neutral-800 max-w-3xl">
          Each app's ribbon—Gold, Silver, or Bronze—reflects its score in our
          standardized security audits. Check the ribbon for instant trust.
        </p>
      </div>
      <img
        src="/images/prometheus.webp"
        alt="Trust Owl Mascot"
        className="w-32 h-32 lg:w-54 lg:h-54  absolute right-0 -bottom-16 md:right-0 md:-bottom-12"
      />
    </section>
  );
}
