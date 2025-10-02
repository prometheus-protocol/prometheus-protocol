import React, { useState, useCallback, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Loader2,
  Wallet,
  Shield,
  Plus,
  Check,
  ChevronsUpDown,
  X,
  Copy,
  Send,
  ArrowUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Token } from '@prometheus-protocol/ic-js';
import {
  useGetTokenBalance,
  useGetTokenBalanceForPrincipal,
  useGetTokenAllowance,
  useUpdateAllowance,
} from '@/hooks/usePayment';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { truncatePrincipal } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { TokenLogo } from '@/components/ui/TokenLogo';

interface TokenManagerProps {
  mode: 'balance' | 'allowance';
  targetPrincipal: Principal;
  showPrincipalId?: boolean;
  principalIdLabel?: string;
  principalIdDescription?: string;
  onTransfer?: (token: Token) => void;
  onWithdraw?: (token: Token, canisterPrincipal: Principal) => void;
}

// Local storage for token watchlist
const WATCHED_TOKENS_KEY = 'prometheus_watched_tokens';

const getWatchedTokens = (): string[] => {
  try {
    const stored = localStorage.getItem(WATCHED_TOKENS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setWatchedTokens = (tokenIds: string[]) => {
  localStorage.setItem(WATCHED_TOKENS_KEY, JSON.stringify(tokenIds));
  // Dispatch custom event for same-tab synchronization
  window.dispatchEvent(new CustomEvent('watchlistChanged'));
};

// Check if we're on local network to prevent failed canister calls
const isLocalNetwork = () => {
  return (
    process.env.DFX_NETWORK === 'local' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

// Component to display a single token balance
const TokenBalanceItem: React.FC<{
  token: Token;
  onRemove?: () => void;
  onTransfer?: (token: Token) => void;
  onWithdraw?: (token: Token, canisterPrincipal: Principal) => void;
  targetPrincipal?: Principal;
}> = ({ token, onRemove, onTransfer, onWithdraw, targetPrincipal }) => {
  // Use different hook based on whether we're checking user balance or app canister balance
  const {
    data: userBalance,
    isLoading: isLoadingUser,
    error: userError,
  } = useGetTokenBalance(token);
  const {
    data: targetBalance,
    isLoading: isLoadingTarget,
    error: targetError,
  } = useGetTokenBalanceForPrincipal(token, targetPrincipal);

  // When targetPrincipal is provided, show that balance; otherwise show user balance
  const balance = targetPrincipal ? targetBalance : userBalance;
  const isLoading = targetPrincipal ? isLoadingTarget : isLoadingUser;
  const error = targetPrincipal ? targetError : userError;

  if (isLocalNetwork()) {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center">
            <TokenLogo token={token} size="sm" />
          </div>
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
                  toast.success(
                    `${token.symbol} canister ID copied to clipboard`,
                  );
                }}
                title={`Copy ${token.symbol} canister ID`}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <div className="text-xs md:text-sm text-amber-600">
            Local network - balance unavailable
          </div>
          {onWithdraw && targetPrincipal && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onWithdraw(token, targetPrincipal)}
              title={`Withdraw ${token.symbol} from canister`}>
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
              title={`Remove ${token.symbol} from watchlist`}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  if (error)
    return <div className="text-red-500 p-3">Error loading balance</div>;

  return (
    <div className="flex items-center justify-between p-3 border rounded">
      <div className="flex items-center gap-3">
        <TokenLogo token={token} size="md" />
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
                toast.success(
                  `${token.symbol} canister ID copied to clipboard`,
                );
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
          <div className="text-xs text-muted-foreground">
            {truncatePrincipal(token.canisterId.toText())}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onWithdraw && targetPrincipal && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onWithdraw(token, targetPrincipal)}
              title={`Withdraw ${token.symbol} from canister`}>
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
              title={`Remove ${token.symbol} from watchlist`}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Component to display and manage a single token allowance
const TokenAllowanceItem: React.FC<{
  token: Token;
  spender: Principal;
  onRemove?: () => void;
}> = ({ token, spender, onRemove }) => {
  const { data: allowance, isLoading: isLoadingAllowance } =
    useGetTokenAllowance(spender, token);
  const { data: balance, isLoading: isLoadingBalance } =
    useGetTokenBalance(token);
  const updateAllowance = useUpdateAllowance();
  const [newAmount, setNewAmount] = useState('');

  const handleUpdateAllowance = async () => {
    try {
      await updateAllowance.mutateAsync({
        token,
        spender,
        amount: newAmount,
      });
      setNewAmount('');
      toast.success('Allowance updated successfully');
    } catch (error) {
      toast.error('Failed to update allowance');
    }
  };

  if (isLocalNetwork()) {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <div className="flex md:flex-row flex-col md:items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center">
            <TokenLogo token={token} size="sm" />
          </div>
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
                  toast.success(
                    `${token.symbol} canister ID copied to clipboard`,
                  );
                }}
                title={`Copy ${token.symbol} canister ID`}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-amber-600">
            Local network - balance & allowance unavailable
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
      </div>
    );
  }

  if (isLoadingAllowance || isLoadingBalance)
    return (
      <div className="flex items-center gap-2 p-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading balance & allowance...
      </div>
    );

  return (
    <div className="p-3 border rounded space-y-3">
      {/* Token info row with X button in top-right */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center">
            <TokenLogo token={token} size="sm" />
          </div>
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
                  toast.success(
                    `${token.symbol} canister ID copied to clipboard`,
                  );
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

      {/* Balance row */}
      <div className="flex items-center">
        <div className="text-left">
          <div className="font-medium text-sm md:text-base">
            {balance ? token.fromAtomic(balance) : '0'} {token.symbol}
          </div>
          <div className="text-xs text-muted-foreground">Your Balance</div>
        </div>
      </div>

      {/* Allowance input and update button row */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
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
          {updateAllowance.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Update
        </Button>
      </div>
    </div>
  );
};

export const TokenManager: React.FC<TokenManagerProps> = ({
  mode,
  targetPrincipal,
  showPrincipalId = false,
  principalIdLabel = 'Principal ID',
  principalIdDescription = 'Send tokens to this address',
  onTransfer,
  onWithdraw,
}) => {
  const { identity } = useInternetIdentity();

  // Main token registry for the displayed list
  const {
    allTokens,
    isLoading: isLoadingTokens,
    serverSearchTerm,
    tokens: searchedTokens,
  } = useTokenRegistry();

  // Separate token registry for dialog search
  const {
    allTokens: dialogAllTokens,
    isLoading: isLoadingDialogTokens,
    setServerSearchTerm: setDialogServerSearchTerm,
    tokens: dialogSearchedTokens,
  } = useTokenRegistry();

  // Separate token registry for searching missing watched tokens
  const {
    allTokens: searchResults,
    serverSearchTerm: missingTokenSearchTerm,
    setServerSearchTerm: setMissingTokenSearchTerm,
  } = useTokenRegistry();
  const [watchedTokenIds, setWatchedTokenIds] =
    useState<string[]>(getWatchedTokens());

  // Listen for storage changes to sync watchlist across different TokenManager instances
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'prometheus_watched_tokens') {
        console.log(
          '🔄 Storage event detected, syncing watchlist from other tab/window',
        );
        const newWatchedTokens = getWatchedTokens();
        setWatchedTokenIds(newWatchedTokens);
      }
    };

    // Listen for storage events (changes from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events for same-tab updates
    const handleCustomStorageChange = () => {
      console.log(
        '🔄 Custom storage event detected, syncing watchlist within same tab',
      );
      const newWatchedTokens = getWatchedTokens();
      setWatchedTokenIds(newWatchedTokens);
    };

    window.addEventListener('watchlistChanged', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('watchlistChanged', handleCustomStorageChange);
    };
  }, []);
  const [selectedTokenForAdd, setSelectedTokenForAdd] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dialogSearchInput, setDialogSearchInput] = useState(''); // Separate search for dialog

  // State to track tokens that need to be fetched individually
  const [missingWatchedTokens, setMissingWatchedTokens] = useState<Token[]>([]);

  const addWatchedToken = useCallback(
    (tokenId: string) => {
      const newWatchedTokens = [...watchedTokenIds, tokenId];
      setWatchedTokenIds(newWatchedTokens);
      setWatchedTokens(newWatchedTokens);
    },
    [watchedTokenIds],
  );

  const removeWatchedToken = useCallback(
    (tokenId: string) => {
      const newWatchedTokens = watchedTokenIds.filter((id) => id !== tokenId);
      console.log(
        `🗑️ Removing token ${tokenId} from watchlist. New list:`,
        newWatchedTokens,
      );
      setWatchedTokenIds(newWatchedTokens);
      setWatchedTokens(newWatchedTokens);
      // Also remove from missing watched tokens if it's there
      setMissingWatchedTokens((prev) =>
        prev.filter((token) => token.canisterId.toText() !== tokenId),
      );
    },
    [watchedTokenIds],
  );

  // Use searched tokens if there's a search term, otherwise use all loaded tokens plus missing watched tokens
  const tokensToUse = serverSearchTerm
    ? searchedTokens
    : [...allTokens, ...missingWatchedTokens];

  // Filter tokens based on what user is watching
  const watchedTokens = tokensToUse.filter((token) =>
    watchedTokenIds.includes(token.canisterId.toText()),
  );

  // Effect to search for missing watched tokens
  useEffect(() => {
    if (watchedTokenIds.length === 0) {
      setMissingWatchedTokens([]);
      setMissingTokenSearchTerm('');
      return;
    }

    // Find which watched tokens are missing from allTokens
    const missingTokenIds = watchedTokenIds.filter(
      (watchedId) =>
        !allTokens.some((token) => token.canisterId.toText() === watchedId),
    );

    if (missingTokenIds.length > 0) {
      // Search for the first missing token ID to try to find it
      const searchId = missingTokenIds[0];
      if (searchId !== missingTokenSearchTerm) {
        setMissingTokenSearchTerm(searchId);
      }
    } else {
      // All watched tokens are found, clear the search
      setMissingTokenSearchTerm('');
      setMissingWatchedTokens([]);
    }
  }, [
    watchedTokenIds,
    allTokens,
    missingTokenSearchTerm,
    setMissingTokenSearchTerm,
  ]);

  // Effect to update missing watched tokens when search results come back
  useEffect(() => {
    if (missingTokenSearchTerm && searchResults.length > 0) {
      const foundTokens = searchResults.filter((token) =>
        watchedTokenIds.includes(token.canisterId.toText()),
      );
      setMissingWatchedTokens((prev) => {
        // Add new found tokens, avoid duplicates
        const newTokens = foundTokens.filter(
          (newToken) =>
            !prev.some(
              (existingToken) =>
                existingToken.canisterId.toText() ===
                newToken.canisterId.toText(),
            ),
        );
        return [...prev, ...newTokens];
      });
    }
  }, [searchResults, missingTokenSearchTerm, watchedTokenIds]);

  // For dialog: use dialog-specific server search results when searching, otherwise dialog's all tokens
  const dialogTokensToUse = dialogSearchInput.trim()
    ? dialogSearchedTokens
    : dialogAllTokens;

  // Tokens available to add in dialog (not already being watched)
  const availableTokens = dialogTokensToUse.filter(
    (token) => !watchedTokenIds.includes(token.canisterId.toText()),
  );

  // Debounced dialog search effect - uses separate dialog server search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (dialogSearchInput.trim()) {
        // Use dialog-specific server search
        setDialogServerSearchTerm(dialogSearchInput.trim());
      } else {
        // Clear dialog server search when dialog search is empty
        setDialogServerSearchTerm('');
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [dialogSearchInput, setDialogServerSearchTerm]);

  // Reset dialog search when dialog closes
  useEffect(() => {
    if (!isAddDialogOpen) {
      setDialogSearchInput('');
      setSelectedTokenForAdd('');
      // Reset dialog-specific server search when dialog closes
      setDialogServerSearchTerm('');
    }
  }, [isAddDialogOpen, setDialogServerSearchTerm]);

  if (!identity) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Please log in to view token information.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {mode === 'balance' ? (
            <>
              <Wallet className="h-4 w-4" />
              Token Balances
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Your Allowances
            </>
          )}
          <Popover open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <Plus className="h-4 w-4 mr-1" />
                Add Token
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search tokens..."
                  value={dialogSearchInput}
                  onValueChange={setDialogSearchInput}
                  className="h-9"
                />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>
                    {isLoadingDialogTokens
                      ? 'Loading...'
                      : dialogSearchInput.trim()
                        ? 'No tokens found matching your search.'
                        : availableTokens.length === 0 &&
                            dialogAllTokens.length > 0
                          ? 'All tokens are already in your watchlist.'
                          : 'No tokens found.'}
                  </CommandEmpty>
                  {availableTokens.length > 0 && (
                    <CommandGroup>
                      {availableTokens.map((token) => (
                        <CommandItem
                          key={token.canisterId.toText()}
                          value={token.canisterId.toText()}
                          onSelect={() => {
                            if (
                              !watchedTokenIds.includes(
                                token.canisterId.toText(),
                              )
                            ) {
                              addWatchedToken(token.canisterId.toText());
                              toast.success(
                                `${token.symbol} added to watchlist`,
                              );
                            }
                            setIsAddDialogOpen(false);
                            setDialogSearchInput('');
                          }}
                          className="flex items-center gap-3 p-3">
                          <div className="flex items-center gap-3 flex-1">
                            <TokenLogo token={token} size="sm" />
                            <div className="flex-1">
                              <div className="font-medium flex items-center gap-2">
                                <div className="text-sm truncate">
                                  {token.name}
                                </div>{' '}
                                {watchedTokenIds.includes(
                                  token.canisterId.toText(),
                                ) && (
                                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                                    Added
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-muted-foreground font-mono">
                                {truncatePrincipal(token.canisterId.toText())}
                              </div>
                            </div>
                          </div>
                          <Check
                            className={cn(
                              'h-4 w-4 shrink-0',
                              watchedTokenIds.includes(
                                token.canisterId.toText(),
                              )
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {/* Principal ID display - configurable for different contexts */}
        {showPrincipalId && (
          <div className="mb-3 md:mb-4 p-3 border rounded bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium mb-1">
                  {principalIdLabel}
                </p>
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
                      toast.success('Principal ID copied to clipboard');
                    }}
                    title="Copy Principal ID">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug panel for orphaned watchlist entries */}
        {watchedTokenIds.length > 0 &&
          watchedTokens.length === 0 &&
          allTokens.length > 0 && (
            <div className="mb-4 p-3 border border-orange-200 rounded bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Watchlist Sync Issue Detected
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    You have {watchedTokenIds.length} tokens in your watchlist,
                    but they're not appearing. This might be due to token ID
                    changes.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Clear the watchlist to reset it
                    setWatchedTokenIds([]);
                    setWatchedTokens([]);
                    toast.success(
                      'Watchlist cleared. You can now re-add your tokens.',
                    );
                  }}
                  className="text-orange-700 border-orange-300 hover:bg-orange-100">
                  Clear Watchlist
                </Button>
              </div>
            </div>
          )}

        {isLocalNetwork() && (
          <div className="mb-4 p-3 border border-yellow-200 rounded">
            <p className="text-sm text-amber-700">
              <strong>Local Network:</strong> Token balances and allowances are
              not available on local development network.
            </p>
          </div>
        )}

        {isLoadingTokens && watchedTokens.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading available tokens...
          </div>
        ) : watchedTokens.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No tokens in your watchlist. Add some tokens to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {watchedTokens.map((token) => (
              <div key={token.canisterId.toText()}>
                {mode === 'balance' ? (
                  <TokenBalanceItem
                    token={token}
                    targetPrincipal={targetPrincipal}
                    onTransfer={onTransfer}
                    onWithdraw={onWithdraw}
                    onRemove={() => {
                      removeWatchedToken(token.canisterId.toText());
                      toast.success(`${token.symbol} removed from watchlist`);
                    }}
                  />
                ) : (
                  <TokenAllowanceItem
                    token={token}
                    spender={targetPrincipal}
                    onRemove={() => {
                      removeWatchedToken(token.canisterId.toText());
                      toast.success(`${token.symbol} removed from watchlist`);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
