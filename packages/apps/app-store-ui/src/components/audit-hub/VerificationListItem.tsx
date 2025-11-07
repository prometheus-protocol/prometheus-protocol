import { Link } from 'react-router-dom';
import { WasmVerification } from '@/types/verification';
import { Tokens } from '@prometheus-protocol/ic-js';
import { CheckCircle2, XCircle, Clock, Package } from 'lucide-react';
import Token from '@/components/Token';
import { Progress } from '@/components/ui/progress';

// Helper to format status color
const getStatusConfig = (status: WasmVerification['status']) => {
  switch (status) {
    case 'verified':
      return {
        color: 'text-green-400',
        icon: <CheckCircle2 className="h-5 w-5" />,
        label: 'Verified',
      };
    case 'rejected':
      return {
        color: 'text-red-400',
        icon: <XCircle className="h-5 w-5" />,
        label: 'Rejected',
      };
    case 'in_progress':
      return {
        color: 'text-yellow-400',
        icon: <Clock className="h-5 w-5" />,
        label: 'In Progress',
      };
    default:
      return {
        color: 'text-gray-400',
        icon: <Package className="h-5 w-5" />,
        label: 'Pending',
      };
  }
};

export const VerificationListItem = ({
  verification,
}: {
  verification: WasmVerification;
}) => {
  const statusConfig = getStatusConfig(verification.status);
  const wasmDisplay =
    verification.wasmId.slice(0, 10) + '...' + verification.wasmId.slice(-4);

  // Calculate progress percentage (5 out of 9 needed for consensus)
  const CONSENSUS_THRESHOLD = 5;
  const TOTAL_VERIFIERS = 9;

  // Progress is based on whichever is winning (attestations or divergences)
  const leadingCount = Math.max(
    verification.attestationCount,
    verification.divergenceCount,
  );
  const progressPercent = (leadingCount / CONSENSUS_THRESHOLD) * 100;

  // Determine progress bar color based on what's leading
  const isAttestationLeading =
    verification.attestationCount > verification.divergenceCount;
  const progressColor = isAttestationLeading
    ? 'bg-green-500'
    : verification.divergenceCount > 0
      ? 'bg-red-500'
      : 'bg-primary';

  return (
    <div className="bg-card/50 border border-gray-700 rounded-lg hover:border-primary transition-colors">
      <Link to={`/audit-hub/${verification.wasmId}`}>
        {/* --- DESKTOP VIEW --- */}
        <div className="hidden md:block px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {statusConfig.icon}
              <div>
                <div className="font-mono text-sm text-gray-400">
                  {wasmDisplay}
                </div>
                <div className="text-gray-300 mt-1">
                  {verification.auditType}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-sm text-gray-500 uppercase font-semibold">
                  Total Reward
                </div>
                <div className="flex items-center justify-end gap-2 font-mono text-white text-lg mt-1">
                  ${Tokens.USDC.fromAtomic(verification.totalReward)}
                  <Token className="h-5" />
                </div>
              </div>
              <div className="text-center">
                <span
                  className={`font-semibold ${statusConfig.color} flex items-center gap-2`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Consensus Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-400">
                  <span className="text-green-400 font-semibold">
                    {verification.attestationCount}
                  </span>{' '}
                  attestations
                </span>
                <span className="text-gray-400">
                  <span className="text-red-400 font-semibold">
                    {verification.divergenceCount}
                  </span>{' '}
                  divergences
                </span>
              </div>
              <span className="text-gray-500">
                {verification.attestationCount + verification.divergenceCount}/
                {TOTAL_VERIFIERS} participated
              </span>
            </div>
            <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
              {/* Green bar from left (attestations) */}
              <div
                className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${(verification.attestationCount / TOTAL_VERIFIERS) * 100}%`,
                }}
              />
              {/* Red bar from right (divergences) */}
              <div
                className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-300"
                style={{
                  width: `${(verification.divergenceCount / TOTAL_VERIFIERS) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* --- MOBILE VIEW --- */}
        <div className="md:hidden p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {statusConfig.icon}
              <div>
                <div className="font-mono text-sm text-gray-400">
                  {wasmDisplay}
                </div>
                <div className="text-gray-300 text-sm">
                  {verification.auditType}
                </div>
              </div>
            </div>
            <span className={`font-semibold text-sm ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400 font-semibold">
                {verification.attestationCount} ✓
              </span>
              <span className="text-gray-500">
                {leadingCount}/{CONSENSUS_THRESHOLD}
              </span>
              <span className="text-red-400 font-semibold">
                {verification.divergenceCount} ✗
              </span>
            </div>
            <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
              {/* Green bar from left (attestations) */}
              <div
                className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${(verification.attestationCount / TOTAL_VERIFIERS) * 100}%`,
                }}
              />
              {/* Red bar from right (divergences) */}
              <div
                className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-300"
                style={{
                  width: `${(verification.divergenceCount / TOTAL_VERIFIERS) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Total Reward
              </div>
              <div className="flex items-center gap-2 font-mono text-white">
                ${Tokens.USDC.fromAtomic(verification.totalReward)}
                <Token className="h-5" />
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Verifiers
              </div>
              <div className="text-white">
                {verification.claimedCount}/{TOTAL_VERIFIERS}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};
