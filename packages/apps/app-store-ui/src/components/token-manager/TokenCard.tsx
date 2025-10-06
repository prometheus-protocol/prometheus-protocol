import React, { useState } from 'react';
import { Principal } from '@dfinity/principal';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';
import { Loader2, Copy, ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenLogo } from '@/components/ui/TokenLogo';
import {
  useGetTokenBalance,
  useGetTokenBalanceForPrincipal,
  useGetTokenAllowance,
  useUpdateAllowance,
} from '@/hooks/usePayment';
import { truncatePrincipal } from '@/lib/utils';

interface TokenCardProps {
  token: Token;
  targetPrincipal: Principal;
  onRemove?: () => void;
  onDeposit?: (token: Token) => void;
  onWithdraw?: (token: Token, canisterPrincipal: Principal) => void;
}

export const TokenCard: React.FC<TokenCardProps> = ({
  token,
  targetPrincipal,
  onRemove,
  onDeposit,
  onWithdraw,
}) => {
  const { data: userBalance, isLoading: isLoadingUserBalance } =
    useGetTokenBalance(token);
  const { data: appBalance, isLoading: isLoadingAppBalance } =
    useGetTokenBalanceForPrincipal(token, targetPrincipal);
  const { data: allowance, isLoading: isLoadingAllowance } =
    useGetTokenAllowance(targetPrincipal, token);
  const updateAllowance = useUpdateAllowance();
  const [newAllowance, setNewAllowance] = useState('');

  const isLoading =
    isLoadingUserBalance || isLoadingAppBalance || isLoadingAllowance;

  const handleUpdateAllowance = async () => {
    try {
      await updateAllowance.mutateAsync({
        token,
        spender: targetPrincipal,
        amount: newAllowance,
      });
      setNewAllowance('');
      toast.success('Allowance updated successfully');
    } catch (error) {
      toast.error('Failed to update allowance');
    }
  };

  const handleSetMaxAllowance = async () => {
    try {
      // Set to a very large number to represent "max"
      const maxAmount = '1000000000';
      await updateAllowance.mutateAsync({
        token,
        spender: targetPrincipal,
        amount: maxAmount,
      });
      setNewAllowance('');
      toast.success('Allowance set to maximum');
    } catch (error) {
      toast.error('Failed to set maximum allowance');
    }
  };

  const handleRevokeAllowance = async () => {
    try {
      await updateAllowance.mutateAsync({
        token,
        spender: targetPrincipal,
        amount: '0',
      });
      setNewAllowance('');
      toast.success('Allowance revoked');
    } catch (error) {
      toast.error('Failed to revoke allowance');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 border rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Loading {token.symbol}...
        </span>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <TokenLogo token={token} size="md" />
          <div>
            <div className="font-semibold text-lg">{token.symbol}</div>
            <div className="flex items-center gap-1">
              <div className="text-xs text-muted-foreground font-mono">
                {truncatePrincipal(token.canisterId.toText())}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  navigator.clipboard.writeText(token.canisterId.toText());
                  toast.success(`${token.symbol} canister ID copied`);
                }}
                title={`Copy ${token.symbol} canister ID`}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            title={`Remove ${token.symbol} from watchlist`}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Balances Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Balances
        </h3>

        {/* Mobile Layout (Stacked) */}
        <div className="flex flex-col gap-3 md:hidden">
          {/* Your Wallet */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">
              Your Wallet
            </div>
            <div className="text-lg font-semibold">
              {userBalance ? token.fromAtomic(userBalance) : '0'} {token.symbol}
            </div>
          </div>

          {/* Action Buttons */}
          {(onDeposit || onWithdraw) && (
            <div className="flex gap-2">
              {onDeposit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeposit(token)}
                  className="flex-1 h-9"
                  title={`Deposit ${token.symbol} to app`}>
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Deposit
                </Button>
              )}
              {onWithdraw && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWithdraw(token, targetPrincipal)}
                  className="flex-1 h-9"
                  title={`Withdraw ${token.symbol} from app`}>
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Withdraw
                </Button>
              )}
            </div>
          )}

          {/* App Canister Balance */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">
              App Canister Balance
            </div>
            <div className="text-lg font-semibold">
              {appBalance ? token.fromAtomic(appBalance) : '0'} {token.symbol}
            </div>
          </div>
        </div>

        {/* Desktop Layout (Side by Side) */}
        <div className="hidden md:grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Your Wallet */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              Your Wallet
            </div>
            <div className="text-xl font-semibold">
              {userBalance ? token.fromAtomic(userBalance) : '0'}
            </div>
            <div className="text-xs text-muted-foreground">{token.symbol}</div>
          </div>

          {/* Action Buttons */}
          {(onDeposit || onWithdraw) && (
            <div className="flex flex-col gap-2">
              {onDeposit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeposit(token)}
                  className="h-9 px-3"
                  title={`Deposit ${token.symbol} to app`}>
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Deposit
                </Button>
              )}
              {onWithdraw && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWithdraw(token, targetPrincipal)}
                  className="h-9 px-3"
                  title={`Withdraw ${token.symbol} from app`}>
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Withdraw
                </Button>
              )}
            </div>
          )}

          {/* App Canister Balance */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              App Canister Balance
            </div>
            <div className="text-xl font-semibold">
              {appBalance ? token.fromAtomic(appBalance) : '0'}
            </div>
            <div className="text-xs text-muted-foreground">{token.symbol}</div>
          </div>
        </div>
      </div>

      {/* Allowance Section */}
      <div className="space-y-3 pt-4 border-t">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Allowance
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            The max amount the app can pull from your wallet.
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Input
              value={
                newAllowance ||
                (allowance ? token.fromAtomic(allowance) : '0.00')
              }
              onChange={(e) => setNewAllowance(e.target.value)}
              placeholder="0.00"
              className="h-10 text-right pr-16"
              disabled={updateAllowance.isPending}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">
              {token.symbol}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="default"
              onClick={handleUpdateAllowance}
              disabled={updateAllowance.isPending || !newAllowance}
              className="flex-1">
              {updateAllowance.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Update
            </Button>
            <Button
              variant="outline"
              onClick={handleSetMaxAllowance}
              disabled={updateAllowance.isPending}
              className="flex-1">
              Set Max
            </Button>
            <Button
              variant="outline"
              onClick={handleRevokeAllowance}
              disabled={updateAllowance.isPending}
              className="flex-1">
              Revoke
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
