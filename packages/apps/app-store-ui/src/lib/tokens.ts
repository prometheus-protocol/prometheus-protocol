/**
 * Converts a human-readable token amount (as a string or number) into its atomic
 * representation (as a bigint) based on the token's decimals.
 *
 * This implementation uses only native BigInt and avoids floating point math,
 * making it safe for financial calculations.
 *
 * @param amount The human-readable amount (e.g., 1.5, "0.001").
 * @param decimals The number of decimals the token uses (e.g., 8 for ICP).
 * @returns The atomic amount as a bigint.
 *
 * @example
 * toAtomicAmount("1.5", 8) // returns 150000000n
 * toAtomicAmount(100, 6)   // returns 100000000n
 */
export const toAtomicAmount = (
  amount: string | number,
  decimals: number,
): bigint => {
  const amountStr = String(amount);
  const [integerPart, fractionalPart = ''] = amountStr.split('.');

  if (fractionalPart.length > decimals) {
    throw new Error(
      `Amount "${amountStr}" has more than ${decimals} decimal places.`,
    );
  }

  // Combine the integer and fractional parts into a single string
  const combined = (integerPart || '0') + fractionalPart.padEnd(decimals, '0');

  return BigInt(combined);
};

/**
 * Converts an atomic token amount (as a bigint) into its human-readable
 * string representation, formatted to the correct number of decimal places.
 *
 * This implementation uses only native BigInt and string manipulation.
 *
 * @param atomicAmount The atomic amount from the canister (e.g., 150000000n).
 * @param decimals The number of decimals the token uses (e.g., 8 for ICP).
 * @returns The human-readable amount as a string.
 *
 * @example
 * fromAtomicAmount(150000000n, 8) // returns "1.5"
 * fromAtomicAmount(50000n, 8)     // returns "0.0005"
 * fromAtomicAmount(100000000n, 8) // returns "1"
 */
export const fromAtomicAmount = (
  atomicAmount: bigint,
  decimals: number,
): string => {
  const atomicStr = atomicAmount.toString().padStart(decimals + 1, '0');

  const integerPart = atomicStr.slice(0, -decimals);
  const fractionalPart = atomicStr.slice(-decimals);

  // Remove trailing zeros from the fractional part
  const trimmedFractional = fractionalPart.replace(/0+$/, '');

  if (trimmedFractional.length === 0) {
    return integerPart; // It's a whole number
  }

  return `${integerPart}.${trimmedFractional}`;
};

// --- Convenience Wrappers for ICRC-1 Standard (8 Decimals) ---

const ICRC1_DECIMALS = 8;

/**
 * Convenience wrapper for `toAtomicAmount` specifically for tokens with 8 decimals (like ICP).
 * Converts a human-readable amount to e8s.
 * @param amount The human-readable amount (e.g., 1.5).
 * @returns The amount in e8s as a bigint.
 */
export const toE8s = (amount: string | number): bigint => {
  return toAtomicAmount(amount, ICRC1_DECIMALS);
};

/**
 * Convenience wrapper for `fromAtomicAmount` specifically for tokens with 8 decimals (like ICP).
 * Converts an amount in e8s to its human-readable string representation.
 * @param e8s The amount in e8s (e.g., 150000000n).
 * @returns The human-readable amount as a string.
 */
export const fromE8s = (e8s: bigint): string => {
  return fromAtomicAmount(e8s, ICRC1_DECIMALS);
};

// Create functions to convert to USDC (6 decimals) as well

const USDC_DECIMALS = 6;

/**
 * Convenience wrapper for `toAtomicAmount` specifically for USDC (6 decimals).
 * Converts a human-readable amount to its atomic representation in USDC.
 * @param amount The human-readable amount (e.g., 1.5).
 * @returns The amount in atomic USDC as a bigint.
 */
export const toUSDC = (amount: string | number): bigint => {
  return toAtomicAmount(amount, USDC_DECIMALS);
};

/**
 * Convenience wrapper for `fromAtomicAmount` specifically for USDC (6 decimals).
 * Converts an amount in atomic USDC to its human-readable string representation.
 * @param usdc The amount in atomic USDC (e.g., 1500000n).
 * @returns The human-readable amount as a string.
 */
export const fromUSDC = (usdc: bigint): string => {
  return fromAtomicAmount(usdc, USDC_DECIMALS);
};
