import { Button } from '@/components/ui/button';
import Token from '@/components/Token';
import { truncatePrincipal } from '@/lib/utils';
import {
  Clock,
  ShieldQuestion,
  User,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { AuditBountyWithDetails, Tokens } from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  useClaimBounty,
  useGetReputationBalance,
  useReserveAuditBounty,
} from '@/hooks/useAuditBounties';
import { StartAuditDialog } from './StartAuditDialog';
import { ResourcesSection } from './ResourcesSection';

// The right-hand side panel, which shows the state of the BOUNTY
export const BountyPanel = ({ audit }: { audit: AuditBountyWithDetails }) => {
  const { identity, login } = useInternetIdentity();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    auditType,
    reward,
    stake,
    status,
    claimedBy,
    completedDate,
    lockExpiresAt,
  } = audit;
  const rewardAmount = Tokens.USDC.fromAtomic(reward);
  const stakeAmount = stake;
  const getReputationBalance = useGetReputationBalance(audit.auditType);
  const reserveAuditBounty = useReserveAuditBounty(audit.id);
  const auditorBalance = getReputationBalance.data ?? 0;
  const { mutate: claimBounty, isPending: isClaiming } = useClaimBounty();

  const handleClaimBounty = () => {
    claimBounty({
      bountyId: audit.id,
      wasmId: audit.projectName, // Assuming projectName is the wasmId
    });
  };

  const handleStartAudit = () => {
    if (!identity) {
      login();
      return;
    }
    // 3. Open the dialog instead of showing an alert
    setIsDialogOpen(true);
  };

  const handleConfirmClaim = async () => {
    await reserveAuditBounty.mutateAsync();
    console.log('Bounty claimed successfully!');
    setIsDialogOpen(false);
  };

  const InfoPanelItem = ({
    icon,
    label,
    children,
  }: {
    icon: ReactNode;
    label: string;
    children: ReactNode;
  }) => (
    <div className="flex items-start gap-4">
      <div className="text-primary mt-1">{icon}</div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="font-semibold text-white text-lg">{children}</p>
      </div>
    </div>
  );

  const renderPanelContent = () => {
    switch (status) {
      case 'Claimed':
      case 'In Prog':
        return (
          <div className="space-y-4">
            <InfoPanelItem icon={<User />} label="Claimed By">
              {claimedBy ? truncatePrincipal(claimedBy.toText()) : 'N/A'}
            </InfoPanelItem>
            <InfoPanelItem icon={<Clock />} label="Status">
              In Progress
            </InfoPanelItem>
            <InfoPanelItem icon={<Clock />} label="Bounty Expires At">
              {lockExpiresAt ? lockExpiresAt.toLocaleString() : 'N/A'}
            </InfoPanelItem>
            <ResourcesSection audit={audit} />
            <Button size="lg" className="w-full mt-4" disabled>
              Claimed
            </Button>
          </div>
        );
      case 'Completed':
        return (
          <div className="space-y-4">
            <InfoPanelItem icon={<CheckCircle2 />} label="Status">
              Completed
            </InfoPanelItem>
            <InfoPanelItem icon={<User />} label="Completed By">
              {claimedBy ? truncatePrincipal(claimedBy.toText()) : 'N/A'}
            </InfoPanelItem>
            <InfoPanelItem icon={<Clock />} label="Completed On">
              {completedDate ? completedDate.toLocaleDateString() : 'N/A'}
            </InfoPanelItem>
            <InfoPanelItem
              icon={<Token className="w-7 h-7" />}
              label="Rewarded">
              ${Number(rewardAmount).toLocaleString()} USDC
            </InfoPanelItem>
            <ResourcesSection audit={audit} />
          </div>
        );
      case 'AwaitingClaim':
        return (
          <>
            <InfoPanelItem
              icon={<CheckCircle2 className="text-green-500" />}
              label="Status">
              Attestation Submitted
            </InfoPanelItem>
            <p className="text-sm text-gray-400">
              Your attestation has been filed on-chain. Click below to claim
              your bounty reward.
            </p>
            <Button
              onClick={handleClaimBounty}
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-black font-bold text-lg mt-4"
              disabled={isClaiming}>
              {isClaiming ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                'Claim Bounty'
              )}
            </Button>
          </>
        );
      case 'Open':
      default:
        return (
          <div className="space-y-4">
            <InfoPanelItem icon={<Token className="w-7 h-7" />} label="Reward">
              ${Number(rewardAmount).toLocaleString()} USDC
            </InfoPanelItem>
            <InfoPanelItem icon={<ShieldQuestion />} label="Stake Required">
              {Number(stakeAmount).toLocaleString()} {auditType}
            </InfoPanelItem>
            <InfoPanelItem icon={<Clock />} label="Complete Within">
              72 Hours
            </InfoPanelItem>
            <ResourcesSection audit={audit} />
            <Button
              onClick={handleStartAudit}
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-black font-bold text-lg mt-4">
              {identity ? 'Start Audit' : 'Log in to Start Audit'}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="bg-card/50 border border-gray-700 rounded-lg p-6 space-y-6 h-fit">
      <h2 className="text-xl font-bold text-white">Bounty Details</h2>
      <div className="space-y-6">{renderPanelContent()}</div>
      <StartAuditDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        audit={audit}
        auditorBalance={auditorBalance}
        onConfirm={handleConfirmClaim}
      />
    </div>
  );
};
