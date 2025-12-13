import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Frown, Loader2 } from 'lucide-react';
import { useListPendingJobs } from '@/hooks/useAuditBounties';
import { AuditHubSkeleton } from '@/components/audits/AuditHubSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { PendingJobListItem } from './PendingJobListItem';

const JOBS_PER_PAGE = 10;

export function OpenBountiesTab() {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useListPendingJobs(JOBS_PER_PAGE);

  // Flatten all pages into a single jobs array
  const jobs = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.jobs);
  }, [data]);

  const total = data?.pages?.[0]?.total ?? 0;

  // Filter jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    if (!lowercasedQuery) return jobs;

    return jobs.filter((job) => {
      const auditType = job.auditType.toLowerCase();
      const wasmId = job.wasmId.toLowerCase();
      return (
        auditType.includes(lowercasedQuery) || wasmId.includes(lowercasedQuery)
      );
    });
  }, [jobs, searchQuery]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const visibleJobs = hasSearchQuery ? filteredJobs : jobs;

  // Show skeleton only on true initial load
  if (isLoading && !data) return <AuditHubSkeleton />;
  if (isError) return <AuditHubError onRetry={refetch} />;

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
      </div>

      <div className="space-y-3">
        {filteredJobs.length > 0 ? (
          <>
            {visibleJobs.map((job) => (
              <PendingJobListItem
                key={job.queueKey}
                job={job}
                onSponsorClick={() => {}}
                isSponsored={false}
              />
            ))}
            {isLoading && jobs && jobs.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Refreshing jobs...
                </p>
              </div>
            )}
            {!hasSearchQuery && hasNextPage && (
              <div className="text-center py-8">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  className="mx-auto">
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  Showing {visibleJobs.length} of {total} jobs
                </p>
              </div>
            )}
            {!hasSearchQuery && !hasNextPage && jobs.length > 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  All jobs loaded ({total} {total === 1 ? 'job' : 'jobs'})
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
            <Frown className="h-12 w-12" />
            <p className="font-semibold">No Jobs Found</p>
            <p>There are no jobs matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
