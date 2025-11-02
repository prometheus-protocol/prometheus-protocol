import {
  approveAllowance,
  getAllowance,
  getBalance,
  getBalanceOf,
  icrc1Transfer,
  Token,
  withdraw as mcpWithdraw,
} from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';
import { useQuery } from '@tanstack/react-query';
import useMutation from './useMutation';
import { useInternetIdentity } from 'ic-use-internet-identity';

/**
 * A generic React Query hook to fetch the current user's balance for any ICRC-1 token.
 *
 * @param token The Token object (from the token registry) for which to fetch the balance.
 */
export const useGetTokenBalance = (token: Token | undefined) => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery({
    // The query key includes the token's canister ID to ensure balances are cached separately.
    queryKey: [
      'tokenBalance',
      identity?.getPrincipal().toText(),
      token?.canisterId?.toText(),
    ],
    queryFn: async () => {
      if (!principal || !token) {
        throw new Error('User or token is not available.');
      }
      // Uses the generic `getBalance` function from the ic-js layer.
      return getBalance(identity!, token);
    },
    // The query is only enabled when both the user and the token are defined.
    enabled: !!principal && !!token,
    // Optional: Refetch periodically to keep the balance fresh.
    refetchInterval: 30000,
  });
};

/**
 * Hook to get token balance for a specific principal (e.g., app canister)
 *
 * @param token The Token object for which to fetch the balance
 * @param targetPrincipal The principal whose balance to check
 */
export const useGetTokenBalanceForPrincipal = (
  token: Token | undefined,
  targetPrincipal: Principal | undefined,
) => {
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: [
      'tokenBalance',
      targetPrincipal?.toText(),
      token?.canisterId?.toText(),
    ],
    queryFn: async () => {
      if (!targetPrincipal || !token || !identity) {
        throw new Error('Principal, token, or identity is not available.');
      }
      // Use the new getBalanceOf function to check balance of the target principal
      return getBalanceOf(identity!, token, targetPrincipal);
    },
    enabled: !!targetPrincipal && !!token && !!identity,
    refetchInterval: 30000,
  });
};

interface TransferArgs {
  token: Token;
  to: Principal;
  amount: number;
}

export const useTransfer = () => {
  const { identity } = useInternetIdentity();

  return useMutation<TransferArgs, bigint>({
    queryKeysToRefetch: [['tokenBalance']],
    successMessage: 'Transfer completed successfully!',
    errorMessage: 'Failed to transfer tokens',
    mutationFn: async (args: TransferArgs) => {
      if (!identity) {
        throw new Error('User is not authenticated');
      }
      // Perform the transfer using the shared library function
      return await icrc1Transfer(identity, args.token, args.to, args.amount);
    },
  });
};

interface WithdrawArgs {
  token: Token;
  canisterPrincipal: Principal;
  to: Principal;
  amount: number;
}

export const useWithdraw = () => {
  const { identity } = useInternetIdentity();

  return useMutation<WithdrawArgs, bigint>({
    queryKeysToRefetch: [['tokenBalance']],
    successMessage: 'Tokens withdrawn successfully!',
    errorMessage: 'Failed to withdraw tokens',
    mutationFn: async (args: WithdrawArgs) => {
      if (!identity) {
        throw new Error('User is not authenticated');
      }

      // Convert amount from human-readable to atomic units
      const atomicAmount = args.token.toAtomic(args.amount);

      // Create the destination object with the correct format
      const destination = {
        owner: args.to,
        subaccount: [] as [] | [Uint8Array], // No subaccount
      };

      // Use the ic-js mcp-server API
      const result = await mcpWithdraw(
        identity,
        args.canisterPrincipal,
        args.token.canisterId,
        atomicAmount,
        destination,
      );

      return result;
    },
  });
};

/**
 * Fetches the user's allowance for a specific spender and token.
 * @returns The allowance as a bigint in the token's atomic unit.
 */
export const useGetTokenAllowance = (spender?: Principal, token?: Token) => {
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
    refetchInterval: 30000,
  });
};

/**
 * A mutation hook for approving or updating an ICRC-2 allowance.
 */
export const useUpdateAllowance = () => {
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
