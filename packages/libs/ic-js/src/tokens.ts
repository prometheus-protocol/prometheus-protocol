import { Principal } from '@icp-sdk/core/principal';

// --- TYPE DEFINITIONS ---

/**
 * The base information required to define a token.
 */
export interface TokenInfo {
  canisterId: Principal;
  name: string;
  symbol: string;
  decimals: number;
  fee: number;
}

/**
 * The enhanced Token object, which includes conversion methods.
 * This is the object you will interact with throughout the app.
 */
export interface Token extends TokenInfo {
  /** Converts a human-readable amount to its atomic unit (bigint). */
  toAtomic: (amount: string | number) => bigint;
  /** Converts an atomic amount (bigint) to a human-readable string. */
  fromAtomic: (atomicAmount: bigint) => string;
}

// --- CORE CONVERSION LOGIC (Internal Helpers) ---

/**
 * Converts a human-readable token amount into its atomic representation.
 * This is the generic, internal implementation.
 */
const toAtomicAmount = (amount: string | number, decimals: number): bigint => {
  const amountStr = String(amount);
  const [integerPart, fractionalPart = ''] = amountStr.split('.');

  if (fractionalPart.length > decimals) {
    throw new Error(
      `Amount "${amountStr}" has more than ${decimals} decimal places.`,
    );
  }
  const combined = (integerPart || '0') + fractionalPart.padEnd(decimals, '0');
  return BigInt(combined);
};

/**
 * Converts an atomic token amount into its human-readable string representation.
 * This is the generic, internal implementation.
 */
const fromAtomicAmount = (atomicAmount: bigint, decimals: number): string => {
  const atomicStr = atomicAmount.toString().padStart(decimals + 1, '0');
  const integerPart = atomicStr.slice(0, -decimals);
  const fractionalPart = atomicStr.slice(-decimals).replace(/0+$/, '');

  return fractionalPart.length > 0
    ? `${integerPart}.${fractionalPart}`
    : integerPart;
};

// --- TOKEN FACTORY ---

/**
 * A factory function that takes basic token info and returns an enhanced Token object
 * with attached conversion methods.
 * @param info The base TokenInfo object.
 * @returns An enhanced Token object.
 */
const createToken = (info: TokenInfo): Token => {
  return {
    ...info,
    toAtomic: (amount) => toAtomicAmount(amount, info.decimals),
    fromAtomic: (atomicAmount) => fromAtomicAmount(atomicAmount, info.decimals),
  };
};

// --- TOKEN DEFINITIONS ---

// NOTE: Replace these with your actual mainnet/local canister IDs.
const USDC_CANISTER_ID =
  process.env.CANISTER_ID_USDC_LEDGER || '53nhb-haaaa-aaaar-qbn5q-cai';

/**
 * The centralized, exported registry of all supported tokens.
 * Each token object is enhanced with its own `toAtomic` and `fromAtomic` methods.
 */
export const Tokens: Record<string, Token> = {
  USDC: createToken({
    canisterId: Principal.fromText(USDC_CANISTER_ID),
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    fee: 10_000, // Standard fee for ckUSDC is 10 e6s (0.001 USDC)
  }),
};
