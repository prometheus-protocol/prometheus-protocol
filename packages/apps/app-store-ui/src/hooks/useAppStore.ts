import { useQuery } from '@tanstack/react-query';
import {
  getAppStoreListings,
  AppStoreListing,
  AppStoreDetails,
  VerificationStatus,
  getVerificationStatus,
  getAppDetailsByNamespace,
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
 * React Query hook to fetch detailed info for a single app by its WASM hash.
 * This is used for the App Details page.
 * @param appId The appId is the namespace string of the app.
 */
export const useGetAppDetailsByNamespace = (
  namespace: string | undefined, // Renamed from appId
  wasmId?: string,
) => {
  return useQuery<AppStoreDetails>({
    queryKey: wasmId
      ? ['appDetails', namespace, wasmId]
      : ['appDetails', namespace], // The key correctly uses both
    queryFn: async () => {
      if (!namespace) {
        throw new Error('Namespace not available');
      }
      const res = await getAppDetailsByNamespace(namespace, wasmId);
      if (!res) {
        throw new Error('App details not found');
      }
      return res;
    },
    enabled: !!namespace,
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
