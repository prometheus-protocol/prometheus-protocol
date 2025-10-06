import React from 'react';
import { Principal } from '@dfinity/principal';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';
import { Loader2, Copy, Send, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/ui/TokenLogo';
import {
  useGetTokenBalance,
  useGetTokenBalanceForPrincipal,
} from '@/hooks/usePayment';
import { truncatePrincipal } from '@/lib/utils';

interface TokenBalanceItemProps {
  token: Token;
  onRemove?: () => void;
  onTransfer?: (token: Token) => void;
  onWithdraw?: (token: Token, canisterPrincipal: Principal) => void;
  targetPrincipal?: Principal;
}

export const TokenBalanceItem: React.FC<TokenBalanceItemProps> = ({
  token,
  onRemove,
  onTransfer,
  onWithdraw,
  targetPrincipal,
}) => {
  const { data: userBalance, isLoading: isLoadingUser } =
    useGetTokenBalance(token);
  const { data: targetBalance, isLoading: isLoadingTarget } =
    useGetTokenBalanceForPrincipal(token, targetPrincipal);

  const balance = targetPrincipal ? targetBalance : userBalance;
  const isLoading = targetPrincipal ? isLoadingTarget : isLoadingUser;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <TokenLogo token={token} size="sm" />
        <div>
          <div className="font-small">{token.name}</div>
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
      <div className="flex items-center gap-2 md:gap-3">
        <div className="text-right">
          <div className="font-medium text-sm md:text-base">
            {balance ? token.fromAtomic(balance) : '0'} {token.symbol}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onWithdraw && targetPrincipal && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onWithdraw(token, targetPrincipal)}
              title={`Withdraw ${token.symbol}`}>
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
          {onTransfer && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onTransfer(token)}
              title={`Transfer ${token.symbol}`}>
              <Send className="h-4 w-4" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
              title={`Remove ${token.symbol}`}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
