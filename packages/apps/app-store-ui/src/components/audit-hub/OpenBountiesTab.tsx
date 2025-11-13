import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Frown, Loader2, RefreshCw } from 'lucide-react';
import { useGetAuditBountiesInfinite } from '@/hooks/useAuditBounties';
import { useGetWasmVerifications } from '@/hooks/useWasmVerifications';
import { AuditHubSkeleton } from '@/components/audits/AuditHubSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { VerificationListItem } from './VerificationListItem';

// Larger page size since we're grouping - fetch enough bounties to get a good number of unique WASMs
// Typically 9 bounties per WASM, so 90 bounties = ~10 WASMs shown
const PAGE_SIZE = 90;
const POLL_INTERVAL = 10000; // 10 seconds
const CONSENSUS_THRESHOLD = 9; // Number of attestations/divergences needed for consensus

export function OpenBountiesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    POLL_INTERVAL / 1000,
  );

  const {
    data,
    isLoading: isBountiesLoading, // True only on initial load with no data
    isError: isBountiesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useGetAuditBountiesInfinite(PAGE_SIZE);

  // Flatten all pages into a single array
  const allBounties = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page);
  }, [data]);

  // Get grouped verifications with progress data
  const {
    data: verifications,
    isLoading: isVerificationsLoading,
    isError: isVerificationsError,
    refetch: refetchVerifications,
    dataUpdatedAt,
  } = useGetWasmVerifications(allBounties);

  // Check if any verifications are in progress
  const hasInProgressVerifications = useMemo(() => {
    return (
      verifications?.some(
        (v) => v.attestationCount + v.divergenceCount < CONSENSUS_THRESHOLD,
      ) ?? false
    );
  }, [verifications]);

  // Countdown timer and polling
  useEffect(() => {
    if (!hasInProgressVerifications || !autoRefreshEnabled) {
      setSecondsUntilRefresh(0);
      return;
    }

    // Initialize countdown
    setSecondsUntilRefresh(POLL_INTERVAL / 1000);

    // Countdown timer (updates every second)
    const countdownInterval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) return POLL_INTERVAL / 1000;
        return prev - 1;
      });
    }, 1000);

    // Polling timer (refetches every POLL_INTERVAL)
    const pollInterval = setInterval(() => {
      console.log('Polling for updates...');
      refetch(); // Refetch bounties
      refetchVerifications(); // Refetch verifications
    }, POLL_INTERVAL);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(pollInterval);
    };
  }, [
    hasInProgressVerifications,
    autoRefreshEnabled,
    refetch,
    refetchVerifications,
  ]);

  // Filter verifications based on search query
  const filteredVerifications = useMemo(() => {
    if (!verifications) return [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    if (!lowercasedQuery) return verifications;

    return verifications.filter((verification) => {
      const auditType = verification.auditType.toLowerCase();
      const wasmId = verification.wasmId.toLowerCase();
      return (
        auditType.includes(lowercasedQuery) || wasmId.includes(lowercasedQuery)
      );
    });
  }, [verifications, searchQuery]);

  // Show skeleton only on true initial load (no cached data)
  const isInitialLoading =
    (isBountiesLoading || isVerificationsLoading) && !verifications;

  if (isInitialLoading) return <AuditHubSkeleton />;
  if (isBountiesError || isVerificationsError)
    return <AuditHubError onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <Input
            type="search"
            placeholder="Search by audit type or WASM hash..."
            className="w-full bg-gray-900/50 border-gray-700 pl-10 focus:ring-primary focus:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            refetch();
            refetchVerifications();
          }}
          variant="outline"
          size="icon"
          disabled={isBountiesLoading || isVerificationsLoading}
          className="shrink-0">
          <RefreshCw
            className={`h-4 w-4 ${isBountiesLoading || isVerificationsLoading ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-card/30 border border-gray-700 rounded px-3 py-2">
        <div className="flex items-center gap-2">
          {autoRefreshEnabled && hasInProgressVerifications && (
            <>
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>
                Auto-refreshing bounties and verifications • Next update in{' '}
                {secondsUntilRefresh}s
              </span>
            </>
          )}
          {autoRefreshEnabled && !hasInProgressVerifications && (
            <span>
              Auto-refresh active (updates when verifications are in progress)
            </span>
          )}
          {!autoRefreshEnabled && <span>Auto-refresh paused</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          className="h-6 text-xs">
          {autoRefreshEnabled ? 'Pause' : 'Resume'}
        </Button>
      </div>

      <div className="space-y-3">
        {filteredVerifications.length > 0 ? (
          <>
            {filteredVerifications.map((verification) => (
              <VerificationListItem
                key={`${verification.wasmId}::${verification.auditType}`}
                verification={verification}
              />
            ))}
            {/* Show loading indicator when fetching bounties or recalculating verifications */}
            {(isFetchingNextPage ||
              (isVerificationsLoading && allBounties.length > 0)) && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isFetchingNextPage
                    ? 'Loading more bounties...'
                    : 'Recalculating verifications...'}
                </p>
              </div>
            )}
            {!hasNextPage && (
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  All verifications loaded ({filteredVerifications.length}{' '}
                  verifications, {allBounties.length} bounties)
                </p>
              </div>
            )}
            {/* Manual load more button + invisible observer target */}
            {hasNextPage && !isFetchingNextPage && !isVerificationsLoading && (
              <>
                <div className="text-center py-8">
                  <Button
                    onClick={() => {
                      console.log('Manual load more clicked');
                      fetchNextPage();
                    }}
                    variant="outline"
                    className="mx-auto">
                    Load More Verifications
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Showing {filteredVerifications.length} verifications (
                    {allBounties.length} bounties)
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
            <Frown className="h-12 w-12" />
            <p className="font-semibold">No Verifications Found</p>
            <p>There are no verifications matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
