import { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { AccountIdentifier } from '@icp-sdk/canisters/ledger/icp';
import { getExtActor } from '../actors.js';
import {
  generatetokenIdentifier,
  generateExtThumbnailLink,
  generateExtAssetLink,
} from '../ext.js';

export interface NFTMetadata {
  tokenIndex: number;
  tokenId: string;
  name?: string;
  thumbnail?: string;
  asset?: string;
}

/**
 * Helper to get account identifier from principal for EXT standard
 */
function principalToAccountIdentifier(principal: Principal): string {
  return AccountIdentifier.fromPrincipal({ principal }).toHex();
}

/**
 * Fetches user's NFTs from an EXT collection
 * @param identity The user's identity
 * @param collectionCanisterId The NFT collection canister ID
 * @returns Array of NFT metadata
 */
export const getUserNFTs = async (
  identity: Identity,
  collectionCanisterId: Principal,
): Promise<NFTMetadata[]> => {
  const actor = getExtActor(collectionCanisterId, identity);
  const principal = identity.getPrincipal();
  const accountId = principalToAccountIdentifier(principal);

  try {
    // Get user's token indices
    const tokensResult = await actor.tokens(accountId);

    if ('err' in tokensResult) {
      console.error('Error fetching tokens:', tokensResult.err);
      return [];
    }

    const tokenIndices: number[] = Array.from(tokensResult.ok);

    // Build NFT metadata using helper functions
    const nfts: NFTMetadata[] = [];
    const canisterIdText = collectionCanisterId.toText();

    for (const tokenIndex of tokenIndices) {
      const tokenId = generatetokenIdentifier(canisterIdText, tokenIndex);

      nfts.push({
        tokenIndex,
        tokenId,
        name: `PokedBot #${tokenIndex}`,
        thumbnail: generateExtThumbnailLink(tokenId),
        asset: generateExtAssetLink(tokenId),
      });
    }

    return nfts;
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    return [];
  }
};

/**
 * Transfers an NFT to another principal
 * @param identity The user's identity
 * @param collectionCanisterId The NFT collection canister ID
 * @param tokenId The token ID to transfer
 * @param recipientPrincipal The recipient's principal
 * @returns The transfer result
 */
export const transferNFT = async (
  identity: Identity,
  collectionCanisterId: Principal,
  tokenId: string,
  recipientPrincipal: Principal,
): Promise<void> => {
  const actor = getExtActor(collectionCanisterId, identity);
  const principal = identity.getPrincipal();

  const transferRequest = {
    to: { principal: recipientPrincipal },
    token: tokenId,
    notify: false,
    from: { principal },
    memo: new Uint8Array([]),
    subaccount: [],
    amount: BigInt(1),
  };

  const result = await actor.transfer(transferRequest);

  if ('err' in result) {
    const errorMsg = JSON.stringify(result.err);
    throw new Error(`Transfer failed: ${errorMsg}`);
  }
};

/**
 * Gets collection metadata
 * @param identity The user's identity
 * @param collectionCanisterId The NFT collection canister ID
 * @returns Collection details or null
 */
export const getCollectionInfo = async (
  identity: Identity,
  collectionCanisterId: Principal,
) => {
  const actor = getExtActor(collectionCanisterId, identity);

  try {
    const result = await actor.portal_getCollectionMeta();

    if ('ok' in result) {
      return result.ok;
    }

    return null;
  } catch (error) {
    console.error('Error fetching collection info:', error);
    return null;
  }
};
