// src/components/server-details/SponsorPrompt.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Hourglass, Wrench } from 'lucide-react';
import { CreateBountyDialog } from './CreateBountyDialog';
import { AuditBounty, Token } from '@prometheus-protocol/ic-js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface SponsorPromptProps {
  icon: React.ElementType;
  title: string;
  description: string;
  auditType: string;
  bounty?: AuditBounty;
  paymentToken: Token;
  wasmId: string; // The app's namespace
  isArchived?: boolean; // Optional prop to indicate if the app is archived
}

export function SponsorPrompt({
  icon: Icon,
  title,
  description,
  auditType,
  bounty,
  paymentToken,
  wasmId,
  isArchived,
}: SponsorPromptProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasBounty = !!bounty;

  return (
    <>
      <section>
        <div className="space-y-1 pb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Icon className="w-6 h-6" />
            {title}
          </h2>
        </div>
        {hasBounty && (
          // STATE 1: No attestation, but a bounty exists.
          <div className="border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
            <Hourglass className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">Awaiting Audit</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
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
        )}
        {!hasBounty && !isArchived && (
          // STATE 2: No attestation and no bounty.
          <div className="border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
            <Icon className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">Attestation Needed</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {description}
            </p>
            <Button onClick={() => setIsDialogOpen(true)} disabled={isArchived}>
              Sponsor Bounty
            </Button>
          </div>
        )}
        {isArchived && (
          <div className="border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
            <Icon className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">Attestation Needed</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {description}
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Wrap the button in a span to allow tooltip on disabled elements */}
                  <span tabIndex={0}>
                    <Button
                      onClick={() => setIsDialogOpen(true)}
                      disabled={isArchived} // Use the new prop here
                      className="w-full sm:w-auto">
                      Sponsor Bounty
                    </Button>
                  </span>
                </TooltipTrigger>
                {isArchived && (
                  <TooltipContent>
                    <p>
                      Bounties can only be sponsored for the latest version.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </section>

      <CreateBountyDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        wasmId={wasmId}
        auditType={auditType}
        paymentToken={paymentToken}
      />
    </>
  );
}
