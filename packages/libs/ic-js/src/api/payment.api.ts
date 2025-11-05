import { Identity } from '@icp-sdk/core/agent';
import { toNullable } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import { getIcrcActor } from '../actors.js';
import { Token } from '../tokens.js';

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
 * Gets the balance of a specific principal for a given token.
 * @param identity The identity to use for authentication (not the owner we're checking)
 * @param token The token to check the balance for
 * @param owner The principal whose balance to check
 * @returns The balance as a bigint in the token's atomic unit.
 */
export const getBalanceOf = async (
  identity: Identity,
  token: Token,
  owner: Principal,
): Promise<bigint> => {
  const icrcActor = getIcrcActor(token.canisterId, identity);

  const balanceBigInt = await icrcActor.icrc1_balance_of({
    owner,
    subaccount: toNullable(),
  });

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
