import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search, Frown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Token from '@/components/Token';
import { Link } from 'react-router-dom';
import { useGetAllAppBounties } from '@/hooks/useAppBounties';
import { BountyBoardSkeleton } from '@/components/bounties/BountyBoardSkeleton';
import { BountyBoardError } from '@/components/bounties/BountyBoardError';

// Helper to format status color (remains the same)
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'open':
      return 'text-green-400';
    case 'in progress':
      return 'text-primary';
    case 'closed':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

export default function PublicBountyBoardPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Destructure `refetch` to pass to the error component
  const {
    data: bountiesFromCanister,
    isLoading,
    isError,
    refetch,
  } = useGetAllAppBounties();

  const filteredBounties = useMemo(() => {
    const bounties = bountiesFromCanister ?? [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    if (!lowercasedQuery) return bounties;

    return bounties.filter(
      (bounty) =>
        bounty.title.toLowerCase().includes(lowercasedQuery) ||
        bounty.short_description.toLowerCase().includes(lowercasedQuery) ||
        bounty.details_markdown.toLowerCase().includes(lowercasedQuery),
    );
  }, [bountiesFromCanister, searchQuery]);

  // --- Top-level conditional rendering ---
  if (isLoading) {
    return <BountyBoardSkeleton />;
  }

  if (isError) {
    return <BountyBoardError onRetry={refetch} />;
  }

  return (
    <div className="w-full max-w-5xl mx-auto pt-12 pb-24 text-gray-300">
      {/* Breadcrumbs */}
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">App Bounty Board</span>
      </nav>

      {/* Header */}
      <header className="mb-18">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          App Bounty Board
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-3xl">
          Browse open projects and claim bounties for building and listing new
          MCP servers—find opportunities that match your skills and earn rewards
          for your work.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <Input
          type="search"
          placeholder="Search Bounties (e.g. 'metrics', 'faucet', 'japanese')"
          className="w-full bg-gray-900/50 border-gray-400 pl-10 focus:ring-primary focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Bounties List */}
      <div className="space-y-4">
        <div className="hidden md:grid grid-cols-12 gap-4 pr-12 py-2 text-gray-500 font-semibold uppercase text-sm">
          <div className="col-span-7">Project</div>
          <div className="col-span-3 text-right">Reward</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {filteredBounties.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {filteredBounties.map((bounty) => (
              <AccordionItem
                key={bounty.id.toString()}
                value={bounty.id.toString()}
                className="border border-gray-400 rounded-lg mb-4 data-[state=open]:border-primary transition-colors last:border-b">
                <AccordionTrigger className="px-4 py-4 hover:no-underline items-center">
                  <div className="grid grid-cols-12 gap-4 w-full text-left">
                    <div className="col-span-12 md:col-span-7">
                      <h3 className="text-primary text-lg">{bounty.title}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {bounty.short_description}
                      </p>
                    </div>
                    <div className="col-span-6 md:col-span-3 flex items-center justify-start md:justify-end gap-2">
                      <span className="font-mono text-white">
                        {bounty.reward_amount}
                      </span>
                      <Token className="h-4" />
                    </div>
                    <div className="col-span-6 md:col-span-2 flex items-center justify-end">
                      <span
                        className={`font-semibold ${getStatusColor(bounty.status)}`}>
                        {bounty.status}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 py-4 border-t border-gray-800">
                  <div className="prose prose-invert prose-sm max-w-none prose-h3:text-primary prose-a:text-primary hover:prose-a:text-primary">
                    <ReactMarkdown>{bounty.details_markdown}</ReactMarkdown>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
            <Frown className="h-10 w-10" />
            <div>
              <h4 className="font-semibold text-lg text-gray-400">
                No bounties found
              </h4>
              <p className="mt-1">Try a different keyword.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
