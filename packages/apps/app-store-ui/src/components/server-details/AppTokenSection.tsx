import React, { useState } from 'react';
import { Principal } from '@icp-sdk/core/principal';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { WithdrawDialog } from '../WithdrawDialog';
import { DepositDialog } from '../DepositDialog';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import {
  useGetTokenBalanceForPrincipal,
  useGetTokenBalance,
} from '@/hooks/usePayment';
import { Section } from '../Section';
import { Wallet } from 'lucide-react';
import { Token } from '@prometheus-protocol/ic-js';
import { TokenManager } from '../token-manager';

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
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<{
    token: Token;
    canisterPrincipal: Principal;
  } | null>(null);
  const [selectedDepositToken, setSelectedDepositToken] =
    useState<Token | null>(null);

  // Get balance for the selected token if withdraw dialog is open
  const { data: selectedTokenBalance } = useGetTokenBalanceForPrincipal(
    selectedWithdrawToken?.token,
    selectedWithdrawToken?.canisterPrincipal,
  );

  // Get user's balance for the selected deposit token
  const { data: userTokenBalance } = useGetTokenBalance(
    selectedDepositToken || undefined,
  );

  const handleWithdraw = (token: Token, canisterPrincipal: Principal) => {
    setSelectedWithdrawToken({ token, canisterPrincipal });
    setWithdrawDialogOpen(true);
  };

  const handleDeposit = (token: Token) => {
    setSelectedDepositToken(token);
    setDepositDialogOpen(true);
  };

  const handleWithdrawDialogClose = (isOpen: boolean) => {
    setWithdrawDialogOpen(isOpen);
    if (!isOpen) {
      setSelectedWithdrawToken(null);
    }
  };

  const handleDepositDialogClose = (isOpen: boolean) => {
    setDepositDialogOpen(isOpen);
    if (!isOpen) {
      setSelectedDepositToken(null);
    }
  };

  // Don't render if user is not logged in
  if (!identity) {
    return null;
  }

  if (isLoading) {
    return (
      <Section title="Token Watchlist" icon={<Wallet className="h-5 w-5" />}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Token Watchlist" icon={<Wallet className="h-5 w-5" />}>
        <div className="text-red-500 p-4 border border-red-500/20 rounded-lg bg-red-500/5">
          Failed to load token registry: {error}
        </div>
      </Section>
    );
  }

  return (
    <Section title="Token Watchlist" icon={<Wallet className="h-5 w-5" />}>
      <div className="space-y-6">
        {/* Unified Token Watchlist - Always visible for logged-in users */}
        <TokenManager
          targetPrincipal={targetPrincipal}
          showPrincipalId={isOwnerOrDeveloper}
          principalIdLabel="App Canister Principal ID"
          principalIdDescription="Send tokens to this address to top up the app's balance"
          onDeposit={handleDeposit}
          onWithdraw={isOwnerOrDeveloper ? handleWithdraw : undefined}
        />

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

        {/* Deposit Dialog (Transfer to App Canister) */}
        {selectedDepositToken && (
          <DepositDialog
            token={selectedDepositToken}
            canisterPrincipal={targetPrincipal}
            isOpen={depositDialogOpen}
            onOpenChange={handleDepositDialogClose}
            currentBalance={
              userTokenBalance
                ? Number(selectedDepositToken.fromAtomic(userTokenBalance))
                : 0
            }
          />
        )}
      </div>
    </Section>
  );
};
