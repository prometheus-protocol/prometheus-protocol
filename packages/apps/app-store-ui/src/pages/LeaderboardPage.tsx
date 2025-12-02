import { Link } from 'react-router-dom';
import { AlertTriangle, Award, BarChart3, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import JSConfetti from 'js-confetti';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { truncatePrincipal } from '@/lib/utils';
import {
  useGetServerLeaderboard,
  useGetUserLeaderboard,
  useGetVerifierLeaderboard,
} from '@/hooks/useLeaderboard';
import { Leaderboard } from '@prometheus-protocol/ic-js';
import { Button } from '@/components/ui/button';
import { truncateHash } from '@prometheus-protocol/ic-js/utils';

// --- SUB-COMPONENTS ---

const tierStyles = {
  Champion: {
    border: 'border-primary',
    text: 'text-primary',
    icon: <Trophy className="h-6 w-6 text-primary" />,
  },
  Silver: {
    border: 'border-gray-500',
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
  topThree: Leaderboard.UserLeaderboardEntry[];
}) => {
  const [champion, silver, bronze] = topThree;
  const jsConfettiRef = useRef<JSConfetti | null>(null);

  useEffect(() => {
    jsConfettiRef.current = new JSConfetti();
    jsConfettiRef.current.addConfetti({
      confettiColors: ['#ffd700', '#f5a623', '#f8e71c', '#ffffff', '#f0f0f0'],
      confettiRadius: 5,
      confettiNumber: 400,
    });
    return () => jsConfettiRef.current?.clearCanvas();
  }, []);

  const podiumCard = (
    entry: Leaderboard.UserLeaderboardEntry,
    tier: 'Champion' | 'Silver' | 'Bronze',
  ) => {
    const isChampion = tier === 'Champion';
    const styles = tierStyles[tier];

    if (!entry) {
      return null;
    }

    return (
      <div
        className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl text-center transition-all shadow-lg shadow-primary/20 ${styles.border} ${isChampion ? 'relative mt-8 md:-top-8 md:scale-105' : ''}`}>
        {isChampion && (
          <img
            src="/images/btc-owl.png"
            alt="Champion Owl"
            className="w-26 h-26 mb-4 mx-auto absolute -top-26"
          />
        )}
        <div className="flex w-full gap-2 mb-4">
          {styles.icon}
          <h3
            className={`text-lg font-bold uppercase tracking-wider ${styles.text}`}>
            {tier}
          </h3>
        </div>
        <img
          src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${entry.user?.toText()}`}
          alt="Avatar"
          className="w-20 h-20 rounded-full mb-4 bg-gray-800 p-1"
        />
        <p className={`font-mono text-lg ${styles.text}`}>
          {truncatePrincipal(entry.user?.toText())}
        </p>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
          <BarChart3 className="h-3 w-3" />
          <span>{entry.total_invocations.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-8 items-end mb-16">
      <div className="md:order-2">{podiumCard(champion, 'Champion')}</div>
      <div className="md:order-1">{podiumCard(silver, 'Silver')}</div>
      <div className="md:order-3">{podiumCard(bronze, 'Bronze')}</div>
    </div>
  );
};

// --- REFACTORED GENERIC LIST COMPONENT ---
const LeaderboardList = ({
  data,
  type,
}: {
  data: (
    | Leaderboard.UserLeaderboardEntry
    | Leaderboard.ServerLeaderboardEntry
  )[];
  type: 'user' | 'server';
}) => (
  <div className="space-y-3">
    <div className="grid grid-cols-12 gap-4 px-2 py-2 text-gray-500 font-semibold uppercase text-sm">
      <div className="col-span-2">Rank</div>
      <div className="col-span-6">{type === 'user' ? 'User' : 'Server'}</div>
      <div className="col-span-4 text-right">
        {type === 'user' ? 'Tool Usage' : 'Tool Calls'}
      </div>
    </div>
    {data.map((entry) => {
      const id =
        type === 'user'
          ? (entry as Leaderboard.UserLeaderboardEntry).user.toText()
          : (entry as Leaderboard.ServerLeaderboardEntry).server;

      const truncatedId =
        type === 'user' ? truncatePrincipal(id) : truncateHash(id);

      const avatarType = type === 'user' ? 'adventurer' : 'bottts-neutral';
      return (
        <div
          key={entry.rank}
          className="grid grid-cols-12 gap-4 items-center px-6 py-4 border border-gray-400 rounded-lg">
          <div className="col-span-2 font-bold text-lg text-gray-400">
            #{entry.rank}
          </div>
          <div className="col-span-6 flex items-center gap-4">
            <img
              src={`https://api.dicebear.com/9.x/${avatarType}/svg?seed=${id}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full bg-gray-800 p-1"
            />
            <span className="font-mono text-white">{truncatedId}</span>
          </div>
          <div className="col-span-4 text-right">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono justify-end">
              <BarChart3 className="h-3 w-3" />
              <span>{entry.total_invocations.toLocaleString()}</span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const LeaderboardCtaBanner = () => (
  <section className="bg-primary/80 rounded-[54px] p-8 md:p-12 my-16 relative flex flex-col md:flex-row items-center justify-between gap-8">
    <div className="text-center md:text-left">
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
        The Genesis Program is complete.
      </h2>
      <p className="mt-2 text-xl tracking-tight text-neutral-800">
        Get ready for Season One.
      </p>
    </div>
    <img src="/images/staff-owl.png" alt="Champion Owl" className="w-32 h-32" />
  </section>
);

const LeaderboardSkeleton = () => (
  <div className="w-full max-w-6xl mx-auto pt-12 pb-24 animate-pulse">
    <div className="h-4 w-1/3 bg-muted rounded mb-8" />
    <div className="h-10 w-1/2 bg-muted rounded mb-16" />
    <div className="h-10 w-full md:w-[400px] bg-muted rounded-lg mb-8" />
    <div className="space-y-2">
      <div className="h-8 bg-muted/50 rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
      <div className="h-16 bg-muted rounded-lg" />
    </div>
  </div>
);
// --- 1. NEW ERROR COMPONENT ---
// This can be moved to its own file if you prefer.
const LeaderboardError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="w-full max-w-6xl mx-auto pt-12 pb-24 flex flex-col items-center justify-center text-center text-gray-400">
    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
    <h2 className="text-2xl font-bold text-white mb-2">
      Failed to Load Leaderboard
    </h2>
    <p className="mb-6">
      There was a problem fetching the data. Please check your connection and
      try again.
    </p>
    <Button onClick={onRetry} variant="secondary">
      Retry
    </Button>
  </div>
);

// --- MAIN PAGE COMPONENT ---
const INITIAL_VISIBLE_COUNT = 10;
const LOAD_MORE_INCREMENT = 10;

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'servers' | 'verifiers'>('users');
  const [visibleUserCount, setVisibleUserCount] = useState(
    INITIAL_VISIBLE_COUNT,
  );
  // --- 1. ADD STATE FOR SERVER PAGINATION ---
  const [visibleServerCount, setVisibleServerCount] = useState(
    INITIAL_VISIBLE_COUNT,
  );
  const [visibleVerifierCount, setVisibleVerifierCount] = useState(
    INITIAL_VISIBLE_COUNT,
  );

  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useGetUserLeaderboard();

  const {
    data: servers,
    isLoading: serversLoading,
    isError: serversError,
    error,
    refetch: refetchServers,
  } = useGetServerLeaderboard();

  const {
    data: verifiers,
    isLoading: verifiersLoading,
    isError: verifiersError,
    refetch: refetchVerifiers,
  } = useGetVerifierLeaderboard();

  const isLoading = usersLoading || serversLoading || verifiersLoading;
  const isError = usersError || serversError || verifiersError;

  const handleRetry = () => {
    if (usersError) refetchUsers();
    if (serversError) refetchServers();
    if (verifiersError) refetchVerifiers();
  };

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (isError) {
    return <LeaderboardError onRetry={handleRetry} />;
  }

  const topThreeUsers = users?.slice(0, 3) || [];
  const restOfUsers = users?.slice(3) || [];
  const allServers = servers || [];
  const allVerifiers = verifiers || [];

  // Slice the data for display
  const visibleUsers = restOfUsers.slice(0, visibleUserCount);
  // --- 2. SLICE THE SERVER DATA FOR DISPLAY ---
  const visibleServers = allServers.slice(0, visibleServerCount);
  const visibleVerifiers = allVerifiers.slice(0, visibleVerifierCount);

  return (
    <div className="w-full max-w-6xl mx-auto pt-12 pb-24 text-gray-300">
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">Leaderboard</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Genesis Program
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Tracking the founding cohort of on-chain agents and developers.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'users' | 'servers' | 'verifiers')}
        className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px] mb-16 md:mb-8">
          <TabsTrigger value="users">Top Agents</TabsTrigger>
          <TabsTrigger value="servers">Top Servers</TabsTrigger>
          <TabsTrigger value="verifiers">Top Verifiers</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="mt-16 md:mt-24">
            {topThreeUsers.length > 0 && (
              <LeaderboardPodium topThree={topThreeUsers} />
            )}
            <LeaderboardList data={visibleUsers} type="user" />

            {restOfUsers.length > visibleUserCount && (
              <div className="text-center mt-8">
                <Button
                  onClick={() =>
                    setVisibleUserCount(
                      (prevCount) => prevCount + LOAD_MORE_INCREMENT,
                    )
                  }
                  variant="outline">
                  Load More
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="servers">
          {/* --- 3. UPDATE THE SERVERS TAB --- */}
          <LeaderboardList data={visibleServers} type="server" />

          {allServers.length > visibleServerCount && (
            <div className="text-center mt-8">
              <Button
                onClick={() =>
                  setVisibleServerCount(
                    (prevCount) => prevCount + LOAD_MORE_INCREMENT,
                  )
                }
                variant="outline">
                Load More
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="verifiers">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-4 px-2 py-2 text-gray-500 font-semibold uppercase text-sm">
              <div className="col-span-2">Rank</div>
              <div className="col-span-6">Verifier</div>
              <div className="col-span-4 text-right">Verifications</div>
            </div>
            {visibleVerifiers.map((entry) => {
              const id = entry.verifier.toText();
              const truncatedId = truncatePrincipal(id);
              return (
                <div
                  key={entry.rank}
                  className="grid grid-cols-12 gap-4 items-center px-6 py-4 border border-gray-400 rounded-lg">
                  <div className="col-span-2 font-bold text-lg text-gray-400">
                    #{entry.rank}
                  </div>
                  <div className="col-span-6 flex items-center gap-4">
                    <img
                      src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${id}`}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full bg-gray-800 p-1"
                    />
                    <span className="font-mono text-white">{truncatedId}</span>
                  </div>
                  <div className="col-span-4 text-right">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono justify-end">
                      <BarChart3 className="h-3 w-3" />
                      <span>{Number(entry.total_verifications).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {allVerifiers.length > visibleVerifierCount && (
            <div className="text-center mt-8">
              <Button
                onClick={() =>
                  setVisibleVerifierCount(
                    (prevCount) => prevCount + LOAD_MORE_INCREMENT,
                  )
                }
                variant="outline">
                Load More
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LeaderboardCtaBanner />
    </div>
  );
}
