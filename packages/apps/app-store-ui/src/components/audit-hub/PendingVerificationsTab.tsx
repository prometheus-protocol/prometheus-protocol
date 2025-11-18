import { Skeleton } from '@/components/ui/skeleton';
import { Frown, Loader2 } from 'lucide-react';
import {
  useListAllVerificationRequests,
  useCompletedAuditTypes,
} from '@/hooks/useAuditBounties';
import { PendingVerificationListItem } from './PendingVerificationListItem';
import { useState } from 'react';
import { CreateBountyDialog } from '../server-details/CreateBountyDialog';

const ITEMS_PER_PAGE = 20;

export function PendingVerificationsTab() {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const { data, isLoading, isError } = useListAllVerificationRequests(
    0,
    visibleCount,
  );

  const verifications = data?.requests || [];
  const total = data?.total || 0;

  const [sponsoringWasmId, setSponsoringWasmId] = useState<string | null>(null);
  const [sponsoredWasms, setSponsoredWasms] = useState<Set<string>>(new Set());

  // Fetch completed audit types for the WASM being sponsored
  const { data: completedAuditTypes = [] } = useCompletedAuditTypes(
    sponsoringWasmId || '',
  );

  const handleSponsorClick = (wasmId: string) => {
    setSponsoringWasmId(wasmId);
  };

  const handleSponsorSuccess = (wasmId: string) => {
    setSponsoredWasms((prev) => new Set(prev).add(wasmId));
  };

  const hasMore = visibleCount < total;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  if (isLoading && verifications.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border border-gray-700 rounded-lg p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-9 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-destructive py-8">
        Failed to load verification requests.
      </div>
    );
  }

  if (verifications.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
        <Frown className="h-12 w-12" />
        <p className="font-semibold">No Verification Requests</p>
        <p>No WASMs have been submitted for verification yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-gray-500 font-semibold uppercase text-sm">
          <div className="col-span-3">Project</div>
          <div className="col-span-4">Description / Source</div>
          <div className="col-span-2">Publisher</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-1">Action</div>
        </div>

        {verifications.map((req) => (
          <PendingVerificationListItem
            key={req.wasm_hash}
            request={req}
            onSponsorClick={handleSponsorClick}
            isSponsored={sponsoredWasms.has(req.wasm_hash)}
          />
        ))}

        {hasMore && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {isLoading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading more... ({verifications.length} of {total})
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing {verifications.length} of {total} verification
                  requests
                </p>
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  Load More
                </button>
              </>
            )}
          </div>
        )}

        {!hasMore && total > ITEMS_PER_PAGE && (
          <div className="text-center py-8 text-muted-foreground">
            <p>All {total} verification requests loaded</p>
          </div>
        )}
      </div>

      {sponsoringWasmId &&
        verifications.find((v) => v.wasm_hash === sponsoringWasmId) && (
          <CreateBountyDialog
            isOpen={true}
            onOpenChange={(open) => {
              if (!open) setSponsoringWasmId(null);
            }}
            wasmId={sponsoringWasmId}
            verificationRequest={
              verifications.find((v) => v.wasm_hash === sponsoringWasmId)!
            }
            completedAuditTypes={completedAuditTypes}
            onSuccess={() => {
              if (sponsoringWasmId) handleSponsorSuccess(sponsoringWasmId);
            }}
          />
        )}
    </>
  );
}
