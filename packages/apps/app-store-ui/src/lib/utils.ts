import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A type guard that filters out null and undefined values from an array.
 * @example
 * const values: (string | null)[] = ['a', null, 'b'];
 * const validValues: string[] = values.filter(isDefined); // ['a', 'b']
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// A helper function to make the principal ID more readable
export const truncatePrincipal = (principal: string) => {
  if (!principal) return '';
  const parts = principal.split('-');
  if (parts.length <= 2) return principal;
  return `${parts[0]}...${parts[parts.length - 1]}`;
};

/**
 * Converts a Uint8Array to a hexadecimal string.
 * @param bytes The Uint8Array to convert.
 * @returns The hexadecimal string representation.
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param hexString The hexadecimal string to convert.
 * @returns The corresponding Uint8Array.
 */
export function hexToUint8Array(hexString: string): Uint8Array {
  // Ensure the hex string has an even number of characters, remove 0x prefix if present
  const cleanHexString = hexString.startsWith('0x')
    ? hexString.slice(2)
    : hexString;
  if (cleanHexString.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters');
  }

  const bytes = new Uint8Array(cleanHexString.length / 2);
  for (let i = 0; i < cleanHexString.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHexString.substring(i, i + 2), 16);
  }
  return bytes;
}
