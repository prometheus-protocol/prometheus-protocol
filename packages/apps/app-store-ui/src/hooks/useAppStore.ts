import { useQuery } from '@tanstack/react-query';
import {
  getAppStoreListings,
  getAppDetailsByHash,
  AppStoreListing,
  AppStoreDetails,
  VerificationStatus,
  getVerificationStatus,
} from '@prometheus-protocol/ic-js';

/**
 * React Query hook to fetch the list of all app store listings.
 * This is used for the main discovery/landing page.
 */
export const useGetAppStoreListings = () => {
  return useQuery<AppStoreListing[]>({
    // The query is public, but we include the principal to maintain a consistent
    // pattern and ensure reactivity if the identity changes.
    queryKey: ['appStoreListings'],
    queryFn: async () => {
      return getAppStoreListings();
    },
  });
};

/**
 * React Query hook to fetch the full details for a single app version,
 * identified by its WASM hash.
 * @param wasmId The WASM hash of the app version as a hex string.
 */
export const useGetAppDetails = (wasmId: string | undefined) => {
  return useQuery<AppStoreDetails>({
    // The query key includes the specific hash to ensure uniqueness per app details page.
    queryKey: ['appDetails', wasmId],
    queryFn: async () => {
      if (!wasmId) {
        throw new Error('WASM hash not available');
      }
      // Call the API to get
      const res = await getAppDetailsByHash(wasmId);
      console.log('App details fetched:', res);
      return res;
    },
    // The query should only run when we have both a hash to look up.
    enabled: !!wasmId,
  });
};

/**
 * React Query hook to fetch the full verification status for a single app version,
 * including all processed attestations and bounties. This is the primary data
 * source for the Certificate Page.
 * @param wasmId The WASM hash of the app version as a hex string.
 */
export const useGetVerificationStatus = (wasmId: string | undefined) => {
  return useQuery<VerificationStatus>({
    // The query key is specific to this data and this WASM hash
    queryKey: ['verificationStatus', wasmId],
    queryFn: async () => {
      if (!wasmId) {
        throw new Error('WASM hash not available');
      }
      // This calls our robust, data-processing API function
      return getVerificationStatus(wasmId);
    },
    // The query will not run until we have everything we need
    enabled: !!wasmId,
  });
};
