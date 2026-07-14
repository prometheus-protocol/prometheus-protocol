import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Principal } from '@icp-sdk/core/principal';
import { validateTokenCanister } from '@prometheus-protocol/ic-js';

/**
 * Parses free-form search input as a canister principal and, when valid,
 * looks the canister up on-chain to check that it is an ICRC-1 token ledger
 * with ICRC-2 (approval) support. Used to let users add custom tokens that
 * aren't in the token registry.
 */
export const useCustomTokenLookup = (searchInput: string) => {
  const principal = useMemo(() => {
    const trimmed = searchInput.trim();
    // Canister IDs always contain dashes; skip lookups for plain words so we
    // don't treat searches like "usdc" as principals.
    if (!trimmed.includes('-')) return null;
    try {
      return Principal.fromText(trimmed);
    } catch {
      return null;
    }
  }, [searchInput]);

  const {
    data: customToken,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['custom-token-lookup', principal?.toText()],
    queryFn: () => validateTokenCanister(principal!),
    enabled: !!principal,
    staleTime: 10 * 60 * 1000,
    retry: false, // A non-token canister will never start responding to ICRC-1
  });

  return {
    principal,
    customToken: customToken ?? null,
    isLoading: !!principal && isLoading,
    error: error as Error | null,
  };
};
