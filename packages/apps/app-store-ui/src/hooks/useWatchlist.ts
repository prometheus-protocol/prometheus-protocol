import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Principal } from '@icp-sdk/core/principal';
import { useMemo } from 'react';
import {
  getMyWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getCanisterId,
  type WatchlistTokenInfo,
} from '@prometheus-protocol/ic-js';
import useMutation from './useMutation';

/**
 * Hook for managing the user's token watchlist.
 * Requires authentication - uses the token_watchlist canister.
 */
export const useWatchlist = () => {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity && !isInitializing;

  // Query for fetching the watchlist from the canister
  const { data: watchedTokens = [], isLoading } = useQuery({
    queryKey: ['watchlist', identity?.getPrincipal().toString()],
    queryFn: async (): Promise<WatchlistTokenInfo[]> => {
      if (!identity) {
        return [];
      }

      const canisterList = await getMyWatchlist(identity);
      return canisterList;
    },
    enabled: !!identity && !isInitializing,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Extract canister IDs as strings for backward compatibility
  // Use useMemo to prevent creating a new array on every render
  const watchedTokenIds = useMemo(
    () => watchedTokens.map((token) => token.canisterId.toText()),
    [watchedTokens],
  );

  // Mutation for adding a token
  const addMutation = useMutation<string, void>({
    mutationFn: async (tokenId: string) => {
      if (!identity) {
        throw new Error('Must be authenticated to add tokens to watchlist');
      }

      await addToWatchlist(identity, Principal.fromText(tokenId));
    },
    queryKeysToRefetch: [['watchlist', identity?.getPrincipal().toString()]],
    enableSnackbar: false, // Don't show default success toast
  });

  // Mutation for removing a token
  const removeMutation = useMutation<string, void>({
    mutationFn: async (tokenId: string) => {
      if (!identity) {
        throw new Error(
          'Must be authenticated to remove tokens from watchlist',
        );
      }

      await removeFromWatchlist(identity, Principal.fromText(tokenId));
    },
    queryKeysToRefetch: [['watchlist', identity?.getPrincipal().toString()]],
    enableSnackbar: false, // Don't show default success toast
  });

  return {
    watchedTokenIds,
    watchedTokens, // Full TokenInfo objects
    isLoading: isLoading || isInitializing,
    isAuthenticated,
    addWatchedToken: (tokenId: string) => addMutation.mutate(tokenId),
    removeWatchedToken: (tokenId: string) => removeMutation.mutate(tokenId),
    isAddingToken: addMutation.isPending,
    isRemovingToken: removeMutation.isPending,
  };
};
