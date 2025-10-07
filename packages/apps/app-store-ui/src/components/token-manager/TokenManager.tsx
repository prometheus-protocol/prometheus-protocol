import React, { useState, useEffect, useMemo } from 'react';
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

// Helper function to convert TokenInfo (from watchlist) to Token (expected by TokenCard)
const tokenInfoToToken = (
  tokenInfo: any,
  logoUrl?: string,
): Token & { logo_url?: string } => {
  return {
    canisterId: tokenInfo.canisterId,
    symbol: tokenInfo.symbol,
    name: tokenInfo.name,
    decimals: tokenInfo.decimals,
    fee: tokenInfo.fee,
    logo_url: logoUrl, // Use logo URL from KongSwap if available
    toAtomic: (amount: string | number): bigint => {
      const amountStr = String(amount);
      const [integerPart, fractionalPart = ''] = amountStr.split('.');

      if (fractionalPart.length > tokenInfo.decimals) {
        throw new Error(
          `Amount "${amountStr}" has more than ${tokenInfo.decimals} decimal places.`,
        );
      }
      const combined =
        (integerPart || '0') + fractionalPart.padEnd(tokenInfo.decimals, '0');
      return BigInt(combined);
    },
    fromAtomic: (atomicAmount: bigint): string => {
      const atomicStr = atomicAmount
        .toString()
        .padStart(tokenInfo.decimals + 1, '0');
      const integerPart = atomicStr.slice(0, -tokenInfo.decimals);
      const fractionalPart = atomicStr
        .slice(-tokenInfo.decimals)
        .replace(/0+$/, '');

      return fractionalPart.length > 0
        ? `${integerPart}.${fractionalPart}`
        : integerPart;
    },
  };
};

export const TokenManager: React.FC<TokenManagerProps> = ({
  targetPrincipal,
  showPrincipalId = false,
  principalIdLabel = 'Principal ID',
  principalIdDescription = 'Send tokens to this address',
  onDeposit,
  onWithdraw,
}) => {
  const { identity } = useInternetIdentity();
  const {
    watchedTokenIds,
    watchedTokens,
    addWatchedToken,
    removeWatchedToken,
    isLoading,
  } = useWatchlist();

  // Fetch token registry to get logo URLs
  const { allTokens: registryTokens } = useTokenRegistry();

  // Create a lookup map: canisterId -> logo_url
  const logoMap = useMemo(() => {
    const map = new Map<string, string>();
    registryTokens.forEach((token) => {
      if (token.logo_url) {
        map.set(token.canisterId.toText(), token.logo_url);
      }
    });
    return map;
  }, [registryTokens]);

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

      {isLoading && watchedTokens.length === 0 ? (
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
          {watchedTokens.map((tokenInfo) => {
            // Look up logo URL from registry
            const logoUrl = logoMap.get(tokenInfo.canisterId.toText());
            const token = tokenInfoToToken(tokenInfo, logoUrl);
            return (
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
            );
          })}

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
