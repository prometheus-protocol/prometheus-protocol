import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useSponsorBounty } from '@/hooks/useAuditBounties';
import { ProcessedVerificationRecord } from '@prometheus-protocol/ic-js';

interface CreateBountyDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  wasmId: string; // The WASM ID
  auditType: string;
  verificationRequest: ProcessedVerificationRecord;
  onSuccess?: () => void;
}

export function CreateBountyDialog({
  isOpen,
  onOpenChange,
  wasmId,
  auditType,
  verificationRequest,
  onSuccess,
}: CreateBountyDialogProps) {
  const { mutate: sponsorBounty, isPending, status } = useSponsorBounty();

  function handleSponsor() {
    sponsorBounty(
      {
        wasmId,
        auditTypes: [auditType],
        verificationRequest,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sponsor Bounties</DialogTitle>
          <DialogDescription className="text-sm text-primary">
            {auditType}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will create 9 bounties (one for each verifier) for the{' '}
            <span className="font-semibold">{auditType}</span> audit type.
          </p>
          <p className="text-sm text-muted-foreground">
            The bounties are funded by the Bounty Sponsor canister and will be
            available for verifiers to claim once they complete their audits.
          </p>
          <div className="border border-border rounded-md p-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Audit Type:</span>
              <span className="font-mono text-foreground">{auditType}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-muted-foreground">Bounties Created:</span>
              <span className="font-mono text-foreground">9</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSponsor}
            disabled={isPending}
            className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? status : 'Sponsor Bounties'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
