import React from 'react';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';
import { Loader2, Copy, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenLogo } from '@/components/ui/TokenLogo';
import { useGetTokenBalance } from '@/hooks/usePayment';
import { truncatePrincipal } from '@/lib/utils';

interface WalletTokenCardProps {
  token: Token;
  onRemove?: () => void;
  onTransfer?: (token: Token) => void;
}

export const WalletTokenCard: React.FC<WalletTokenCardProps> = ({
  token,
  onRemove,
  onTransfer,
}) => {
  const { data: balance, isLoading } = useGetTokenBalance(token);

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
    <div className="border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
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

      {/* Balance Display */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Balance</div>
          <div className="text-2xl font-semibold">
            {balance ? token.fromAtomic(balance) : '0'} {token.symbol}
          </div>
        </div>

        {/* Transfer Button */}
        {onTransfer && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onTransfer(token)}
            className="gap-2">
            <Send className="h-4 w-4" />
            Transfer
          </Button>
        )}
      </div>
    </div>
  );
};
