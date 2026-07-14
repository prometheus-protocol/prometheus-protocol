import { Identity } from '@icp-sdk/core/agent';
import { getIcrcActor, getTokenWatchlistActor } from '../actors.js';
import { TokenWatchlist } from '@prometheus-protocol/declarations';
import { Principal } from '@icp-sdk/core/principal';

export type { TokenWatchlist };
export type WatchlistTokenInfo = TokenWatchlist.TokenInfo;

export interface CustomTokenInfo {
  canisterId: Principal;
  symbol: string;
  name: string;
  decimals: number;
  fee?: number;
  logoUrl?: string;
  supportsIcrc2: boolean;
}

/**
 * Validates that a canister is an ICRC-1 token ledger and reports whether it
 * also supports ICRC-2 (approvals). Queries the canister's own
 * `icrc1_metadata` and `icrc1_supported_standards` endpoints.
 *
 * Throws if the canister does not respond to the ICRC-1 interface or its
 * metadata is missing required fields.
 * @param canisterId The ledger canister ID to validate.
 */
export const validateTokenCanister = async (
  canisterId: Principal,
): Promise<CustomTokenInfo> => {
  const actor = getIcrcActor(canisterId);

  const [metadata, standards] = await Promise.all([
    actor.icrc1_metadata(),
    actor.icrc1_supported_standards(),
  ]);

  let symbol: string | undefined;
  let name: string | undefined;
  let decimals: number | undefined;
  let fee: number | undefined;
  let logoUrl: string | undefined;

  for (const [key, value] of metadata) {
    if (key === 'icrc1:symbol' && 'Text' in value) {
      symbol = value.Text;
    } else if (key === 'icrc1:name' && 'Text' in value) {
      name = value.Text;
    } else if (key === 'icrc1:decimals' && 'Nat' in value) {
      decimals = Number(value.Nat);
    } else if (key === 'icrc1:fee' && 'Nat' in value) {
      fee = Number(value.Nat);
    } else if (key === 'icrc1:logo' && 'Text' in value) {
      logoUrl = value.Text;
    }
  }

  if (symbol === undefined || name === undefined || decimals === undefined) {
    throw new Error(
      'Token metadata is missing required fields (symbol, name, or decimals).',
    );
  }

  const supportsIcrc2 = standards.some(
    (standard: { name: string; url: string }) => standard.name === 'ICRC-2',
  );

  return { canisterId, symbol, name, decimals, fee, logoUrl, supportsIcrc2 };
};

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
