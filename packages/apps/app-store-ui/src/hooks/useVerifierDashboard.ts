import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  depositStake,
  withdrawStake,
  getVerifierProfile,
  generateApiKey,
  revokeApiKey,
  listApiKeys,
  getPaymentTokenConfig,
} from '@prometheus-protocol/ic-js';
import { AuditHub } from '@prometheus-protocol/declarations';
import { Principal } from '@icp-sdk/core/principal';
import { Token } from '@prometheus-protocol/ic-js';
import useMutation from './useMutation';

/**
 * Hook to fetch the payment token configuration and return a Token object.
 */
export const usePaymentToken = () => {
  return useQuery({
    queryKey: ['paymentToken'],
    queryFn: async () => {
      const config = await getPaymentTokenConfig();

      // Convert the config to a Token object with conversion methods
      const token: Token = {
        canisterId: config.ledger_id[0] ?? Principal.fromText('aaaaa-aa'),
        name: config.symbol, // Using symbol as name for now
        symbol: config.symbol,
        decimals: config.decimals,
        fee: 0, // Fee not provided in config, would need separate query
        toAtomic: (amount: string | number) => {
          const amountStr = String(amount);
          const [integerPart, fractionalPart = ''] = amountStr.split('.');

          if (fractionalPart.length > config.decimals) {
            throw new Error(
              `Amount "${amountStr}" has more than ${config.decimals} decimal places.`,
            );
          }
          const combined =
            (integerPart || '0') + fractionalPart.padEnd(config.decimals, '0');
          return BigInt(combined);
        },
        fromAtomic: (atomicAmount: bigint) => {
          const atomicStr = atomicAmount
            .toString()
            .padStart(config.decimals + 1, '0');
          const integerPart = atomicStr.slice(0, -config.decimals);
          const fractionalPart = atomicStr
            .slice(-config.decimals)
            .replace(/0+$/, '');

          return fractionalPart.length > 0
            ? `${integerPart}.${fractionalPart}`
            : integerPart;
        },
      };

      return token;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
};

/**
 * Hook to fetch the verifier's profile including available balance, staked balance,
 * total verifications, and reputation score.
 */
export const useVerifierProfile = () => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery({
    queryKey: ['verifierProfile', principal?.toString()],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      return await getVerifierProfile(identity);
    },
    enabled: !!principal,
  });
};

/**
 * Mutation hook to deposit USDC stake to the verifier's account.
 * Note: User must first approve the Audit Hub canister via ICRC-2 approve().
 */
export const useDepositStake = () => {
  const { identity } = useInternetIdentity();

  return useMutation<{ amount: bigint }, void>({
    mutationFn: async ({ amount }) => {
      if (!identity) {
        throw new Error('You must be logged in to deposit stake.');
      }
      await depositStake(identity, amount);
    },
    successMessage: 'Stake deposited successfully!',
    queryKeysToRefetch: [['verifierProfile'], ['tokenBalance']],
  });
};

/**
 * Mutation hook to withdraw USDC stake from the verifier's account back to their wallet.
 */
export const useWithdrawStake = () => {
  const { identity } = useInternetIdentity();

  return useMutation<{ amount: bigint }, void>({
    mutationFn: async ({ amount }) => {
      if (!identity) {
        throw new Error('You must be logged in to withdraw stake.');
      }
      await withdrawStake(identity, amount);
    },
    successMessage: 'Stake withdrawn successfully!',
    queryKeysToRefetch: [['verifierProfile'], ['tokenBalance']],
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
