export function ValuePropBanner() {
  return (
    <div className="relative w-full mx-auto my-12">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/15 via-orange-500/22 to-yellow-500/15 blur-3xl" />

      <div
        className="relative animate-in fade-in slide-in-from-bottom-8 duration-700"
        style={{ borderRadius: '54px' }}>
        {/* Main banner container */}
        <div
          className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-yellow-500/30 overflow-visible"
          style={{ borderRadius: '54px' }}>
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
            }}
          />

          {/* Main content */}
          <div className="relative px-8 sm:px-12 lg:px-16 py-12 sm:py-16 lg:py-20 flex items-center justify-between">
            <div className="flex-1 pr-20 sm:pr-32 lg:pr-48">
              <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                Get Peace of Mind with Verified Apps.
              </h2>
              <p className="text-gray-300 text-base sm:text-lg lg:text-xl max-w-3xl">
                Every app's source code and Wasm hash is built-verified and auditable—so you know it's legit.
              </p>
            </div>
            <img
              src="/images/prometheus.webp"
              alt="Trust Owl Mascot"
              className="w-28 h-28 sm:w-36 sm:h-36 lg:w-48 lg:h-48 absolute -right-2 -bottom-8 sm:-right-4 sm:-bottom-12 md:-right-6 md:-bottom-14 drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Bottom accent line */}
          <div className="h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
        </div>

        {/* Corner glow effects */}
        <div className="absolute -bottom-20 right-10 w-80 h-80 bg-orange-500/17 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -top-20 left-10 w-80 h-80 bg-yellow-500/17 rounded-full blur-3xl pointer-events-none animate-pulse" />
      </div>
    </div>
  );
}
