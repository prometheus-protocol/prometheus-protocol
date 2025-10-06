import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Check } from 'lucide-react';
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
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
            value={searchInput}
            onValueChange={setSearchInput}
            className="h-9"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {isLoading
                ? 'Loading...'
                : searchInput.trim()
                  ? 'No tokens found.'
                  : 'No tokens available.'}
            </CommandEmpty>
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
