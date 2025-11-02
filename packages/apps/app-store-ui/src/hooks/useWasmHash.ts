import { useQuery } from '@tanstack/react-query';
import { getCanisterWasmHash } from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';

export interface WasmHashVerification {
  expectedWasmId: string; // The expected WASM hash as hex string
  actualWasmHash: Uint8Array | null; // The actual WASM hash from the canister
  isMatching: boolean; // Whether the hashes match
  status: 'loading' | 'match' | 'mismatch' | 'error' | 'not-found';
}

/**
 * Hook to verify if a canister's actual WASM hash matches the expected WASM hash.
 * This is useful for security verification to ensure the deployed canister
 * matches the verified version.
 *
 * @param canisterId - The Principal of the canister to check
 * @param expectedWasmId - The expected WASM hash as a hex string
 * @returns WasmHashVerification object with comparison results
 */
export const useWasmHash = (
  canisterId: Principal | undefined,
  expectedWasmId: string | undefined,
): WasmHashVerification => {
  const {
    data: actualWasmHash,
    isLoading,
    isError,
    error,
  } = useQuery<Uint8Array | null>({
    queryKey: ['canisterWasmHash', canisterId?.toText()],
    queryFn: async () => {
      if (!canisterId) {
        throw new Error('Canister ID is required');
      }
      return getCanisterWasmHash(canisterId);
    },
    enabled: !!canisterId,
  });

  // Convert expected WASM ID from hex to Uint8Array for comparison
  const expectedWasmHash = expectedWasmId
    ? hexToUint8Array(expectedWasmId)
    : null;

  // Determine the status and matching result
  let status: WasmHashVerification['status'] = 'loading';
  let isMatching = false;

  if (isLoading) {
    status = 'loading';
  } else if (isError) {
    status = 'error';
  } else if (actualWasmHash === null) {
    status = 'not-found';
  } else if (expectedWasmHash && actualWasmHash) {
    isMatching = uint8ArraysEqual(actualWasmHash, expectedWasmHash);
    status = isMatching ? 'match' : 'mismatch';
  }

  return {
    expectedWasmId: expectedWasmId || '',
    actualWasmHash: actualWasmHash || null,
    isMatching,
    status,
  };
};

/**
 * Convert a hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  // Remove any '0x' prefix if present
  const cleanHex = hex.replace(/^0x/i, '');

  // Ensure even number of characters
  const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;

  const bytes = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < paddedHex.length; i += 2) {
    bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Compare two Uint8Arrays for equality
 */
function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
