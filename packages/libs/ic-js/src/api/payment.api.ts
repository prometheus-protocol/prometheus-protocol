import { Identity } from '@dfinity/agent';
import { toNullable } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import { getIcrcActor } from '../actors.js';
import { Token } from '../tokens.js';

/**
 * This module provides generic, reusable functions for interacting with any ICRC-1 or
 * ICRC-2 compliant token canister.
 *
 * PHILOSOPHY:
 * - It consumes the `Token` objects defined in the central `tokens.ts` module.
 * - It works with atomic units (bigint) for all on-chain amounts to ensure precision.
 * - The UI layer is responsible for converting these atomic bigints into human-readable
 *   strings using the methods provided by the `Token` object (e.g., `token.fromAtomic()`).
 */

// --- ICRC-2 (Allowance) Functions ---

/**
 * Calls the `icrc2_approve` method on the specified ledger canister.
 * @param amount The human-readable amount to approve (e.g., 10.5).
 * @returns The approval transaction ID as a bigint.
 */
export const approveAllowance = async (
  identity: Identity,
  token: Token,
  spender: Principal,
  amount: number | string,
): Promise<bigint> => {
  const icrcActor = getIcrcActor(token.canisterId, identity);
  // 2. Use the token's own method for conversion. No more redundant helpers.
  const amountToApprove = token.toAtomic(amount);

  const args = {
    spender: { owner: spender, subaccount: toNullable<Uint8Array>() },
    amount: amountToApprove,
    fee: toNullable<bigint>(), // Let the ledger assign the default fee
    memo: toNullable<Uint8Array>(),
    created_at_time: toNullable<bigint>(),
    from_subaccount: toNullable<Uint8Array>(),
    expected_allowance: toNullable<bigint>(),
    expires_at: toNullable<bigint>(),
  };

  const result = await icrcActor.icrc2_approve(args);

  if ('Err' in result) {
    throw new Error(`ICRC-2 approve failed: ${JSON.stringify(result.Err)}`);
  }

  return result.Ok;
};

/**
 * Fetches the user's current allowance for a specific spender.
 * @returns The allowance as a bigint in the token's atomic unit.
 */
export const getAllowance = async (
  identity: Identity,
  token: Token,
  spender: Principal,
): Promise<bigint> => {
  const icrcActor = getIcrcActor(token.canisterId, identity);
  const owner = identity.getPrincipal();

  const result = await icrcActor.icrc2_allowance({
    account: { owner, subaccount: toNullable() },
    spender: { owner: spender, subaccount: toNullable() },
  });

  // 3. Return the raw bigint. The UI will format it.
  return result.allowance;
};

// --- ICRC-1 (Core) Functions ---

/**
 * Fetches the user's balance for a given ICRC-1 token.
 * @returns The balance as a bigint in the token's atomic unit.
 */
export const getBalance = async (
  identity: Identity,
  token: Token,
): Promise<bigint> => {
  const icrcActor = getIcrcActor(token.canisterId, identity);
  const owner = identity.getPrincipal();

  const balanceBigInt = await icrcActor.icrc1_balance_of({
    owner,
    subaccount: toNullable(),
  });

  // 4. Return the raw bigint.
  return balanceBigInt;
};

/**
 * Performs a generic ICRC-1 transfer.
 * @param amount The human-readable amount to transfer (e.g., 10.5).
 * @returns The transaction ID (`bigint`) of the successful transfer.
 */
export const icrc1Transfer = async (
  identity: Identity,
  token: Token,
  to: Principal,
  amount: number | string,
): Promise<bigint> => {
  const icrcActor = getIcrcActor(token.canisterId, identity);
  // 5. Use the token's own method for conversion.
  const amountToSend = token.toAtomic(amount);

  const transferArgs = {
    to: { owner: to, subaccount: toNullable<Uint8Array>() },
    amount: amountToSend,
    fee: toNullable<bigint>(), // Let the ledger assign the default fee
    memo: toNullable<Uint8Array>(),
    created_at_time: toNullable<bigint>(),
    from_subaccount: toNullable<Uint8Array>(),
  };

  const result = await icrcActor.icrc1_transfer(transferArgs);

  if ('Err' in result) {
    throw new Error(`ICRC-1 transfer failed: ${JSON.stringify(result.Err)}`);
  }

  return result.Ok;
};
