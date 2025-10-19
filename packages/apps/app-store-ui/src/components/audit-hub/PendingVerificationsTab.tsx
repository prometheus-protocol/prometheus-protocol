import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Frown, Loader2 } from 'lucide-react';
import { useListPendingVerifications } from '@/hooks/useAuditBounties';
import { PendingVerificationListItem } from './PendingVerificationListItem';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { CreateBountyDialog } from '../server-details/CreateBountyDialog';
import { Tokens } from '@prometheus-protocol/ic-js';

const ITEMS_PER_PAGE = 10;

export function PendingVerificationsTab() {
  const {
    data: verifications,
    isLoading,
    isError,
  } = useListPendingVerifications();

  // --- 1. Add state to manage the dialog ---
  // It will store the wasm_id of the selected project, or null if the dialog is closed.
  const [sponsoringWasmId, setSponsoringWasmId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const observerTarget = useRef<HTMLDivElement>(null);

  // --- 2. Define the handler to be passed to the child component ---
  const handleSponsorClick = (wasmId: string) => {
    setSponsoringWasmId(wasmId);
  };

  const visibleVerifications = useMemo(() => {
    if (!verifications) return [];
    return verifications.slice(0, visibleCount);
  }, [verifications, visibleCount]);

  const hasMore = verifications && visibleCount < verifications.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => {
            const total = verifications?.length || 0;
            if (prev < total) {
              return prev + ITEMS_PER_PAGE;
            }
            return prev;
          });
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget && hasMore) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, verifications?.length]);

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project / WASM</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Submitted On</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-9 w-32 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-destructive py-8">
        Failed to load pending verifications.
      </div>
    );
  }
  if (!verifications || verifications.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
        <Frown className="h-12 w-12" />
        <p className="font-semibold">No Pending Verifications</p>
        <p>All submitted projects have been verified or rejected.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* --- DESKTOP HEADER (Inspired by OpenBountiesTab) --- */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-gray-500 font-semibold uppercase text-sm">
          <div className="col-span-2">Project / WASM</div>
          <div className="col-span-5">Source</div>
          <div className="col-span-4">Submitted On</div>
          <div className="col-span-1">Action</div>
        </div>

        {!verifications || verifications.length === 0 ? (
          <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-4">
            <Frown className="h-12 w-12" />
            <p className="font-semibold">No Pending Verifications</p>
          </div>
        ) : (
          <>
            {visibleVerifications.map((req) => (
              <PendingVerificationListItem
                key={req.wasm_hash}
                request={req}
                onSponsorClick={handleSponsorClick}
              />
            ))}
            {hasMore && (
              <div
                ref={observerTarget}
                className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading more verifications... ({visibleCount} of {verifications?.length || 0})
                </p>
              </div>
            )}
            {!hasMore && (verifications?.length || 0) > ITEMS_PER_PAGE && (
              <div className="text-center py-8 text-muted-foreground">
                <p>All {verifications?.length} verifications loaded</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- 5. Render the dialog, controlled by our state --- */}
      <CreateBountyDialog
        isOpen={!!sponsoringWasmId} // Dialog is open if sponsoringWasmId is not null
        onOpenChange={(open) => {
          if (!open) {
            setSponsoringWasmId(null); // Close the dialog by resetting the state
          }
        }}
        wasmId={sponsoringWasmId ?? ''} // Pass the selected wasm_id as the appId
        auditType="build_reproducibility_v1" // This is always the audit type for this tab
        paymentToken={Tokens.USDC} // Assuming a default payment token
      />
    </>
  );
}
