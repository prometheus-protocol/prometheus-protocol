import { Link } from 'react-router-dom';
import { PendingJob } from '@prometheus-protocol/ic-js';
import { truncateHash } from '@prometheus-protocol/ic-js/utils';
import { getAuditTypeInfo } from '@/lib/get-audit-type-info';
import { Clock, CheckCircle2 } from 'lucide-react';

// Helper to format timestamp relative to now
const formatTimestamp = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// Helper to get status config based on job progress
const getStatusConfig = (
  completedCount: number,
  assignedCount: number,
  requiredVerifiers: number,
) => {
  const totalProgress = completedCount + assignedCount;
  if (completedCount >= requiredVerifiers) {
    return {
      color: 'text-green-400',
      icon: <CheckCircle2 className="h-5 w-5" />,
      label: 'Complete',
    };
  }
  if (totalProgress > 0) {
    return {
      color: 'text-yellow-400',
      icon: <Clock className="h-5 w-5" />,
      label: 'In Progress',
    };
  }
  return {
    color: 'text-gray-400',
    icon: <Clock className="h-5 w-5" />,
    label: 'Waiting',
  };
};

interface PendingJobListItemProps {
  job: PendingJob;
  onSponsorClick: (wasmId: string) => void;
  isSponsored?: boolean;
}

export const PendingJobListItem = ({
  job,
  onSponsorClick,
  isSponsored = false,
}: PendingJobListItemProps) => {
  const auditTypeInfo = getAuditTypeInfo(job.auditType);
  const statusConfig = getStatusConfig(
    job.completedCount,
    job.assignedCount,
    job.requiredVerifiers,
  );
  const wasmDisplay = truncateHash(job.wasmId);
  const completedPercent =
    job.requiredVerifiers > 0
      ? (job.completedCount / job.requiredVerifiers) * 100
      : 0;
  const progressPercent =
    job.requiredVerifiers > 0
      ? ((job.completedCount + job.assignedCount) / job.requiredVerifiers) * 100
      : 0;
  const isComplete = job.completedCount >= job.requiredVerifiers;

  return (
    <div className="bg-card/50 border border-gray-700 rounded-lg hover:border-primary transition-colors">
      <Link
        to={`/audit-hub/${job.wasmId}?auditType=${job.auditType}&jobKey=${encodeURIComponent(job.queueKey)}`}>
        {/* --- DESKTOP VIEW --- */}
        <div className="hidden md:block px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <auditTypeInfo.Icon className="h-5 w-5 text-gray-400" />
              <div>
                <div className="font-mono text-sm text-gray-400">
                  {wasmDisplay}
                </div>
                <div className="text-gray-300 mt-1">{auditTypeInfo.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Created {formatTimestamp(job.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-sm text-gray-500 uppercase font-semibold">
                  Total Bounties
                </div>
                <div className="font-mono text-white text-lg mt-1">
                  {job.bountyIds.length}
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

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {job.completedCount > 0 && (
                  <span className="text-green-400 font-semibold">
                    {job.completedCount} completed
                  </span>
                )}
                {job.completedCount > 0 && job.assignedCount > 0 && (
                  <span className="text-gray-500"> · </span>
                )}
                {job.assignedCount > 0 && (
                  <span className="text-primary font-semibold">
                    {job.assignedCount} in progress
                  </span>
                )}
                {job.completedCount === 0 && job.assignedCount === 0 && (
                  <span className="text-gray-500">No verifiers yet</span>
                )}
                <span className="text-gray-500">
                  {' '}
                  / {job.requiredVerifiers} needed
                </span>
              </span>
              <span className="text-gray-500">
                {Math.round(completedPercent)}% complete
              </span>
            </div>
            <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
              {isComplete ? (
                <div className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300 w-full" />
              ) : (
                <>
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                    style={{
                      width: `${(job.completedCount / job.requiredVerifiers) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* --- MOBILE VIEW --- */}
        <div className="md:hidden p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <auditTypeInfo.Icon className="h-5 w-5 text-gray-400" />
              <div>
                <div className="font-mono text-sm text-gray-400">
                  {wasmDisplay}
                </div>
                <div className="text-gray-300 text-sm">
                  {auditTypeInfo.title}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(job.createdAt)}
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
              <span className="text-gray-400">
                {job.completedCount > 0 && (
                  <span className="text-green-400">{job.completedCount}✓</span>
                )}
                {job.completedCount > 0 && job.assignedCount > 0 && ' · '}
                {job.assignedCount > 0 && (
                  <span className="text-primary">{job.assignedCount}⏳</span>
                )}
                {job.completedCount === 0 && job.assignedCount === 0 && (
                  <span className="text-gray-500">0</span>
                )}
                <span className="text-gray-500">
                  {' '}
                  / {job.requiredVerifiers}
                </span>
              </span>
              <span className="text-gray-500">
                {Math.round(completedPercent)}%
              </span>
            </div>
            <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
              {isComplete ? (
                <div className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300 w-full" />
              ) : (
                <>
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
                    style={{
                      width: `${(job.completedCount / job.requiredVerifiers) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Bounties
              </div>
              <div className="text-white">{job.bountyIds.length}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Progress
              </div>
              <div className="text-white">
                {job.assignedCount}/{job.requiredVerifiers}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};
