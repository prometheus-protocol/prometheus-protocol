import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Frown } from 'lucide-react';
import { useGetAllAuditBounties } from '@/hooks/useAuditBounties';
import { AuditBounty } from '@prometheus-protocol/ic-js';
import { uint8ArrayToHex } from '@prometheus-protocol/ic-js/utils';
import { AuditHubSkeleton } from '@/components/audits/AuditHubSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { AuditHubListItem } from './AuditHubListItem';

export function OpenBountiesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    data: audits,
    isLoading,
    isError,
    refetch,
  } = useGetAllAuditBounties();

  const filteredAudits = useMemo(() => {
    if (!audits) return [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    if (!lowercasedQuery) return audits;
    return audits.filter((audit) => {
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
  }, [audits, searchQuery]);

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
          <div className="col-span-1">Audit ID</div>
          <div className="col-span-3">Audit Type</div>
          <div className="col-span-3">WASM</div>
          <div className="col-span-2 text-right">Reward</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {filteredAudits.length > 0 ? (
          filteredAudits.map((audit: AuditBounty) => (
            <AuditHubListItem key={audit.id.toString()} audit={audit} />
          ))
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
