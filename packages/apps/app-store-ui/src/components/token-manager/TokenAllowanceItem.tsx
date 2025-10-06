import React, { useState } from 'react';
import { Principal } from '@dfinity/principal';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';
import { Loader2, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenLogo } from '@/components/ui/TokenLogo';
import {
  useGetTokenAllowance,
  useGetTokenBalance,
  useUpdateAllowance,
} from '@/hooks/usePayment';
import { truncatePrincipal } from '@/lib/utils';

interface TokenAllowanceItemProps {
  token: Token;
  spender: Principal;
  onRemove?: () => void;
}

export const TokenAllowanceItem: React.FC<TokenAllowanceItemProps> = ({
  token,
  spender,
  onRemove,
}) => {
  const { data: allowance, isLoading: isLoadingAllowance } =
    useGetTokenAllowance(spender, token);
  const { data: balance, isLoading: isLoadingBalance } =
    useGetTokenBalance(token);
  const updateAllowance = useUpdateAllowance();
  const [newAmount, setNewAmount] = useState('');

  const handleUpdateAllowance = async () => {
    try {
      await updateAllowance.mutateAsync({ token, spender, amount: newAmount });
      setNewAmount('');
      toast.success('Allowance updated successfully');
    } catch (error) {
      toast.error('Failed to update allowance');
    }
  };

  if (isLoadingAllowance || isLoadingBalance) {
    return (
      <div className="flex items-center gap-2 p-3">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-start justify-between">
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

      <div className="text-left">
        <div className="font-medium text-sm md:text-base">
          {balance ? token.fromAtomic(balance) : '0'} {token.symbol}
        </div>
        <div className="text-xs text-muted-foreground">Your Balance</div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
        <div className="flex-1">
          <Input
            value={newAmount || (allowance ? token.fromAtomic(allowance) : '0')}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="0.00"
            className="h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpdateAllowance}
          disabled={updateAllowance.isPending || !newAmount}
          className="px-4">
          {updateAllowance.isPending && (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          )}
          Update
        </Button>
      </div>
    </div>
  );
};
