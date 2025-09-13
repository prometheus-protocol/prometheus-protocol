import { useState } from 'react';
import { MessageSquare, Hourglass } from 'lucide-react';
import { Button } from '../ui/button';
import { CreateBountyDialog } from './CreateBountyDialog';
import { AuditBounty, Token } from '@prometheus-protocol/ic-js';
import { Link } from 'react-router-dom';

// Define a type for reviews (can be expanded later)
interface Review {
  author: string;
  rating: number;
  comment: string;
}

// 1. Update the props to include bounty, appId, and paymentToken
interface ReviewsSectionProps {
  reviews: Review[];
  bounty?: AuditBounty;
  appId: string;
  paymentToken: Token;
}

export function ReviewsSection({
  reviews,
  bounty,
  appId,
  paymentToken,
}: ReviewsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasReviews = reviews && reviews.length > 0;
  const hasBounty = !!bounty;
  const auditType = 'review_v1';

  const renderContent = () => {
    // 2. Implement the 3-state rendering logic
    if (hasReviews) {
      // STATE 1: Attestation is complete. Show the reviews.
      // (Placeholder for the actual review rendering logic)
      return (
        <div className="border border-border rounded-lg p-6">
          <p className="text-muted-foreground">Review display coming soon...</p>
          {/* You would map over the `reviews` array here to display them */}
        </div>
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
        <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold">No Reviews Attestation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This app has not yet been audited for user reviews.
        </p>
        <Button onClick={() => setIsDialogOpen(true)}>Sponsor Bounty</Button>
      </div>
    );
  };

  return (
    <>
      <section>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <MessageSquare className="w-6 h-6" />
          Ratings and Reviews
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
