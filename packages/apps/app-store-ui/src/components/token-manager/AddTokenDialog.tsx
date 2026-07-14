import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { useCustomTokenLookup } from '@/hooks/useCustomTokenLookup';
import { TokenLogo } from '@/components/ui/TokenLogo';
import { truncatePrincipal } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AddTokenDialogProps {
  watchedTokenIds: string[];
  onAddToken: (tokenId: string) => void;
}

export const AddTokenDialog: React.FC<AddTokenDialogProps> = ({
  watchedTokenIds,
  onAddToken,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const {
    allTokens,
    isLoading,
    setServerSearchTerm,
    tokens: searchedTokens,
  } = useTokenRegistry();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setServerSearchTerm(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput, setServerSearchTerm]);

  useEffect(() => {
    if (!isOpen) {
      setSearchInput('');
      setServerSearchTerm('');
    }
  }, [isOpen, setServerSearchTerm]);

  const tokensToDisplay = searchInput.trim() ? searchedTokens : allTokens;
  const availableTokens = tokensToDisplay.filter(
    (token) => !watchedTokenIds.includes(token.canisterId.toText()),
  );

  // If the input parses as a canister principal, look it up on-chain so users
  // can add custom tokens that aren't in the registry.
  const {
    principal: customPrincipal,
    customToken,
    isLoading: isLookingUpCustomToken,
    error: customTokenError,
  } = useCustomTokenLookup(searchInput);

  const customTokenAlreadyWatched =
    !!customPrincipal && watchedTokenIds.includes(customPrincipal.toText());
  const customTokenInRegistry =
    !!customPrincipal &&
    availableTokens.some(
      (token) => token.canisterId.toText() === customPrincipal.toText(),
    );
  const showCustomSection = !!customPrincipal && !customTokenInRegistry;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1" />
          Add Token
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tokens..."
            value={searchInput}
            onValueChange={setSearchInput}
            className="h-9"
          />
          <CommandList className="max-h-[300px]">
            {!showCustomSection && (
              <CommandEmpty>
                {isLoading
                  ? 'Loading...'
                  : searchInput.trim()
                    ? 'No tokens found. Paste a canister ID to add a custom token.'
                    : 'No tokens available.'}
              </CommandEmpty>
            )}
            {showCustomSection && (
              <CommandGroup heading="Custom token">
                {customTokenAlreadyWatched ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0" />
                    This token is already in your watchlist.
                  </div>
                ) : isLookingUpCustomToken ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Looking up canister...
                  </div>
                ) : customTokenError ? (
                  <div className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    This canister does not respond as an ICRC-1 token ledger.
                  </div>
                ) : customToken && !customToken.supportsIcrc2 ? (
                  <div className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {customToken.symbol} was found, but it doesn't support
                    ICRC-2 approvals, which this app requires.
                  </div>
                ) : customToken ? (
                  <CommandItem
                    key={customToken.canisterId.toText()}
                    value={customToken.canisterId.toText()}
                    onSelect={() => {
                      onAddToken(customToken.canisterId.toText());
                      toast.success(
                        `${customToken.symbol} added to watchlist`,
                      );
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 p-3">
                    <TokenLogo
                      token={{
                        symbol: customToken.symbol,
                        logo_url: customToken.logoUrl,
                      }}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm truncate">
                        {customToken.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {truncatePrincipal(customToken.canisterId.toText())}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 shrink-0" />
                  </CommandItem>
                ) : null}
              </CommandGroup>
            )}
            {availableTokens.length > 0 && (
              <CommandGroup>
                {availableTokens.map((token) => (
                  <CommandItem
                    key={token.canisterId.toText()}
                    value={token.canisterId.toText()}
                    onSelect={() => {
                      onAddToken(token.canisterId.toText());
                      toast.success(`${token.symbol} added to watchlist`);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-3 p-3">
                    <TokenLogo token={token} size="sm" />
                    <div className="flex-1">
                      <div className="font-medium text-sm truncate">
                        {token.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {truncatePrincipal(token.canisterId.toText())}
                      </div>
                    </div>
                    <Check className={cn('h-4 w-4 shrink-0', 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
