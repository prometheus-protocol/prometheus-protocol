import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Frown, Loader2 } from 'lucide-react';
import { useGetAuditBountiesInfinite } from '@/hooks/useAuditBounties';
import { AuditBounty } from '@prometheus-protocol/ic-js';
import { uint8ArrayToHex } from '@prometheus-protocol/ic-js/utils';
import { AuditHubSkeleton } from '@/components/audits/AuditHubSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { AuditHubListItem } from './AuditHubListItem';

const PAGE_SIZE = 20;

export function OpenBountiesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useGetAuditBountiesInfinite(PAGE_SIZE);

  // Flatten all pages into a single array
  const allAudits = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: AuditBounty[]) => page);
  }, [data]);

  // Filter audits based on search query
  const filteredAudits = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    if (!lowercasedQuery) return allAudits;
    return allAudits.filter((audit: AuditBounty) => {
      const auditType =
        audit.challengeParameters?.audit_type?.toLowerCase() || '';
      const wasmHashHex = uint8ArrayToHex(
        audit.challengeParameters?.wasm_hash,
      ).toLowerCase();
      return (
        auditType.includes(lowercasedQuery) ||
        wasmHashHex.includes(lowercasedQuery)
      );
    });
  }, [allAudits, searchQuery]);

  // Set up intersection observer to load more when scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <AuditHubSkeleton />;
  if (isError) return <AuditHubError onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <Input
          type="search"
          placeholder="Search by audit type or WASM hash..."
          className="w-full bg-gray-900/50 border-gray-700 pl-10 focus:ring-primary focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="space-y-3">
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-gray-500 font-semibold uppercase text-sm">
          <div className="col-span-2">Audit ID</div>
          <div className="col-span-3">Audit Type</div>
          <div className="col-span-3">WASM</div>
          <div className="col-span-2 text-right">Reward</div>
          <div className="col-span-2 text-center">Status</div>
        </div>
        {filteredAudits.length > 0 ? (
          <>
            {filteredAudits.map((audit: AuditBounty) => (
              <AuditHubListItem key={audit.id.toString()} audit={audit} />
            ))}
            {(hasNextPage || isFetchingNextPage) && (
              <div
                ref={observerTarget}
                className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading more bounties... ({allAudits.length} loaded)
                </p>
              </div>
            )}
            {!hasNextPage && allAudits.length > PAGE_SIZE && (
              <div className="text-center py-8 text-muted-foreground">
                <p>All {allAudits.length} bounties loaded</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
            <Frown className="h-12 w-12" />
            <p className="font-semibold">No Bounties Found</p>
            <p>There are no open bounties matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
