import { Link } from 'react-router-dom';
import { Award, Trophy } from 'lucide-react';
import Token from '@/components/Token';
import { useEffect, useRef } from 'react';
import JSConfetti from 'js-confetti';

// --- MOCK DATA ---
// This simulates the data structure you'd get from a leaderboard canister.
const leaderboardData = [
  {
    rank: 1,
    principalId: 'lintek-pag3x',
    avatarSeed: 'lintek',
    points: 0.0001,
  },
  {
    rank: 2,
    principalId: 'tarkon-miv8c',
    avatarSeed: 'tarkon',
    points: 0.0001,
  },
  {
    rank: 3,
    principalId: 'grovix-sol9r',
    avatarSeed: 'grovix',
    points: 0.0001,
  },
  {
    rank: 4,
    principalId: 'glimra-pov2c',
    avatarSeed: 'glimra',
    points: 0.0001,
  },
  {
    rank: 5,
    principalId: 'zunloy-ke8xq',
    avatarSeed: 'zunloy',
    points: 0.0001,
  },
  {
    rank: 6,
    principalId: 'nexlor-vub9j',
    avatarSeed: 'nexlor',
    points: 0.0001,
  },
  {
    rank: 7,
    principalId: 'fentra-qaz1w',
    avatarSeed: 'fentra',
    points: 0.0001,
  },
  {
    rank: 8,
    principalId: 'vortex-lep5d',
    avatarSeed: 'vortex',
    points: 0.0001,
  },
  {
    rank: 9,
    principalId: 'mavern-tos7y',
    avatarSeed: 'mavern',
    points: 0.0001,
  },
  {
    rank: 10,
    principalId: 'draxil-vek2u',
    avatarSeed: 'draxil',
    points: 0.0001,
  },
];
// --- SUB-COMPONENTS for the Leaderboard ---

// --- 1. Create a style map with FULL class names ---
const tierStyles = {
  Champion: {
    border: 'border-primary',
    text: 'text-primary',
    icon: <Trophy className="h-6 w-6 text-primary" />,
  },
  Silver: {
    border: 'border-gray-500', // Using 500 for better visibility than 600
    text: 'text-gray-500',
    icon: <Award className="h-6 w-6 text-gray-500" />,
  },
  Bronze: {
    border: 'border-yellow-700',
    text: 'text-yellow-700',
    icon: <Award className="h-6 w-6 text-yellow-700" />,
  },
};

const LeaderboardPodium = ({
  topThree,
}: {
  topThree: typeof leaderboardData;
}) => {
  const [champion, silver, bronze] = topThree;

  // 1. Create a ref to hold the JSConfetti instance.
  // This ensures it's created only once for the component's lifecycle.
  const jsConfettiRef = useRef<JSConfetti | null>(null);

  // 2. Use useEffect to initialize and trigger the confetti on mount.
  useEffect(() => {
    // Initialize the confetti instance and store it in the ref
    jsConfettiRef.current = new JSConfetti();

    // Trigger the confetti animation with custom champion colors
    jsConfettiRef.current.addConfetti({
      confettiColors: [
        '#ffd700', // Gold
        '#f5a623', // Orange-Gold
        '#f8e71c', // Bright Yellow
        '#ffffff', // White
        '#f0f0f0', // Light Gray
      ],
      confettiRadius: 5,
      confettiNumber: 400,
    });

    // 3. Return a cleanup function to clear the canvas when the component unmounts.
    return () => {
      jsConfettiRef.current?.clearCanvas();
    };
  }, []); // The empty dependency array [] ensures this effect runs only once.

  const podiumCard = (
    entry: (typeof leaderboardData)[0],
    tier: 'Champion' | 'Silver' | 'Bronze',
  ) => {
    const isChampion = tier === 'Champion';
    // --- 2. Get the style object for the current tier ---
    const styles = tierStyles[tier];

    return (
      <>
        <div
          className={
            // --- 3. Apply the full class name directly ---
            `flex flex-col items-center justify-center p-4 border-2 rounded-2xl text-center transition-all shadow-lg shadow-primary/20
          ${styles.border}
          ${isChampion ? 'relative mt-8 md:-top-8 md:scale-105' : ''}`
          }>
          {tier === 'Champion' && (
            <img
              src="/images/btc-owl.png"
              alt="Champion Owl"
              className="w-26 h-26 mb-4 mx-auto absolute -top-26"
            />
          )}
          <div className="flex w-full gap-2 mb-4">
            {styles.icon}
            <h3
              className={
                // --- 4. Apply the full text color class name ---
                `text-lg font-bold uppercase tracking-wider ${styles.text}`
              }>
              {tier}
            </h3>
          </div>
          <img
            src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${entry.avatarSeed}`}
            alt="Avatar"
            className="w-20 h-20 rounded-full mb-4 bg-gray-800 p-1"
          />
          <p className={`font-mono text-lg ${styles.text}`}>
            {entry.principalId}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-gray-400">{entry.points}</span>
            <Token className="h-5" />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-8 items-end mb-24">
      <div className="md:order-2">{podiumCard(champion, 'Champion')}</div>
      <div className="md:order-1">{podiumCard(silver, 'Silver')}</div>
      <div className="md:order-3">{podiumCard(bronze, 'Bronze')}</div>
    </div>
  );
};

const LeaderboardList = ({ rest }: { rest: typeof leaderboardData }) => (
  <div className="space-y-3">
    {/* Header */}
    <div className="grid grid-cols-12 gap-4 px-6 py-2 text-gray-500 font-semibold uppercase text-sm">
      <div className="col-span-2">Rank</div>
      <div className="col-span-6">Name</div>
      <div className="col-span-4 text-right">Points</div>
    </div>
    {/* Rows */}
    {rest.map((entry) => (
      <div
        key={entry.rank}
        className="grid grid-cols-12 gap-4 items-center px-6 py-4 border border-gray-400 rounded-lg">
        <div className="col-span-2 font-bold text-lg text-gray-400">
          #{entry.rank}
        </div>
        <div className="col-span-6 flex items-center gap-4">
          <img
            src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${entry.avatarSeed}`}
            alt="Avatar"
            className="w-10 h-10 rounded-full bg-gray-800 p-1"
          />
          <span className="font-mono text-white">{entry.principalId}</span>
        </div>
        <div className="col-span-4 flex items-center justify-end gap-2">
          <span className="font-mono text-white">{entry.points}</span>
          <Token className="h-5" />
        </div>
      </div>
    ))}
  </div>
);

const LeaderboardCtaBanner = () => (
  <section className="bg-primary/80 rounded-4xl p-8 md:p-12 my-16 relative flex flex-col md:flex-row items-center justify-between gap-8">
    <div className="text-center md:text-left">
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
        Join the community of top builders
      </h2>
      <p className="mt-2 text-xl tracking-tight text-neutral-800">
        Start using MCP today and compete for the top spot!
      </p>
    </div>
    <img
      src="/images/staff-owl.png" // Make sure you have this image
      alt="Champion Owl"
      className="w-32 h-32"
    />
  </section>
);

// --- SKELETON & ERROR COMPONENTS ---
// You can move these to separate files if you prefer
const LeaderboardSkeleton = () => (
  <div className="w-full max-w-5xl mx-auto pt-12 pb-24 animate-pulse">
    <div className="h-4 w-1/3 bg-muted rounded mb-8" /> {/* Breadcrumbs */}
    <div className="h-10 w-1/2 bg-muted rounded mb-24" /> {/* Title */}
    {/* Podium Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 items-end mb-24">
      <div className="md:order-2 h-60 bg-muted/80 rounded-2xl" />
      <div className="md:order-1 h-52 bg-muted rounded-2xl" />
      <div className="md:order-3 h-52 bg-muted rounded-2xl" />
    </div>
    {/* List Skeleton */}
    <div className="space-y-2">
      <div className="h-8 bg-muted/50 rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
    </div>
  </div>
);

// You can reuse the BountyBoardError or create a specific one
// For this example, we'll assume a similar error component exists.

// --- MAIN PAGE COMPONENT ---
export default function LeaderboardPage() {
  // In a real app, you would replace this with a React Query hook
  // const { data, isLoading, isError, refetch } = useGetLeaderboard();
  const isLoading = false; // Set to true to see the skeleton
  const isError = false; // Set to true to see the error state

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  // if (isError) {
  //   return <LeaderboardError onRetry={refetch} />;
  // }

  const topThree = leaderboardData.slice(0, 3);
  const rest = leaderboardData.slice(3);

  return (
    <div className="w-full max-w-5xl mx-auto pt-12 pb-24 text-gray-300">
      {/* Breadcrumbs */}
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">Leaderboard</span>
      </nav>

      {/* Header */}
      <header className="mb-32 md:mb-24">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Leaderboard
        </h1>
      </header>

      {/* Podium for Top 3 */}
      <LeaderboardPodium topThree={topThree} />

      {/* Ranked List for the rest */}
      <LeaderboardList rest={rest} />

      {/* CTA Banner */}
      <LeaderboardCtaBanner />
    </div>
  );
}
