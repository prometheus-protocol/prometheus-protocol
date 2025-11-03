import {
  approveAllowance,
  getAllowance,
  getBalance,
  Token,
} from '@prometheus-protocol/ic-js';
import { useMutation } from './useMutation';
import type { Principal } from '@icp-sdk/core/principal';
import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';

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
