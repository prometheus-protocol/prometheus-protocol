import {
  approveAllowance,
  completePaymentSetup,
  getAllowance,
  getBalance,
  Token,
} from '@prometheus-protocol/ic-js';
import { useMutation } from './useMutation';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';

type InitialSetupInput = {
  identity: Identity;
  sessionId: string;
  amount: number;
  spenderPrincipal: Principal;
  token: Token;
};

export const useInitialPaymentSetupMutation = () => {
  return useMutation<InitialSetupInput, void>({
    mutationFn: async ({
      identity,
      token,
      sessionId,
      amount,
      spenderPrincipal,
    }) => {
      // Pass the spender principal to the approve function
      // Only attempt to set an allowance on the token canister if the
      // user is actually requesting a non-zero allowance.
      // This allows users with a zero balance to enter "0" to proceed
      // with the authorization flow, intending to set a real allowance later.
      if (amount > 0) {
        await approveAllowance(identity, token, spenderPrincipal, amount);
      }
      await completePaymentSetup(identity, sessionId);
    },
    successMessage: 'Budget approved successfully!',
    errorMessage: 'Failed to approve budget. Please try again.',
    queryKeysToRefetch: [],
  });
};

/**
 * Fetches the user's balance for a specific ICRC-1 token.
 * @returns The balance as a bigint in the token's atomic unit.
 */
export const useTokenBalanceQuery = (token?: Token) => {
  const { identity } = useInternetIdentity();
  return useQuery({
    queryKey: [
      'tokenBalance',
      identity?.getPrincipal().toText(),
      token?.canisterId.toText(),
    ],
    queryFn: () => getBalance(identity!, token!),
    enabled: !!identity && !!token,
  });
};

/**
 * Fetches the user's allowance for a specific spender and token.
 * @returns The allowance as a bigint in the token's atomic unit.
 */
export const useTokenAllowanceQuery = (spender?: Principal, token?: Token) => {
  const { identity } = useInternetIdentity();
  return useQuery({
    queryKey: [
      'tokenAllowance',
      identity?.getPrincipal().toText(),
      spender?.toText(),
      token?.canisterId.toText(),
    ],
    queryFn: () => getAllowance(identity!, token!, spender!),
    enabled: !!identity && !!token && !!spender,
  });
};

/**
 * A mutation hook for approving or updating an ICRC-2 allowance.
 */
export const useUpdateAllowanceMutation = () => {
  const { identity } = useInternetIdentity();
  return useMutation<
    { token: Token; spender: Principal; amount: number | string },
    bigint
  >({
    mutationFn: ({ token, spender, amount }) => {
      if (!identity) throw new Error('Identity not found');
      return approveAllowance(identity, token, spender, amount);
    },
    successMessage: 'Allowance updated successfully!',
    // Refetch balance and allowance after a successful update
    queryKeysToRefetch: [['tokenBalance'], ['tokenAllowance']],
  });
};
