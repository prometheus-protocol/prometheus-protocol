import React, { useState } from 'react';
import { Principal } from '@icp-sdk/core/principal';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';
import { Loader2, Copy, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenLogo } from '@/components/ui/TokenLogo';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useGetTokenBalance,
  useGetTokenAllowance,
  useUpdateAllowance,
} from '@/hooks/usePayment';
import { truncatePrincipal } from '@/lib/utils';

interface TokenCardProps {
  token: Token;
  targetPrincipal: Principal;
  onRemove?: () => void;
}

export const TokenCard: React.FC<TokenCardProps> = ({
  token,
  targetPrincipal,
  onRemove,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: userBalance, isLoading: isLoadingUserBalance } =
    useGetTokenBalance(token);
  const { data: allowance, isLoading: isLoadingAllowance } =
    useGetTokenAllowance(targetPrincipal, token);
  const updateAllowance = useUpdateAllowance();
  const [newAllowance, setNewAllowance] = useState('');

  const isLoading = isLoadingUserBalance || isLoadingAllowance;

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        {/* Collapsible Header - Always visible */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <TokenLogo token={token} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg">{token.symbol}</div>
                <div className="flex items-center gap-1">
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {truncatePrincipal(token.canisterId.toText())}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(token.canisterId.toText());
                      toast.success(`${token.symbol} canister ID copied`);
                    }}
                    title={`Copy ${token.symbol} canister ID`}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick view - Current allowance */}
            <div className="flex items-center gap-3 ml-3">
              {/* Quick Allowance Display - Hidden on small screens */}
              <div className="hidden lg:flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="text-muted-foreground text-xs">Allowance</div>
                  <div className="font-semibold">
                    {allowance ? token.fromAtomic(allowance) : '0'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    title={`Remove ${token.symbol} from watchlist`}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Collapsible Content - Shows details when expanded */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            {/* Allowance Management Section */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Manage Allowance
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Set the maximum amount the app can pull from your wallet.
                </p>
              </div>

              {/* Current Allowance Display */}
              <div className="p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Current Allowance
                    </div>
                    <div className="text-lg font-semibold">
                      {allowance ? token.fromAtomic(allowance) : '0'}{' '}
                      {token.symbol}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">
                      Your Balance
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {userBalance ? token.fromAtomic(userBalance) : '0'}{' '}
                      {token.symbol}
                    </div>
                  </div>
                </div>
              </div>

              {/* Allowance Input and Actions */}
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    value={newAllowance}
                    onChange={(e) => setNewAllowance(e.target.value)}
                    placeholder={
                      allowance ? token.fromAtomic(allowance) : '0.00'
                    }
                    className="h-10 text-right pr-16"
                    disabled={updateAllowance.isPending}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">
                    {token.symbol}
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAllowance('10')}
                    disabled={updateAllowance.isPending}
                    className="h-8 text-xs">
                    10
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAllowance('100')}
                    disabled={updateAllowance.isPending}
                    className="h-8 text-xs">
                    100
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAllowance('1000')}
                    disabled={updateAllowance.isPending}
                    className="h-8 text-xs">
                    1K
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewAllowance('10000')}
                    disabled={updateAllowance.isPending}
                    className="h-8 text-xs">
                    10K
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={handleUpdateAllowance}
                    disabled={updateAllowance.isPending || !newAllowance}
                    className="flex-1">
                    {updateAllowance.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Approve
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
