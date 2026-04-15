export function WinnerBanner() {
  return (
    <div className="relative w-full mx-auto my-12 mb-24">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/15 via-yellow-500/22 to-orange-500/15 blur-3xl" />

      <div
        className="relative animate-in fade-in slide-in-from-bottom-8 duration-700 overflow-hidden"
        style={{ borderRadius: '54px' }}>
        {/* Main banner container */}
        <div
          className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden border-2 border-yellow-500/30"
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

          {/* Main content - Centered */}
          <div className="relative px-8 sm:px-12 lg:px-16 py-12 sm:py-16 lg:py-20 text-center">
            <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
              Join Our Community on Discord
            </h2>
            <p className="text-gray-300 text-base sm:text-lg lg:text-xl max-w-3xl mx-auto mb-8">
              Connect with our developers, get support, share your projects, and
              stay updated with the latest news.
            </p>
            <a
              href="https://discord.gg/gRehbTFZZ2"
              target="_blank"
              rel="noopener noreferrer">
              <button className="relative px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-gray-900 font-bold shadow-lg overflow-hidden group hover:shadow-orange-500/50 hover:scale-105 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <span className="relative">Join Now</span>
              </button>
            </a>
          </div>

          {/* Bottom accent line */}
          <div className="h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
        </div>

        {/* Corner glow effects */}
        <div className="absolute -bottom-20 right-10 w-80 h-80 bg-yellow-500/17 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -top-20 left-10 w-80 h-80 bg-orange-500/17 rounded-full blur-3xl pointer-events-none animate-pulse" />
      </div>
    </div>
  );
}
