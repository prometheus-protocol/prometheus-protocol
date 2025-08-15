export function OfferBanner() {
  return (
    <section className="bg-primary/80 rounded-2xl p-8 md:p-12 my-20 text-center">
      <img
        src="/images/pmp-token.webp"
        alt="Trust Owl Mascot"
        className="w-32 h-32 mx-auto mb-4"
      />
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
        Welcome to MCP!
      </h2>
      <p className="mt-2 text-3xl tracking-tight text-neutral-800">
        Sign up now and claim 250 bonus credits on your first app transaction.
      </p>
    </section>
  );
}
