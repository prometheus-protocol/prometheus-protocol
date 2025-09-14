import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGetAuditBounty } from '@/hooks/useAuditBounties';
import { AuditDetailsSkeleton } from '@/components/audits/AuditDetailsSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { BountyPanel } from '@/components/audits/details/BountyPanel';
import { AuditContent } from '@/components/audits/details/AuditContent';

export default function AuditDetailsPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const bountyId = auditId !== undefined ? Number(auditId) : undefined;

  const {
    data: audit,
    error,
    isLoading,
    isError,
    refetch,
  } = useGetAuditBounty(bountyId);

  if (isLoading) return <AuditDetailsSkeleton />;
  if (isError) return <AuditHubError onRetry={refetch} />;
  if (!audit) {
    return (
      <div className="w-full max-w-6xl mx-auto pt-12 pb-24 text-center text-gray-400">
        <h1 className="text-2xl font-bold text-white">Audit Not Found</h1>
        <p className="mt-4">
          The audit you are looking for does not exist or could not be loaded.
        </p>
        <Button variant="outline" asChild className="mt-6">
          <Link to="/audit-hub">Return to Audit Hub</Link>
        </Button>
      </div>
    );
  }

  const { auditType } = audit;

  return (
    <div className="w-full max-w-6xl mx-auto pt-12 pb-24 text-gray-300">
      <nav className="text-sm text-muted-foreground mb-12">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/audit-hub" className="hover:underline">
          Audit Hub
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">Audit #{auditId}</span>
      </nav>

      {/* --- REFACTORED HEADER SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16">
        {/* Left side: Title and Subtitle */}
        <div className="md:col-span-2 space-y-12">
          <header>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Audit #{auditId}
            </h1>
            <p className="mt-2 text-xl text-primary font-semibold">
              {auditType}
            </p>
          </header>
          <div>
            <div className="block md:col-span-1 md:hidden mb-16">
              <BountyPanel audit={audit} />
            </div>
            <AuditContent audit={audit} />
          </div>
        </div>

        {/* Right side: Bounty Panel (hidden on mobile) */}
        <div className="md:col-span-1 hidden md:block">
          <BountyPanel audit={audit} />
        </div>
      </div>
    </div>
  );
}
