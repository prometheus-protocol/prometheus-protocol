import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  getMyWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getCanisterId,
} from '@prometheus-protocol/ic-js';
import useMutation from './useMutation';

const WATCHED_TOKENS_KEY = 'prometheus_watched_tokens';
const MIGRATION_FLAG_KEY = 'prometheus_watchlist_migrated';

/**
 * Hook for managing the user's token watchlist.
 * Uses the token_watchlist canister for authenticated users.
 * Falls back to localStorage for unauthenticated users.
 */
export const useWatchlist = () => {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity && !isInitializing;

  // Query for fetching the watchlist from the canister
  const { data: watchedTokenIds = [], isLoading } = useQuery({
    queryKey: ['watchlist', identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!identity) {
        // Not authenticated, use localStorage
        return getLocalWatchlist();
      }

      try {
        // Fetch from canister
        const canisterList = await getMyWatchlist(identity);

        // One-time migration: if canister is empty and localStorage has data, migrate it
        const hasMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
        if (!hasMigrated && canisterList.length === 0) {
          const localList = getLocalWatchlist();
          if (localList.length > 0) {
            // Migrate local data to canister
            for (const tokenId of localList) {
              await addToWatchlist(identity, tokenId);
            }
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
            return localList;
          }
        }

        // If canister is empty and we have no local data, initialize with USDC
        if (canisterList.length === 0) {
          try {
            const usdcCanisterId = getCanisterId('USDC_LEDGER');
            await addToWatchlist(identity, usdcCanisterId);
            return [usdcCanisterId];
          } catch (error) {
            console.error('Failed to initialize watchlist with USDC:', error);
            return [];
          }
        }

        return canisterList;
      } catch (error) {
        console.error('Error fetching watchlist from canister:', error);
        // Fallback to localStorage on error
        return getLocalWatchlist();
      }
    },
    enabled: !isInitializing,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Mutation for adding a token
  const addMutation = useMutation<string, void>({
    mutationFn: async (tokenId: string) => {
      if (!identity) {
        // Not authenticated, use localStorage
        const current = getLocalWatchlist();
        if (!current.includes(tokenId)) {
          const updated = [...current, tokenId];
          setLocalWatchlist(updated);
        }
        return;
      }

      await addToWatchlist(identity, tokenId);
    },
    queryKeysToRefetch: [['watchlist', identity?.getPrincipal().toString()]],
    enableSnackbar: false, // Don't show default success toast
  });

  // Mutation for removing a token
  const removeMutation = useMutation<string, void>({
    mutationFn: async (tokenId: string) => {
      if (!identity) {
        // Not authenticated, use localStorage
        const current = getLocalWatchlist();
        const updated = current.filter((id) => id !== tokenId);
        setLocalWatchlist(updated);
        return;
      }

      await removeFromWatchlist(identity, tokenId);
    },
    queryKeysToRefetch: [['watchlist', identity?.getPrincipal().toString()]],
    enableSnackbar: false, // Don't show default success toast
  });

  return {
    watchedTokenIds,
    isLoading: isLoading || isInitializing,
    isAuthenticated,
    addWatchedToken: (tokenId: string) => addMutation.mutate(tokenId),
    removeWatchedToken: (tokenId: string) => removeMutation.mutate(tokenId),
    isAddingToken: addMutation.isPending,
    isRemovingToken: removeMutation.isPending,
  };
};

// Helper functions for localStorage fallback
function getLocalWatchlist(): string[] {
  try {
    const stored = localStorage.getItem(WATCHED_TOKENS_KEY);
    const storedTokens: string[] = stored ? JSON.parse(stored) : [];

    if (storedTokens.length > 0) {
      return storedTokens;
    }

    // Only add USDC as default if localStorage is empty
    const usdcCanisterId = getCanisterId('USDC_LEDGER');
    return [usdcCanisterId];
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    try {
      return [getCanisterId('USDC_LEDGER')];
    } catch {
      return [];
    }
  }
}

function setLocalWatchlist(tokenIds: string[]): void {
  try {
    localStorage.setItem(WATCHED_TOKENS_KEY, JSON.stringify(tokenIds));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
}
