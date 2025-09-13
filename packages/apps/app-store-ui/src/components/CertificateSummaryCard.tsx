import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { AppStoreDetails, CORE_AUDIT_TYPES } from '@prometheus-protocol/ic-js';

interface CertificateSummaryCardProps {
  appDetails: AppStoreDetails;
}

export function CertificateSummaryCard({
  appDetails,
}: CertificateSummaryCardProps) {
  const tierInfo = getTierInfo(appDetails.securityTier);

  // --- THE FIX: Use the new, unified auditRecords array ---
  // Both attestations and divergences count as completed audits, so we can use the array's length.
  const completedAuditsCount = appDetails.auditRecords.length;

  return (
    <div
      className={cn(
        'border rounded-lg p-4 md:p-6 mb-12',
        tierInfo.borderColorClass,
      )}>
      <div className="flex justify-between items-center">
        {/* Left side: Displays the calculated Security Tier */}
        <div>
          <p className={cn('text-xl font-bold', tierInfo.textColorClass)}>
            {tierInfo.name}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tierInfo.description}
          </p>
        </div>

        {/* Right side: Displays the corrected verification data */}
        <div className="text-right">
          <p className={cn('text-5xl font-bold', tierInfo.textColorClass)}>
            {/* Use the new, correct count */}
            {completedAuditsCount} / {CORE_AUDIT_TYPES.length}
          </p>
          <p className="text-xs text-muted-foreground">Completed Audits</p>
        </div>
      </div>
    </div>
  );
}
