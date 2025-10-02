import React, { useState } from 'react';
import { Principal } from '@dfinity/principal';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { TokenManager } from '../TokenManager';
import { WithdrawDialog } from '../WithdrawDialog';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { useGetTokenBalanceForPrincipal } from '@/hooks/usePayment';
import { Section } from '../Section';
import { Wallet } from 'lucide-react';
import { Token } from '@prometheus-protocol/ic-js';

interface AppTokenSectionProps {
  targetPrincipal: Principal;
  isOwnerOrDeveloper: boolean;
  appName: string;
}

export const AppTokenSection: React.FC<AppTokenSectionProps> = ({
  targetPrincipal,
  isOwnerOrDeveloper,
}) => {
  const { identity } = useInternetIdentity();
  const { isLoading, error } = useTokenRegistry();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<{
    token: Token;
    canisterPrincipal: Principal;
  } | null>(null);

  // Get balance for the selected token if withdraw dialog is open
  const { data: selectedTokenBalance } = useGetTokenBalanceForPrincipal(
    selectedWithdrawToken?.token,
    selectedWithdrawToken?.canisterPrincipal,
  );

  const handleWithdraw = (token: Token, canisterPrincipal: Principal) => {
    setSelectedWithdrawToken({ token, canisterPrincipal });
    setWithdrawDialogOpen(true);
  };

  const handleWithdrawDialogClose = (isOpen: boolean) => {
    setWithdrawDialogOpen(isOpen);
    if (!isOpen) {
      setSelectedWithdrawToken(null);
    }
  };

  // Don't render if user is not logged in
  if (!identity) {
    return null;
  }

  if (isLoading) {
    return (
      <Section title="Token Management" icon={<Wallet className="h-5 w-5" />}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Token Management" icon={<Wallet className="h-5 w-5" />}>
        <div className="text-red-500 p-4 border border-red-500/20 rounded-lg bg-red-500/5">
          Failed to load token registry: {error}
        </div>
      </Section>
    );
  }

  return (
    <Section title="Token Management" icon={<Wallet className="h-5 w-5" />}>
      <div className="space-y-6">
        {/* Token Allowances - Always visible for logged-in users */}
        <TokenManager mode="allowance" targetPrincipal={targetPrincipal} />

        {/* Canister Wallet - Only visible for owners/developers */}
        {isOwnerOrDeveloper && (
          <TokenManager
            mode="balance"
            targetPrincipal={targetPrincipal}
            showPrincipalId={true}
            principalIdLabel="App Canister Principal ID"
            principalIdDescription="Send tokens to this address to top up the app's balance"
            onWithdraw={handleWithdraw}
          />
        )}

        {/* Withdraw Dialog */}
        {selectedWithdrawToken && (
          <WithdrawDialog
            token={selectedWithdrawToken.token}
            canisterPrincipal={selectedWithdrawToken.canisterPrincipal}
            isOpen={withdrawDialogOpen}
            onOpenChange={handleWithdrawDialogClose}
            currentBalance={
              selectedTokenBalance
                ? Number(
                    selectedWithdrawToken.token.fromAtomic(
                      selectedTokenBalance,
                    ),
                  )
                : 0
            }
          />
        )}
      </div>
    </Section>
  );
};
