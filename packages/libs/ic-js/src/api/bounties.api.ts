// packages/ic-js/src/bounties.api.ts

import { Identity } from '@dfinity/agent';
import { getAppBountiesActor } from '../actors.js';
import { AppBounties } from '@prometheus-protocol/declarations';

export type { AppBounties };

/**
 * Fetches the list of all public app bounties from the canister.
 * The canister returns these sorted by most recent first.
 * This is a public, unauthenticated call.
 * @returns An array of Bounty objects.
 */
export const getAllAppBounties = async (): Promise<AppBounties.Bounty[]> => {
  // Note: This actor does not require an identity for public calls.
  const bountyActor = getAppBountiesActor();
  const result = await bountyActor.get_all_bounties();
  return result;
};

/**
 * Fetches the full details for a single app bounty by its ID.
 * This is a public, unauthenticated call.
 * @param bountyId The unique identifier (Nat/bigint) of the bounty.
 * @returns The Bounty object if found, otherwise null.
 */
export const getAppBounty = async (
  bountyId: bigint,
): Promise<AppBounties.Bounty | null> => {
  const bountyActor = getAppBountiesActor();
  // The canister returns an optional record: `[]` for none, `[Bounty]` for some.
  const result = await bountyActor.get_bounty(bountyId);

  if (result.length > 0) {
    return result[0] || null;
  }
  return null;
};

/**
 * Creates a new bounty on the canister. Requires an owner identity.
 * @returns The ID of the newly created bounty.
 */
export const createAppBounty = async (
  identity: Identity,
  bounty: AppBounties.Bounty,
): Promise<bigint> => {
  const bountyActor = getAppBountiesActor(identity);
  const result = await bountyActor.create_bounty(
    bounty.title,
    bounty.short_description,
    bounty.reward_amount,
    bounty.reward_token,
    bounty.status,
    bounty.details_markdown,
  );

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Updates an existing bounty on the canister. Requires an owner identity.
 */
export const updateAppBounty = async (
  identity: Identity,
  bounty: AppBounties.Bounty,
): Promise<void> => {
  const bountyActor = getAppBountiesActor(identity);
  const result = await bountyActor.update_bounty(
    bounty.id,
    bounty.title,
    bounty.short_description,
    bounty.reward_amount,
    bounty.reward_token,
    bounty.status,
    bounty.details_markdown,
  );

  if ('err' in result) {
    throw new Error(result.err);
  }
};
