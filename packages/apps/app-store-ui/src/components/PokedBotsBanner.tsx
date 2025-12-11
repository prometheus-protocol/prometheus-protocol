import { Zap, Trophy, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PokedBotsBanner() {
  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-12">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/30 to-red-500/20 blur-3xl" />

      <div className="relative animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Main banner container */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl overflow-hidden border-2 border-yellow-500/30">
          {/* Inner container */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl overflow-hidden">
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
            <div className="relative px-4 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
              {/* Left side - Logo */}
              <div className="relative flex-shrink-0 w-full lg:w-auto flex justify-center lg:justify-start">
                {/* Logo glow effect */}
                <div
                  className="absolute inset-0 blur-2xl opacity-40 animate-pulse"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)',
                  }}
                />

                <img
                  src="/images/pokedbots-logo.webp"
                  alt="PokedBots Racing"
                  className="relative w-64 sm:w-72 md:w-80 lg:w-96 h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    console.error('Failed to load PokedBots logo');
                    e.currentTarget.style.border = '2px solid red';
                  }}
                />
              </div>

              {/* Right side - Content */}
              <div className="flex-1 space-y-6 lg:space-y-8 text-center lg:text-left w-full">
                {/* New Release Badge */}
                <div className="flex justify-center lg:justify-start">
                  <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 sm:px-6 py-2 rounded-full inline-flex items-center gap-2 text-sm sm:text-base shadow-lg shadow-red-500/50 animate-pulse">
                    <Zap className="size-4" />
                    <span className="text-white font-semibold">NEW RELEASE</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-3 lg:space-y-4">
                  <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 text-3xl sm:text-4xl lg:text-5xl font-bold">
                    Race Through The Wasteland
                  </h2>
                  <p className="text-gray-300 text-base sm:text-lg lg:text-xl max-w-xl mx-auto lg:mx-0">
                    Race your PokedBots in the wasteland. Upgrade with scrap
                    parts, compete in events, and win ICP prizes.
                  </p>
                </div>

                {/* Feature highlights */}
                <div className="flex flex-wrap gap-3 sm:gap-4 lg:gap-6 justify-center lg:justify-start">
                  {[
                    { icon: Zap, text: 'Fast-Paced Racing' },
                    { icon: Wrench, text: 'Upgrade System' },
                    { icon: Trophy, text: 'Win ICP Prizes' },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-gray-800/50 px-3 sm:px-4 py-2 rounded-lg border border-yellow-500/20 hover:border-yellow-500/40 hover:scale-105 transition-all duration-300"
                    >
                      <feature.icon className="size-4 sm:size-5 text-yellow-400" />
                      <span className="text-gray-300 text-xs sm:text-sm">
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center lg:justify-start">
                  <Link to="/app/io.github.jneums.pokedbots-racing">
                    <button className="relative px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-gray-900 font-bold shadow-lg overflow-hidden group w-full sm:w-auto hover:shadow-yellow-500/50 hover:scale-105 transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                      <span className="relative flex items-center justify-center gap-2">
                        <Zap className="size-5" />
                        Play Now
                      </span>
                    </button>
                  </Link>

                  <Link to="/app/io.github.jneums.pokedbots-racing">
                    <button className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500 hover:scale-105 transition-all duration-300 w-full sm:w-auto font-semibold">
                      Learn More
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom accent line */}
            <div className="h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
          </div>
        </div>

        {/* Corner glow effects */}
        <div className="absolute -bottom-20 right-10 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -top-20 left-10 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  );
}
