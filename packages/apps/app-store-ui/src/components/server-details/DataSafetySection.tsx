import { useState } from 'react';
import { Lock, Hourglass } from 'lucide-react';
import { Button } from '../ui/button';
import { CreateBountyDialog } from './CreateBountyDialog';
import { AuditBounty, DataSafetyInfo, Token } from '@prometheus-protocol/ic-js';
import { Link } from 'react-router-dom';

// 1. Update the props to include bounty, appId, and paymentToken
interface DataSafetySectionProps {
  safetyInfo: DataSafetyInfo;
  bounty?: AuditBounty;
  appId: string;
  paymentToken: Token;
}

export function DataSafetySection({
  safetyInfo,
  bounty,
  appId,
  paymentToken,
}: DataSafetySectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasData =
    safetyInfo && safetyInfo.dataPoints && safetyInfo.dataPoints.length > 0;
  const hasBounty = !!bounty;
  const auditType = 'data_safety_v1';

  const renderContent = () => {
    // 2. Implement the 3-state rendering logic
    if (hasData) {
      // STATE 1: Attestation is complete. Show the full details.
      return (
        <>
          <p className="text-muted-foreground mb-6">
            {safetyInfo.overallDescription}
          </p>
          <div className="border border-border rounded-lg p-6 space-y-4">
            <ul className="list-disc list-inside space-y-3">
              {safetyInfo.dataPoints.map((point, index) => (
                <li key={index}>
                  <span className="font-semibold">{point.title}:</span>{' '}
                  <span className="text-muted-foreground">
                    {point.description}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-800 pt-4 mt-6">
              <p className="text-xs text-muted-foreground italic">
                The data safety practices listed above have been attested to by
                an independent auditor based on the developer's claims.
              </p>
            </div>
          </div>
        </>
      );
    }

    if (hasBounty) {
      // STATE 2: No attestation, but a bounty exists. Show the "Awaiting Audit" panel.
      return (
        <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
          <Hourglass className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold">Bounty Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            A bounty of{' '}
            <span className="font-bold text-foreground">
              {paymentToken.fromAtomic(bounty.tokenAmount)}{' '}
              {paymentToken.symbol}
            </span>{' '}
            has been sponsored for this audit.
          </p>
          <Link to={`/audit-hub/${bounty.id.toString()}`}>
            <Button>View Bounty</Button>
          </Link>
        </div>
      );
    }

    // STATE 3: No attestation and no bounty. Show the "Sponsor Bounty" button.
    return (
      <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold">No Data Safety Attestation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The developer has not yet provided data safety information for this
          app.
        </p>
        <Button onClick={() => setIsDialogOpen(true)}>Sponsor Bounty</Button>
      </div>
    );
  };

  return (
    <>
      <section>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6" />
          Data Safety
        </h2>
        {renderContent()}
      </section>

      {/* 3. Render the dialog, controlled by the component's state */}
      <CreateBountyDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        appId={appId}
        auditType={auditType}
        paymentToken={paymentToken}
      />
    </>
  );
}
