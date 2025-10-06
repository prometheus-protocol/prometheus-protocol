import { useState, useEffect, useCallback } from 'react';
import { getCanisterId } from '@prometheus-protocol/ic-js';

const WATCHED_TOKENS_KEY = 'prometheus_watched_tokens';

const getWatchedTokens = (): string[] => {
  try {
    const stored = localStorage.getItem(WATCHED_TOKENS_KEY);
    const storedTokens: string[] = stored ? JSON.parse(stored) : [];

    // If there are stored tokens, just return them as-is
    if (storedTokens.length > 0) {
      return storedTokens;
    }

    // Only add USDC as default if localStorage is empty
    const usdcCanisterId = getCanisterId('USDC_LEDGER');
    return [usdcCanisterId];
  } catch (error) {
    console.error('Error in getWatchedTokens:', error);
    try {
      return [getCanisterId('USDC_LEDGER')];
    } catch {
      return [];
    }
  }
};

const setWatchedTokens = (tokenIds: string[]) => {
  localStorage.setItem(WATCHED_TOKENS_KEY, JSON.stringify(tokenIds));
  window.dispatchEvent(new CustomEvent('watchlistChanged'));
};

export const useWatchlist = () => {
  const [watchedTokenIds, setWatchedTokenIdsState] =
    useState<string[]>(getWatchedTokens);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === WATCHED_TOKENS_KEY) {
        setWatchedTokenIdsState(getWatchedTokens());
      }
    };

    const handleCustomStorageChange = () => {
      setWatchedTokenIdsState(getWatchedTokens());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('watchlistChanged', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('watchlistChanged', handleCustomStorageChange);
    };
  }, []);

  const addWatchedToken = useCallback((tokenId: string) => {
    setWatchedTokenIdsState((prev) => {
      const newSet = new Set([...prev, tokenId]);
      const newWatchedTokens = Array.from(newSet);
      setWatchedTokens(newWatchedTokens);
      return newWatchedTokens;
    });
  }, []);

  const removeWatchedToken = useCallback((tokenId: string) => {
    setWatchedTokenIdsState((prev) => {
      const newWatchedTokens = prev.filter((id) => id !== tokenId);
      setWatchedTokens(newWatchedTokens);
      return newWatchedTokens;
    });
  }, []);

  const clearWatchlist = useCallback(() => {
    setWatchedTokenIdsState([]);
    setWatchedTokens([]);
  }, []);

  return {
    watchedTokenIds,
    addWatchedToken,
    removeWatchedToken,
    clearWatchlist,
  };
};
