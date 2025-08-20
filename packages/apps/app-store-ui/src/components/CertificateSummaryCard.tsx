import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import {
  AppStoreDetails,
  VerificationStatus,
} from '@prometheus-protocol/ic-js';

// 1. Update the props to accept our live data objects.
interface CertificateSummaryCardProps {
  appDetails: AppStoreDetails;
  verificationStatus: VerificationStatus;
}

export function CertificateSummaryCard({
  appDetails,
  verificationStatus,
}: CertificateSummaryCardProps) {
  // 2. Get tier info directly from the app's security tier.
  const tierInfo = getTierInfo(appDetails.securityTier);

  return (
    <div
      className={cn(
        'border rounded-lg p-4 md:p-6 mb-12',
        tierInfo.borderColorClass, // The dynamic border color is still relevant.
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

        {/* Right side: Replaces "Score" with factual verification data */}
        <div className="text-right">
          {/* 3. Display the number of completed audits */}
          <p className={cn('text-5xl font-bold', tierInfo.textColorClass)}>
            {verificationStatus.attestations.length}
          </p>
          <p className="text-xs text-muted-foreground">Completed Audits</p>
        </div>
      </div>
    </div>
  );
}
