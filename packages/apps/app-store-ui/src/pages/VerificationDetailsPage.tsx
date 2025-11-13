import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGetBountiesForWasm } from '@/hooks/useAuditBounties';
import { useGetSingleWasmVerification } from '@/hooks/useWasmVerifications';
import { VerificationDetailsSkeleton } from '@/components/audits/VerificationDetailsSkeleton';
import { AuditHubError } from '@/components/audits/AuditHubError';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { Tokens, getBountyLock } from '@prometheus-protocol/ic-js';
import Token from '@/components/Token';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

const CONSENSUS_THRESHOLD = 5;
const TOTAL_VERIFIERS = 9;

export default function VerificationDetailsPage() {
  const { wasmId } = useParams<{ wasmId: string }>();
  const [searchParams] = useSearchParams();
  const auditType = searchParams.get('auditType') || 'build_reproducibility_v1';

  // Fetch only bounties for this specific WASM and audit type
  const {
    data: allBounties = [],
    isLoading: isBountiesLoading,
    isError: isBountiesError,
    refetch,
  } = useGetBountiesForWasm(wasmId, auditType, {
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Get verification data for this specific WASM only
  const {
    data: verification,
    isLoading: isVerificationLoading,
    isError: isVerificationError,
  } = useGetSingleWasmVerification(wasmId, allBounties, {
    refetchInterval: 10000, // Auto-refetch progress every 10 seconds (stops when verified/rejected)
    auditType, // Pass audit type from URL params for stable cache key
  });

  // Fetch locks for all bounties in this verification
  const { data: locks } = useQuery({
    queryKey: ['bountyLocks', wasmId],
    queryFn: async () => {
      if (!verification) return new Map();
      const lockPromises = verification.bounties.map(async (bounty) => {
        const lock = await getBountyLock(bounty.id);
        return [bounty.id.toString(), lock] as const;
      });
      const lockEntries = await Promise.all(lockPromises);
      return new Map(lockEntries);
    },
    refetchInterval: 10000,
  });

  // Count active verifiers: bounties that are locked OR claimed OR have completed work (attestation/divergence)
  const activeVerifiers = useMemo(() => {
    if (!verification || !locks) return 0;
    return verification.bounties.filter((bounty) => {
      const hasLock = !!locks.get(bounty.id.toString());
      const isClaimed = bounty.claimedTimestamp !== undefined;
      // Check if this bounty ID has filed an attestation or divergence
      const hasAttestation = verification.attestationBountyIds.some(
        (id) => id === bounty.id,
      );
      const hasDivergence = verification.divergenceBountyIds.some(
        (id) => id === bounty.id,
      );

      return hasLock || isClaimed || hasAttestation || hasDivergence;
    }).length;
  }, [verification, locks]);

  // Show loading skeleton while either bounties are loading OR verification is loading
  const isLoading = isBountiesLoading || isVerificationLoading;
  const isError = isBountiesError || isVerificationError;

  if (isLoading) return <VerificationDetailsSkeleton />;
  if (isError) return <AuditHubError onRetry={refetch} />;

  // Only show "not found" if bounties loaded but no verification data exists
  if (!verification && allBounties.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto pt-12 pb-24 text-center text-gray-400">
        <h1 className="text-2xl font-bold text-white">
          Verification Not Found
        </h1>
        <p className="mt-4">
          The verification you are looking for does not exist or could not be
          loaded.
        </p>
        <Button variant="outline" asChild className="mt-6">
          <Link to="/audit-hub">Return to Audit Hub</Link>
        </Button>
      </div>
    );
  }

  const leadingCount = Math.max(
    verification?.attestationCount || 0,
    verification?.divergenceCount || 0,
  );
  const progressPercent = (leadingCount / CONSENSUS_THRESHOLD) * 100;
  const isAttestationLeading =
    (verification?.attestationCount || 0) >=
    (verification?.divergenceCount || 0);

  // Determine title based on audit type
  const verificationTitle =
    verification?.auditType === 'build_reproducibility_v1'
      ? 'Build Verification'
      : verification?.auditType === 'tools_v1'
        ? 'MCP Tools Verification'
        : 'Verification';

  // Determine status config based on current state
  // Use dynamic leading side color until finalized, then use final status
  const isFinalized =
    verification?.status === 'verified' || verification?.status === 'rejected';

  const statusConfig = isFinalized
    ? verification?.status === 'verified'
      ? {
          color: 'text-green-400',
          icon: <CheckCircle2 className="h-6 w-6 text-green-400" />,
          label: 'Verified',
        }
      : {
          color: 'text-red-400',
          icon: <XCircle className="h-6 w-6 text-red-400" />,
          label: 'Rejected',
        }
    : {
        color: isAttestationLeading ? 'text-green-400' : 'text-red-400',
        icon: (
          <Clock
            className={`h-6 w-6 ${isAttestationLeading ? 'text-green-400' : 'text-red-400'}`}
          />
        ),
        label: verification?.status === 'pending' ? 'Pending' : 'In Progress',
      };

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
        <span className="text-gray-200">Verification</span>
      </nav>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          {statusConfig.icon}
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            {verificationTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-lg font-semibold ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          <span className="text-gray-500">•</span>
          <span className="text-xl text-primary font-semibold">
            {verification?.auditType || 'Unknown Audit Type'}
          </span>
        </div>
        <div className="font-mono text-sm text-gray-400 bg-gray-900/50 px-4 py-2 rounded-lg inline-block">
          {wasmId}
        </div>
      </div>

      {/* Consensus Progress Card */}
      <div className="bg-card/50 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">
          Consensus Progress
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-1">
              {verification?.attestationCount || 0}
            </div>
            <div className="text-sm text-gray-400 uppercase">
              Successful Builds
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400 mb-1">
              {verification?.divergenceCount || 0}
            </div>
            <div className="text-sm text-gray-400 uppercase">
              Build Failures
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {activeVerifiers}/{TOTAL_VERIFIERS}
            </div>
            <div className="text-sm text-gray-400 uppercase">
              Active Verifiers
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {leadingCount}/{CONSENSUS_THRESHOLD} votes needed for consensus
            </span>
            <span className="text-gray-400">
              {(verification?.attestationCount || 0) +
                (verification?.divergenceCount || 0)}
              /{TOTAL_VERIFIERS} verifiers participated
            </span>
          </div>
          <div className="relative h-6 bg-gray-800 rounded-full overflow-hidden">
            {/* Green bar from left (attestations) */}
            <div
              className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${((verification?.attestationCount || 0) / TOTAL_VERIFIERS) * 100}%`,
              }}
            />
            {/* Red bar from right (divergences) */}
            <div
              className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-300"
              style={{
                width: `${((verification?.divergenceCount || 0) / TOTAL_VERIFIERS) * 100}%`,
              }}
            />
            {/* Center labels */}
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="text-xs font-semibold text-white mix-blend-difference">
                {verification?.attestationCount || 0} ✓
              </span>
              <span className="text-xs font-semibold text-white mix-blend-difference">
                {verification?.divergenceCount || 0} ✗
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bounty Pool Card */}
      <div className="bg-card/50 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Bounty Pool</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Reward Pool</div>
            <div className="flex items-center gap-2 text-3xl font-mono font-bold text-white">
              ${Tokens.USDC.fromAtomic(verification?.totalReward || 0n)}
              <Token className="h-8" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400 mb-1">Individual Bounty</div>
            <div className="flex items-center justify-end gap-2 text-xl font-mono text-white">
              $
              {Tokens.USDC.fromAtomic(
                (verification?.totalReward || 0n) / BigInt(TOTAL_VERIFIERS),
              )}
              <Token className="h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Individual Bounties */}
      <div className="bg-card/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">
          Individual Bounties ({verification?.bounties.length || 0})
        </h2>
        {verification?.bounties.length === 0 ? (
          <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-4">
            <Package className="h-12 w-12" />
            <div>
              <p className="font-semibold">No Bounties Available</p>
              <p className="text-sm mt-1">
                Bounties will appear here once they are created for this
                verification.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {verification?.bounties.map((bounty) => {
              const lock = locks?.get(bounty.id.toString());
              const hasLock = !!lock;
              const isClaimed = bounty.claimedTimestamp !== undefined;
              // Check if work has been completed (attestation or divergence filed)
              const hasAttestation = verification.attestationBountyIds.some(
                (id) => id === bounty.id,
              );
              const hasDivergence = verification.divergenceBountyIds.some(
                (id) => id === bounty.id,
              );
              const isCompleted = hasAttestation || hasDivergence;

              return (
                <div
                  key={bounty.id.toString()}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm text-gray-400 mb-1">
                        Bounty #{bounty.id.toString()}
                      </div>
                      <div className="flex items-center gap-3">
                        {isCompleted ? (
                          <>
                            <div className="flex items-center gap-2">
                              <CheckCircle2
                                className={`h-4 w-4 ${hasAttestation ? 'text-green-400' : 'text-red-400'}`}
                              />
                              <span
                                className={`font-semibold ${hasAttestation ? 'text-green-400' : 'text-red-400'}`}>
                                {hasAttestation ? 'Verified' : 'Rejected'}
                              </span>
                            </div>
                          </>
                        ) : isClaimed ? (
                          <>
                            <span className="font-semibold text-gray-400">
                              Claimed
                            </span>
                            {bounty.claimedDate && (
                              <span className="text-xs text-gray-500">
                                {bounty.claimedDate.toLocaleDateString()}
                              </span>
                            )}
                          </>
                        ) : hasLock ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-primary">
                                Locked
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              by {lock.claimant.toString().slice(0, 8)}...
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-green-400">
                            Open
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2 font-mono text-white">
                          ${Tokens.USDC.fromAtomic(bounty.tokenAmount)}
                          <Token className="h-5" />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="hidden md:flex">
                        <Link
                          to={`/audit-hub/bounty/${bounty.id}`}
                          className="flex items-center gap-2">
                          Details
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
