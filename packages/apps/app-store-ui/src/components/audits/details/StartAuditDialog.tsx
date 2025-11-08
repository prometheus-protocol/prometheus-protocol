import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { AuditBountyWithDetails, Tokens } from '@prometheus-protocol/ic-js';
import { truncateHash } from '@prometheus-protocol/ic-js/utils';
import { getReputationDisplayInfo } from '@/components/LoginButton';

interface StartAuditDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  audit: AuditBountyWithDetails;
  walletBalance: number; // USDC in wallet (human-readable)
  auditHubBalance: number; // USDC already staked in audit hub (human-readable)
  neededStake: number; // Additional USDC needed to deposit (human-readable)
  hasEnoughInWallet: boolean; // Whether wallet has enough to cover needed stake
  onConfirm: () => Promise<void>; // A function to call when "Stake and Claim" is clicked
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between w-full text-left">
    <span className="text-primary font-semibold">{label}:</span>
    <span className="text-gray-200">{value}</span>
  </div>
);

export function StartAuditDialog({
  isOpen,
  onOpenChange,
  audit,
  walletBalance,
  auditHubBalance,
  neededStake,
  hasEnoughInWallet,
  onConfirm,
}: StartAuditDialogProps) {
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stakeRequired = Number(Tokens.USDC.fromAtomic(audit.stake));

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      // On success, the parent component will handle closing the dialog
    } catch (error) {
      console.error('Failed to claim bounty:', error);
      // Optionally show a toast notification on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const reputationDisplayInfo = getReputationDisplayInfo(audit.auditType);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="border-gray-600 shadow-none sm:max-w-lg">
        <div className="flex flex-col items-center text-center sm:p-4">
          {/* You'll need to add this image to your /public folder */}
          <img
            src="/images/pmp-token.png"
            alt="Prometheus Protocol"
            className="w-24 h-24 mb-6"
          />
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-white mb-12">
              Confirmation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-lg w-full flex flex-col items-center mb-12">
            <DetailRow label="WASM" value={truncateHash(audit.projectName)} />
            <DetailRow label="Time limit for completion" value="72 Hours" />
            <DetailRow
              label="Stake required"
              value={`$${stakeRequired.toLocaleString()} USDC`}
            />
            <DetailRow
              label="Already staked in Audit Hub"
              value={`$${auditHubBalance.toLocaleString()} USDC`}
            />
            {neededStake > 0 && (
              <DetailRow
                label="Additional stake needed"
                value={`$${neededStake.toLocaleString()} USDC`}
              />
            )}
            <DetailRow
              label="Wallet balance"
              value={`$${walletBalance.toLocaleString()} USDC`}
            />
          </div>

          {!hasEnoughInWallet && neededStake > 0 && (
            <p className="text-left text-sm text-red-400 max-w-md mb-4">
              <strong>Insufficient wallet balance:</strong> You need $
              {neededStake.toLocaleString()} more USDC in your wallet to stake
              for this bounty.
            </p>
          )}

          <p className="text-left text-sm text-gray-400 max-w-md mb-4">
            By clicking the "Stake and Claim" button, you agree to stake the
            required amount of USDC for this bounty. If the project is not
            completed within the specified time frame, the staked tokens will be
            deducted from your account as outlined in the bounty terms.
          </p>

          <div className="flex space-x-2 mb-12 w-full max-w-md">
            <Checkbox
              id="agree-terms"
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
            />
            <Label htmlFor="agree-terms" className="text-gray-300">
              I agree
            </Label>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={
              !isAgreed ||
              isSubmitting ||
              (neededStake > 0 && !hasEnoughInWallet)
            }
            size="lg"
            className="bg-primary hover:bg-primary/90 text-black font-bold px-12 py-6 text-lg w-full max-w-xs">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              'Stake and Claim'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
