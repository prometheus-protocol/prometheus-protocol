import { Identity } from '@dfinity/agent';
import { getTokenWatchlistActor } from '../actors.js';
import { TokenWatchlist } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';

export type { TokenWatchlist };
export type WatchlistTokenInfo = TokenWatchlist.TokenInfo;

/**
 * Fetches the watchlist for the authenticated user.
 * @param identity The user's identity.
 * @returns An array of WatchlistTokenInfo objects containing token metadata.
 */
export const getMyWatchlist = async (
  identity: Identity,
): Promise<WatchlistTokenInfo[]> => {
  const actor = getTokenWatchlistActor(identity);
  const result = await actor.get_my_watchlist();
  return result;
};

/**
 * Adds a token canister ID to the user's watchlist.
 * Idempotent: adding a token that already exists will not create duplicates.
 * @param identity The user's identity.
 * @param tokenCanisterId The token canister ID to add.
 */
export const addToWatchlist = async (
  identity: Identity,
  tokenCanisterId: Principal,
): Promise<void> => {
  const actor = getTokenWatchlistActor(identity);
  const result = await actor.add_to_watchlist(tokenCanisterId);

  if ('err' in result) {
    throw new Error(`Failed to add token to watchlist: ${result.err}`);
  }
};

/**
 * Removes a token canister ID from the user's watchlist.
 * Succeeds even if the token is not in the list.
 * @param identity The user's identity.
 * @param tokenCanisterId The token canister ID to remove.
 */
export const removeFromWatchlist = async (
  identity: Identity,
  tokenCanisterId: Principal,
): Promise<void> => {
  const actor = getTokenWatchlistActor(identity);
  const result = await actor.remove_from_watchlist(tokenCanisterId);

  if ('err' in result) {
    throw new Error(`Failed to remove token from watchlist: ${result.err}`);
  }
};
