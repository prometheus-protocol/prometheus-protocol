import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { AppStoreDetails, CORE_AUDIT_TYPES } from '@prometheus-protocol/ic-js';

interface CertificateSummaryCardProps {
  appDetails: AppStoreDetails;
}

export function CertificateSummaryCard({
  appDetails,
}: CertificateSummaryCardProps) {
  // --- 1. DECONSTRUCT `latestVersion` FROM THE MAIN PROP ---
  // This is the key to accessing the correct, version-specific data.
  const { latestVersion } = appDetails;

  // --- 2. PULL DATA FROM THE `latestVersion` OBJECT ---
  const tierInfo = getTierInfo(latestVersion.securityTier);

  const uniqueCompletedAudits = new Set(
    latestVersion.auditRecords
      .filter((record) => record.type === 'attestation')
      .map((record) => (record as any).audit_type), // Cast to any to access audit_type
  ).size;

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
        <div className="text-right shrink-0">
          <p className={cn('text-5xl font-bold', tierInfo.textColorClass)}>
            {uniqueCompletedAudits} / {CORE_AUDIT_TYPES.length}
          </p>
          <p className="text-xs text-muted-foreground">Successful Audits</p>
        </div>
      </div>
    </div>
  );
}
