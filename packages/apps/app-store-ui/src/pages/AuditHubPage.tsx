import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Frown, ShieldCheck, Lock, Cog } from 'lucide-react'; // Added icons for audit types
import Token from '@/components/Token';
import { Link } from 'react-router-dom';
// --- 1. Import the new hook and types for the Audit Hub ---
import { useGetAllAuditBounties } from '@/hooks/useAuditBounties';
import { AuditBounty } from '@prometheus-protocol/ic-js'; // Assuming this type exists
import { AuditHubSkeleton } from '@/components/audits/AuditHubSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { uint8ArrayToHex } from '@/lib/utils';
import { fromUSDC } from '@/lib/tokens';

// Helper to format status color (can be reused)
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'open':
      return 'text-green-400';
    case 'claimed':
    case 'in prog': // Added 'in prog' from the design
      return 'text-primary';
    case 'closed':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

// Helper for project icons based on audit type
const getProjectIcon = (auditType: string) => {
  if (auditType.toLowerCase().includes('security')) {
    return <Lock className="h-5 w-5 text-gray-400" />;
  }
  if (auditType.toLowerCase().includes('compliance')) {
    return <ShieldCheck className="h-5 w-5 text-gray-400" />;
  }
  return <Cog className="h-5 w-5 text-gray-400" />;
};

// --- 1. NEW RESPONSIVE LIST ITEM COMPONENT ---
const AuditListItem = ({ audit }: { audit: AuditBounty }) => {
  // Note: This logic should eventually move into the API layer mapping
  const auditType = audit.challengeParameters.audit_type || 'unknown';
  const status = audit.claimedTimestamp ? 'Claimed' : 'Open';
  const wasmHash = uint8ArrayToHex(audit.challengeParameters.wasm_hash);
  const projectName = wasmHash.slice(0, 10) + '...' + wasmHash.slice(-4); // Placeholder

  return (
    <div className="border border-gray-400 rounded-lg hover:border-primary transition-colors">
      {/* --- MOBILE VIEW --- */}
      {/* This view is visible by default and hidden on medium screens and up */}
      <div className="md:hidden p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            {getProjectIcon(auditType)}
            <span className="font-semibold text-white text-lg">
              {projectName}
            </span>
          </div>
          <Link
            to={`/audit-hub/${audit.id}`}
            className="text-primary hover:underline font-semibold">
            View
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Audit Type
            </div>
            <div className="text-gray-300">{auditType}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Status
            </div>
            <div className={`font-semibold ${getStatusColor(status)}`}>
              {status}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Reward
            </div>
            <div className="flex items-center gap-2 font-mono text-white">
              {fromUSDC(audit.tokenAmount)}
              <Token className="h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* --- DESKTOP VIEW --- */}
      {/* This view is hidden by default and visible as a grid on medium screens and up */}
      <div className="hidden md:grid grid-cols-12 gap-4 items-center px-4 py-4">
        <div className="col-span-4 flex items-center gap-3">
          {getProjectIcon(auditType)}
          <span className="font-semibold text-white">{projectName}</span>
        </div>
        <div className="col-span-3 text-gray-400">{auditType}</div>
        <div className="col-span-2 flex items-center justify-end gap-2 font-mono text-white">
          ${fromUSDC(audit.tokenAmount)}
          <Token className="h-5" />
        </div>
        <div className="col-span-2 text-center">
          <span className={`font-semibold ${getStatusColor(status)}`}>
            {status}
          </span>
        </div>
        <div className="col-span-1 text-right">
          <Link
            to={`/audit-hub/${audit.id}`}
            className="text-primary hover:underline font-semibold">
            View
          </Link>
        </div>
      </div>
    </div>
  );
};

export default function AuditHubPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    data: auditsFromCanister,
    isLoading,
    isError,
    refetch,
  } = useGetAllAuditBounties();

  const filteredAudits = useMemo(() => {
    const audits = auditsFromCanister ?? [];
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    if (!lowercasedQuery) return audits;

    return audits;
  }, [auditsFromCanister, searchQuery]);

  if (isLoading) return <AuditHubSkeleton />;
  if (isError) return <AuditHubError onRetry={refetch} />;

  return (
    <div className="w-full max-w-5xl mx-auto pt-12 pb-24 text-gray-300">
      {/* Breadcrumbs */}
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        {/* --- 3. Update Text --- */}
        <span className="text-gray-200">Audit Hub</span>
      </nav>

      {/* Header */}
      <header className="mb-18">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Audit Hub
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-3xl">
          Explore open audits, claim bounties, and earn rewards for securing the
          trust layer of the AI agent ecosystem.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <Input
          type="search"
          placeholder="Search Projects (e.g. 'faucet', 'security', 'compliance')"
          className="w-full bg-gray-900/50 border-gray-400 pl-10 focus:ring-primary focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {/* The "Filter" button from the design can be added here later */}
      </div>

      {/* Audits List */}
      <div className="space-y-3">
        {/* --- 2. HIDE HEADERS ON MOBILE --- */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-gray-500 font-semibold uppercase text-sm">
          <div className="col-span-4">Project Name</div>
          <div className="col-span-3">Audit Type</div>
          <div className="col-span-2 text-right">Reward</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {filteredAudits.length > 0 ? (
          // --- 3. USE THE NEW RESPONSIVE COMPONENT ---
          filteredAudits.map((audit: AuditBounty) => (
            <AuditListItem key={audit.id.toString()} audit={audit} />
          ))
        ) : (
          <div className="text-center py-16 ...">...</div>
        )}
      </div>
    </div>
  );
}
