import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  depositStake,
  withdrawStake,
  getVerifierProfile,
  getAvailableBalanceByAuditType,
  getStakedBalance,
  getStakeRequirement,
  generateApiKey,
  revokeApiKey,
  listApiKeys,
  Tokens,
  getAllAuditTypes,
  type AuditType,
} from '@prometheus-protocol/ic-js';
import { AuditHub } from '@prometheus-protocol/declarations';
import useMutation from './useMutation';

/**
 * Hook to fetch the payment token configuration and return a Token object.
 * Uses the statically defined token from Tokens registry.
 */
export const usePaymentToken = () => {
  return useQuery({
    queryKey: ['paymentToken'],
    queryFn: async () => {
      // For now, we know the payment token is USDC
      // In the future, this could query the audit hub to determine which token to use
      return Tokens.USDC;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
};

/**
 * Hook to fetch the verifier's profile including total verifications, reputation, and earnings.
 * Note: Balances are fetched separately per audit type.
 */
export const useVerifierProfile = () => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const { data: paymentToken } = usePaymentToken();

  return useQuery({
    queryKey: [
      'verifierProfile',
      principal?.toString(),
      paymentToken?.canisterId.toText(),
    ],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      if (!paymentToken) {
        throw new Error('Payment token configuration not available.');
      }
      return await getVerifierProfile(
        identity,
        paymentToken.canisterId.toText(),
      );
    },
    enabled: !!principal && !!paymentToken,
  });
};

/**
 * Hook to fetch available balance for a specific audit type.
 */
export const useAvailableBalanceByAuditType = (auditType: AuditType) => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery({
    queryKey: ['availableBalance', principal?.toString(), auditType],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      return await getAvailableBalanceByAuditType(identity, auditType);
    },
    enabled: !!principal,
  });
};

/**
 * Hook to fetch the total available balance across all audit types.
 * Since balances are shared per token, we just fetch one audit type's balance.
 */
export const useAvailableBalance = () => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  // Just use the first audit type since they all share the same token pool
  const auditType = getAllAuditTypes()[0];

  return useQuery({
    queryKey: ['availableBalance', principal?.toString()],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      return await getAvailableBalanceByAuditType(identity, auditType);
    },
    enabled: !!principal,
  });
};

/**
 * Hook to fetch the stake requirement for a specific audit type.
 */
export const useStakeRequirement = (auditType: AuditType) => {
  return useQuery({
    queryKey: ['stakeRequirement', auditType],
    queryFn: async () => {
      return await getStakeRequirement(auditType);
    },
  });
};

/**
 * Hook to fetch staked balance for a specific token.
 */
export const useStakedBalance = (tokenId?: string) => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery({
    queryKey: ['stakedBalance', principal?.toString(), tokenId],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      if (!tokenId) {
        throw new Error('Token ID is required.');
      }
      return await getStakedBalance(identity, tokenId);
    },
    enabled: !!principal && !!tokenId,
  });
};

/**
 * Hook to fetch available balances for all audit types.
 * Returns a map of audit type to available balance.
 */
export const useAllAvailableBalances = () => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const auditTypes = getAllAuditTypes();

  return useQuery({
    queryKey: ['allAvailableBalances', principal?.toString()],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }

      const balances: Record<string, bigint> = {};

      // Fetch balances for all audit types in parallel
      const results = await Promise.all(
        auditTypes.map((auditType) =>
          getAvailableBalanceByAuditType(identity, auditType),
        ),
      );

      auditTypes.forEach((auditType, index) => {
        balances[auditType] = results[index];
      });

      return balances;
    },
    enabled: !!principal,
  });
};

/**
 * Mutation hook to deposit USDC stake to the verifier's account.
 * This automatically handles the ICRC-2 approval step before depositing.
 */
export const useDepositStake = () => {
  const { identity } = useInternetIdentity();
  const { data: paymentToken } = usePaymentToken();

  return useMutation<{ amount: bigint; auditType: AuditType }, void>({
    mutationFn: async ({ amount, auditType }) => {
      if (!identity) {
        throw new Error('You must be logged in to deposit stake.');
      }
      if (!paymentToken) {
        throw new Error('Payment token configuration not available.');
      }
      // TODO: Update depositStake to accept auditType parameter
      await depositStake(identity, amount, paymentToken);
    },
    successMessage: 'Stake deposited successfully!',
    queryKeysToRefetch: [
      ['verifierProfile'],
      ['tokenBalance'],
      ['allAvailableBalances'],
      ['availableBalance'],
      ['stakedBalance'],
    ],
  });
};

/**
 * Mutation hook to withdraw USDC stake from the verifier's account back to their wallet.
 */
export const useWithdrawStake = () => {
  const { identity } = useInternetIdentity();
  const { data: paymentToken } = usePaymentToken();

  return useMutation<{ amount: bigint }, void>({
    mutationFn: async ({ amount }) => {
      if (!identity) {
        throw new Error('You must be logged in to withdraw stake.');
      }
      if (!paymentToken) {
        throw new Error('Payment token configuration not available.');
      }
      await withdrawStake(identity, amount, paymentToken.canisterId.toText());
    },
    successMessage: 'Stake withdrawn successfully!',
    queryKeysToRefetch: [
      ['verifierProfile'],
      ['tokenBalance'],
      ['allAvailableBalances'],
      ['availableBalance'],
      ['stakedBalance'],
    ],
  });
};

/**
 * Hook to fetch all API keys for the authenticated verifier.
 */
export const useListApiKeys = () => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery<AuditHub.ApiCredential[]>({
    queryKey: ['apiKeys', principal?.toString()],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      return listApiKeys(identity);
    },
    enabled: !!principal,
  });
};

/**
 * Mutation hook to generate a new API key.
 */
export const useGenerateApiKey = () => {
  const { identity } = useInternetIdentity();

  return useMutation<void, string>({
    mutationFn: async () => {
      if (!identity) {
        throw new Error('You must be logged in to generate an API key.');
      }
      return await generateApiKey(identity);
    },
    successMessage: 'API key generated successfully!',
    queryKeysToRefetch: [['apiKeys']],
  });
};

/**
 * Mutation hook to revoke an API key.
 */
export const useRevokeApiKey = () => {
  const { identity } = useInternetIdentity();

  return useMutation<{ apiKey: string }, void>({
    mutationFn: async ({ apiKey }) => {
      if (!identity) {
        throw new Error('You must be logged in to revoke an API key.');
      }
      await revokeApiKey(identity, apiKey);
    },
    successMessage: 'API key revoked successfully!',
    queryKeysToRefetch: [['apiKeys']],
  });
};
