import React, { useState, useEffect } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { toast } from 'sonner';
import { Loader2, Copy } from 'lucide-react';
import { Token } from '@prometheus-protocol/ic-js';
import { Button } from '@/components/ui/button';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { useWatchlist } from '@/hooks/useWatchlist';
import { TokenManagerProps } from './types';
import { TokenCard } from './TokenCard';
import { AddTokenDialog } from './AddTokenDialog';

export const TokenManager: React.FC<TokenManagerProps> = ({
  targetPrincipal,
  showPrincipalId = false,
  principalIdLabel = 'Principal ID',
  principalIdDescription = 'Send tokens to this address',
  onDeposit,
  onWithdraw,
}) => {
  const { identity } = useInternetIdentity();
  const { watchedTokenIds, addWatchedToken, removeWatchedToken } =
    useWatchlist();

  const { allTokens, isLoading: isLoadingTokens } = useTokenRegistry();
  const [missingWatchedTokens, setMissingWatchedTokens] = useState<Token[]>([]);

  // This separate registry instance is specifically for finding watched tokens
  // that might not be in the main `allTokens` list (e.g., from a different page).
  const {
    tokens: searchResults,
    serverSearchTerm: missingTokenSearchTerm,
    setServerSearchTerm: setMissingTokenSearchTerm,
  } = useTokenRegistry();

  // Effect to find any watched token IDs that aren't in our main list
  useEffect(() => {
    if (isLoadingTokens || watchedTokenIds.length === 0) return;

    const missingIds = watchedTokenIds.filter(
      (id) => !allTokens.some((token) => token.canisterId.toText() === id),
    );

    if (missingIds.length > 0 && missingIds[0] !== missingTokenSearchTerm) {
      setMissingTokenSearchTerm(missingIds[0]);
    } else if (missingIds.length === 0) {
      setMissingTokenSearchTerm('');
    }
  }, [
    watchedTokenIds,
    allTokens,
    isLoadingTokens,
    missingTokenSearchTerm,
    setMissingTokenSearchTerm,
  ]);

  // Effect to add found tokens to our local `missingWatchedTokens` state
  useEffect(() => {
    if (searchResults.length > 0) {
      setMissingWatchedTokens((prev) => {
        const newTokens = searchResults.filter(
          (newToken) =>
            !prev.some(
              (p) => p.canisterId.toText() === newToken.canisterId.toText(),
            ) && watchedTokenIds.includes(newToken.canisterId.toText()),
        );
        return [...prev, ...newTokens];
      });
    }
  }, [searchResults, watchedTokenIds]);

  // Combine tokens and deduplicate by canister ID
  const combinedTokenList = [...allTokens, ...missingWatchedTokens];
  const uniqueTokenMap = new Map(
    combinedTokenList.map((token) => [token.canisterId.toText(), token]),
  );
  const watchedTokens = Array.from(uniqueTokenMap.values()).filter((token) =>
    watchedTokenIds.includes(token.canisterId.toText()),
  );

  if (!identity) {
    return (
      <div className="pt-6 text-center text-muted-foreground">
        Please log in to view token information.
      </div>
    );
  }

  return (
    <>
      {showPrincipalId && (
        <div className="mb-4 p-3 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-1">{principalIdLabel}</p>
          <p className="text-xs text-muted-foreground mb-2">
            {principalIdDescription}
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-background px-2 py-1 rounded border font-mono break-all">
              {targetPrincipal.toText()}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                navigator.clipboard.writeText(targetPrincipal.toText());
                toast.success('Principal ID copied');
              }}
              title="Copy Principal ID">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {isLoadingTokens && watchedTokens.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading tokens...
        </div>
      ) : watchedTokens.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <p className="mb-4">
            No tokens in your watchlist. Add tokens to get started.
          </p>
          <AddTokenDialog
            watchedTokenIds={watchedTokenIds}
            onAddToken={addWatchedToken}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {watchedTokens.map((token) => (
            <TokenCard
              key={token.canisterId.toText()}
              token={token}
              targetPrincipal={targetPrincipal}
              onDeposit={onDeposit}
              onWithdraw={onWithdraw}
              onRemove={() => {
                removeWatchedToken(token.canisterId.toText());
                toast.success(`${token.symbol} removed from watchlist`);
              }}
            />
          ))}

          {/* Add Token Button */}
          <div className="pt-2">
            <AddTokenDialog
              watchedTokenIds={watchedTokenIds}
              onAddToken={addWatchedToken}
            />
          </div>
        </div>
      )}
    </>
  );
};
