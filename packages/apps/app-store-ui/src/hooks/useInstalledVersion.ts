import { Principal } from '@icp-sdk/core/principal';
import { AppVersionSummary } from '@prometheus-protocol/ic-js';
import { useWasmHash, uint8ArrayToHex } from './useWasmHash';

/**
 * Hook to determine which version is currently installed on a canister
 * by comparing the canister's actual WASM hash with the available versions.
 *
 * @param canisterId - The Principal of the canister to check
 * @param allVersions - Array of all available versions to compare against
 * @returns The version summary that matches the deployed WASM, or null if no match
 */
export const useInstalledVersion = (
  canisterId: Principal | undefined,
  allVersions: AppVersionSummary[],
): {
  installedVersion: AppVersionSummary | null;
  isLoading: boolean;
  isError: boolean;
} => {
  // We'll use the first version's wasmId as a placeholder to get the actual hash
  // The specific expectedWasmId doesn't matter here since we only need the actualWasmHash
  const firstVersionWasmId = allVersions[0]?.wasmId || '';

  const { actualWasmHash, status } = useWasmHash(
    canisterId,
    firstVersionWasmId,
  );

  const isLoading = status === 'loading';
  const isError = status === 'error';

  let installedVersion: AppVersionSummary | null = null;

  if (actualWasmHash && !isLoading && !isError) {
    const actualWasmId = uint8ArrayToHex(actualWasmHash);

    // Find the version that matches the actual WASM hash
    installedVersion =
      allVersions.find((version) => version.wasmId === actualWasmId) || null;
  }

  return {
    installedVersion,
    isLoading,
    isError,
  };
};
