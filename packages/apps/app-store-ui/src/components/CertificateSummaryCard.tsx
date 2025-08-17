import { Certificate, FeaturedServer } from '@/lib/mock-data';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';

interface CertificateSummaryCardProps {
  certificate: Certificate;
}

export function CertificateSummaryCard({
  certificate,
}: CertificateSummaryCardProps) {
  const tierInfo = getTierInfo({ certificate } as FeaturedServer);

  return (
    <div
      className={cn(
        'border rounded-lg p-4 md:p-6 mb-12',
        tierInfo.borderColorClass,
      )}>
      <div className="flex justify-between items-center">
        <div>
          <p className={cn('text-xl font-bold', tierInfo.textColorClass)}>
            {tierInfo.name}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tierInfo.description}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-5xl font-bold', tierInfo.textColorClass)}>
            {certificate.overallScore}
            <span className="text-xl font-normal text-muted-foreground">
              /100
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Overall Score</p>
        </div>
      </div>
    </div>
  );
}
