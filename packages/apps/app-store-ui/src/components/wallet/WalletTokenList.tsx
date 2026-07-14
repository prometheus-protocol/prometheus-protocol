import React, { useMemo } from 'react';
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
import { AccountIdentifier } from '@icp-sdk/canisters/ledger/icp';

interface WalletTokenListProps {
  showPrincipalId?: boolean;
  onTransfer?: (token: Token) => void;
}

// Helper function to convert TokenInfo (from watchlist) to Token (with conversion methods)
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
    logo_url: logoUrl,
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

export const WalletTokenList: React.FC<WalletTokenListProps> = ({
  showPrincipalId = false,
  onTransfer,
}) => {
  const { identity } = useInternetIdentity();
  const {
    watchedTokenIds,
    watchedTokens: watchedTokenInfos,
    addWatchedToken,
    removeWatchedToken,
    isLoading: isLoadingWatchlist,
  } = useWatchlist();

  // Fetch token registry only to enrich watched tokens with logo URLs
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

  // Build the full Token list directly from the watchlist canister response.
  // This ensures every watched token is displayed regardless of whether it
  // appears in the token registry (which is mocked / sparse on local).
  const watchedTokens = useMemo(
    () =>
      watchedTokenInfos.map((info) =>
        tokenInfoToToken(info, logoMap.get(info.canisterId.toText())),
      ),
    [watchedTokenInfos, logoMap],
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
          <>
            <div className="mb-4 p-3 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">
                Your Wallet Principal ID
              </p>
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

            <div className="mb-4 p-3 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">ICP Wallet Address</p>
              <p className="text-xs text-muted-foreground mb-2">
                Use this address for receiving ICP from exchanges
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background px-2 py-1 rounded border font-mono break-all">
                  {AccountIdentifier.fromPrincipal({
                    principal: identity.getPrincipal(),
                  }).toHex()}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      AccountIdentifier.fromPrincipal({
                        principal: identity.getPrincipal(),
                      }).toHex(),
                    );
                    toast.success('ICP Account ID copied');
                  }}
                  title="Copy ICP Account ID">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}

        {isLoadingWatchlist && watchedTokens.length === 0 ? (
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
