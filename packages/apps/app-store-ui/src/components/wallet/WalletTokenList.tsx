import React, { useState, useEffect } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { toast } from 'sonner';
import { Loader2, Wallet, Copy } from 'lucide-react';
import { Token } from '@prometheus-protocol/ic-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { useWatchlist } from '@/hooks/useWatchlist';
import { WalletTokenCard } from './WalletTokenCard';
import { AddTokenDialog } from '../token-manager/AddTokenDialog';

interface WalletTokenListProps {
  showPrincipalId?: boolean;
  onTransfer?: (token: Token) => void;
}

export const WalletTokenList: React.FC<WalletTokenListProps> = ({
  showPrincipalId = false,
  onTransfer,
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
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Please log in to view token information.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Your Tokens
          <AddTokenDialog
            watchedTokenIds={watchedTokenIds}
            onAddToken={addWatchedToken}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {showPrincipalId && (
          <div className="mb-4 p-3 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-1">Your Wallet Principal ID</p>
            <p className="text-xs text-muted-foreground mb-2">
              This is your wallet address for receiving tokens
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded border font-mono break-all">
                {identity.getPrincipal().toText()}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  navigator.clipboard.writeText(
                    identity.getPrincipal().toText(),
                  );
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
            No tokens in your watchlist. Add tokens to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {watchedTokens.map((token) => (
              <WalletTokenCard
                key={token.canisterId.toText()}
                token={token}
                onTransfer={onTransfer}
                onRemove={() => {
                  removeWatchedToken(token.canisterId.toText());
                  toast.success(`${token.symbol} removed from watchlist`);
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
