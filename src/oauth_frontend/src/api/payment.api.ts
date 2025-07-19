import { Identity } from '@dfinity/agent';
import { getIcrcActor, getAuthActor } from './actors';
import { toNullable } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';

// This is a critical helper function. ICRC-2 amounts are bigints, not floats.
// We need to convert the user's input (e.g., 10.50) to the correct integer representation.
const convertAmountToBigInt = (amount: number, decimals: number): bigint => {
  const factor = BigInt(10) ** BigInt(decimals);
  // To handle decimals in the input, multiply by the factor before converting to BigInt
  return BigInt(Math.round(amount * Number(factor)));
};

/**
 * Calls the icrc2_approve method on the ckUSDC ledger canister.
 * This allows a specific resource server to spend tokens on the user's behalf.
 * @param spenderPrincipal The Principal of the resource server being approved.
 */
export const approveAllowance = async (
  identity: Identity,
  amount: number,
  spenderPrincipal: Principal,
) => {
  const icrcActor = getIcrcActor(identity);

  // ckUSDC has 6 decimals. This should ideally come from the canister itself.
  const decimals = 6;
  const amountToApprove = convertAmountToBigInt(amount, decimals);

  const args = {
    spender: {
      owner: spenderPrincipal,
      subaccount: toNullable<Uint8Array>(), // Use the default subaccount
    },
    amount: amountToApprove,
    fee: toNullable<bigint>(), // No fee for this operation
    memo: toNullable<Uint8Array>(), // No memo needed
    created_at_time: toNullable<bigint>(), // Use the current time by default
    from_subaccount: toNullable<Uint8Array>(), // Use the default subaccount
    expected_allowance: toNullable<bigint>(), // No expected allowance
    expires_at: toNullable<bigint>(), // No expiration
  };

  const result = await icrcActor.icrc2_approve(args);

  if ('Err' in result) {
    // Throw an error so React Query can catch it
    throw new Error(Object.keys(result.Err)[0]);
  }

  return result.Ok;
};

/**
 * Notifies our backend that the payment setup is complete,
 * allowing the session state to be updated.
 */
export const completePaymentSetup = async (
  identity: Identity,
  sessionId: string,
) => {
  const authActor = getAuthActor(identity);
  const result = await authActor.complete_payment_setup(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }

  return result.ok;
};
