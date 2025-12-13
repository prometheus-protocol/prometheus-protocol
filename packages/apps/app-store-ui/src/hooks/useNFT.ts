import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Principal } from '@dfinity/principal';
import { getUserNFTs, transferNFT } from '@prometheus-protocol/ic-js';
import useMutation from './useMutation';

// PokedBots NFT Collection Canister ID
const POKEDBOTS_CANISTER_ID = Principal.fromText('bzsui-sqaaa-aaaah-qce2a-cai');

export interface NFTMetadata {
  tokenIndex: number;
  tokenId: string;
  name?: string;
  thumbnail?: string;
  asset?: string;
}

/**
 * Hook to fetch user's NFTs from PokedBots collection
 */
export function useGetUserNFTs() {
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: ['user-nfts', identity?.getPrincipal().toText()],
    queryFn: async (): Promise<NFTMetadata[]> => {
      if (!identity) {
        return [];
      }

      return await getUserNFTs(identity, POKEDBOTS_CANISTER_ID);
    },
    enabled: !!identity,
    staleTime: 30000, // 30 seconds
  });
}

interface TransferNFTArgs {
  tokenId: string;
  recipientPrincipal: string;
}

/**
 * Hook to transfer an NFT
 */
export function useTransferNFT() {
  const { identity } = useInternetIdentity();

  return useMutation<TransferNFTArgs, void>({
    queryKeysToRefetch: [['user-nfts']],
    successMessage: 'NFT transferred successfully!',
    errorMessage: 'Failed to transfer NFT',
    mutationFn: async (args: TransferNFTArgs) => {
      if (!identity) {
        throw new Error('User is not authenticated');
      }

      const recipientPrincipal = Principal.fromText(args.recipientPrincipal);

      await transferNFT(
        identity,
        POKEDBOTS_CANISTER_ID,
        args.tokenId,
        recipientPrincipal,
      );
    },
  });
}
