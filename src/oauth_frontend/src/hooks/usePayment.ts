import {
  approveAllowance,
  completePaymentSetup,
  getAllowance,
  getBalance,
  getTokenInfo,
  TokenInfo,
} from '@/api/payment.api';
import { useMutation } from './useMutation';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { useQueries, useQuery } from '@tanstack/react-query';

type SetupPaymentInput = {
  identity: Identity;
  sessionId: string;
  amount: number;
  spenderPrincipal: Principal;
  icrc2CanisterId: Principal;
};

export const useSetupPaymentMutation = () => {
  return useMutation<SetupPaymentInput, void>({
    mutationFn: async ({
      identity,
      sessionId,
      amount,
      spenderPrincipal,
      icrc2CanisterId,
    }) => {
      // Pass the spender principal to the approve function
      await approveAllowance(
        identity,
        amount,
        spenderPrincipal,
        icrc2CanisterId,
      );
      await completePaymentSetup(identity, sessionId);
    },
    successMessage: 'Budget approved successfully!',
    errorMessage: 'Failed to approve budget. Please try again.',
    queryKeysToRefetch: [],
  });
};

/**
 * A query to fetch the user's ckUSDC balance.
 */
export const useBalanceQuery = (
  identity: Identity | undefined,
  icrc2CanisterId: Principal | undefined,
) => {
  return useQuery({
    // The query will re-run if the user's principal changes
    queryKey: [icrc2CanisterId, 'balance', identity?.getPrincipal().toText()],
    queryFn: () => getBalance(identity!, icrc2CanisterId!),
    // This query will only run if the identity object exists
    enabled: !!identity && !!icrc2CanisterId,
  });
};

/**
 * A query to fetch the user's current ckUSDC allowance for a specific spender.
 */
export const useAllowanceQuery = (
  identity: Identity | undefined,
  spender: Principal | undefined,
  icrc2CanisterId: Principal | undefined,
) => {
  return useQuery({
    // The query will re-run if the user or the spender changes
    queryKey: [
      icrc2CanisterId,
      'allowance',
      identity?.getPrincipal().toText(),
      spender?.toText(),
    ],
    queryFn: () => getAllowance(identity!, spender!, icrc2CanisterId!),
    // This query will only run if all required parameters are available
    enabled:
      !!identity &&
      !identity.getPrincipal().isAnonymous() &&
      !!spender &&
      !spender.isAnonymous() &&
      !!icrc2CanisterId,
  });
};

/**
 * A query to fetch the metadata for the configured ICRC token.
 */
export const useTokenInfoQuery = (
  identity: Identity | undefined,
  icrc2CanisterId: Principal | undefined,
) => {
  return useQuery<TokenInfo, Error>({
    queryKey: [icrc2CanisterId, 'tokenInfo'], // This is global, doesn't depend on user
    queryFn: () => getTokenInfo(identity!, icrc2CanisterId!),
    enabled: !!identity && !!icrc2CanisterId,
    staleTime: Infinity, // This data is static, it never needs to be refetched
  });
};

/**
 * A query to fetch the metadata for a list of ICRC token canisters in parallel.
 */
export const useTokenInfosQuery = (
  identity: Identity | undefined,
  tokenCanisterIds: Principal[],
) => {
  const queries = tokenCanisterIds.map((canisterId) => ({
    queryKey: ['tokenInfo', canisterId.toText()],
    queryFn: () => getTokenInfo(identity!, canisterId),
    enabled: !!identity,
    staleTime: Infinity, // This data is static
  }));

  // useQueries returns an array of query results
  return useQueries({ queries });
};
