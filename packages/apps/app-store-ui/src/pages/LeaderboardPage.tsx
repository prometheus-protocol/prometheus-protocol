import { Link } from 'react-router-dom';
import { Award, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import JSConfetti from 'js-confetti';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { truncatePrincipal } from '@/lib/utils';

// --- NEW MOCK DATA STRUCTURES ---
// These simulate the data from the LeaderboardAggregator canister.

interface UserLeaderboardEntry {
  rank: number;
  user: string; // Principal as a string
  total_invocations: number;
}

interface ServerLeaderboardEntry {
  rank: number;
  server: string; // Principal as a string
  total_invocations: number;
}

const userLeaderboardData: UserLeaderboardEntry[] = [
  {
    rank: 1,
    user: 'lintek-pag3x-aaaaa-aaaaa-cai',
    total_invocations: 1_250_345,
  },
  { rank: 2, user: 'tarkon-miv8c-aaaaa-aaaaa-cai', total_invocations: 980_123 },
  { rank: 3, user: 'grovix-sol9r-aaaaa-aaaaa-cai', total_invocations: 750_678 },
  { rank: 4, user: 'glimra-pov2c-aaaaa-aaaaa-cai', total_invocations: 512_456 },
  { rank: 5, user: 'zunloy-ke8xq-aaaaa-aaaaa-cai', total_invocations: 489_789 },
  { rank: 6, user: 'nexlor-vub9j-aaaaa-aaaaa-cai', total_invocations: 320_111 },
];

const serverLeaderboardData: ServerLeaderboardEntry[] = [
  {
    rank: 1,
    server: 'mcp-chat-canister-aaaaa-cai',
    total_invocations: 5_678_901,
  },
  {
    rank: 2,
    server: 'decentralized-storage-aaaaa-cai',
    total_invocations: 4_123_456,
  },
  {
    rank: 3,
    server: 'onchain-game-server-aaaaa-cai',
    total_invocations: 2_987_654,
  },
  {
    rank: 4,
    server: 'oracle-data-feed-aaaaa-cai',
    total_invocations: 1_500_234,
  },
  {
    rank: 5,
    server: 'nft-minter-service-aaaaa-cai',
    total_invocations: 950_876,
  },
];

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
  topThree: UserLeaderboardEntry[];
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
    entry: UserLeaderboardEntry,
    tier: 'Champion' | 'Silver' | 'Bronze',
  ) => {
    const isChampion = tier === 'Champion';
    const styles = tierStyles[tier];
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
          src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${entry.user}`}
          alt="Avatar"
          className="w-20 h-20 rounded-full mb-4 bg-gray-800 p-1"
        />
        <p className={`font-mono text-lg ${styles.text}`}>
          {truncatePrincipal(entry.user)}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="font-mono text-gray-400">
            {entry.total_invocations.toLocaleString()}
          </span>
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
  data: (UserLeaderboardEntry | ServerLeaderboardEntry)[];
  type: 'user' | 'server';
}) => (
  <div className="space-y-3">
    <div className="grid grid-cols-12 gap-4 px-6 py-2 text-gray-500 font-semibold uppercase text-sm">
      <div className="col-span-2">Rank</div>
      <div className="col-span-6">{type === 'user' ? 'User' : 'Server'}</div>
      <div className="col-span-4 text-right">
        {type === 'user' ? 'Tool Usage' : 'Tool Calls'}
      </div>
    </div>
    {data.map((entry) => {
      const principal =
        type === 'user'
          ? (entry as UserLeaderboardEntry).user
          : (entry as ServerLeaderboardEntry).server;
      const avatarType = type === 'user' ? 'pixel-art' : 'bottts-neutral';
      return (
        <div
          key={entry.rank}
          className="grid grid-cols-12 gap-4 items-center px-6 py-4 border border-gray-400 rounded-lg">
          <div className="col-span-2 font-bold text-lg text-gray-400">
            #{entry.rank}
          </div>
          <div className="col-span-6 flex items-center gap-4">
            <img
              src={`https://api.dicebear.com/8.x/${avatarType}/svg?seed=${principal}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full bg-gray-800 p-1"
            />
            <span className="font-mono text-white">
              {truncatePrincipal(principal)}
            </span>
          </div>
          <div className="col-span-4 text-right">
            <span className="font-mono text-white">
              {entry.total_invocations.toLocaleString()}
            </span>
          </div>
        </div>
      );
    })}
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
    <img src="/images/staff-owl.png" alt="Champion Owl" className="w-32 h-32" />
  </section>
);

const LeaderboardSkeleton = () => (
  <div className="w-full max-w-5xl mx-auto pt-12 pb-24 animate-pulse">
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

// --- MAIN PAGE COMPONENT ---
export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'servers'>('users');
  const isLoading = false;
  const isError = false;

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }
  // if (isError) { return <LeaderboardError onRetry={...} />; }

  const topThreeUsers = userLeaderboardData.slice(0, 3);
  const restOfUsers = userLeaderboardData.slice(3);

  return (
    <div className="w-full max-w-5xl mx-auto pt-12 pb-24 text-gray-300">
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">Leaderboard</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Ecosystem Leaderboard
        </h1>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'users' | 'servers')}
        className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-16 md:mb-8">
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="servers">Top Servers</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="mt-16 md:mt-24">
            <LeaderboardPodium topThree={topThreeUsers} />
            <LeaderboardList data={restOfUsers} type="user" />
          </div>
        </TabsContent>

        <TabsContent value="servers">
          <LeaderboardList data={serverLeaderboardData} type="server" />
        </TabsContent>
      </Tabs>

      <LeaderboardCtaBanner />
    </div>
  );
}
