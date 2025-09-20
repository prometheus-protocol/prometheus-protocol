// src/lib/search.api.ts

import { AppListing } from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import { getSearchIndexActor, getRegistryActor } from '../actors'; // You'll need both actors now

/**
 * Performs a full, two-hop search for apps.
 * 1. Queries the Indexer canister to get a list of matching namespaces.
 * 2. Queries the Registry canister to get the full AppListing details for those namespaces.
 *
 * @param queryString The search query string.
 * @returns A promise that resolves to an array of full AppListing objects.
 */
export const search = async (queryString: string): Promise<AppListing[]> => {
  // If the query is empty, return an empty array immediately.
  if (!queryString.trim()) {
    return [];
  }

  const indexerActor = getSearchIndexActor();
  const registryActor = getRegistryActor();

  // --- HOP 1: Get matching namespaces from the Indexer ---
  const matchingNamespaces = await indexerActor.search(queryString);

  // Optimization: If the indexer returns no matches, we're done.
  // This avoids a pointless second call to the registry.
  if (matchingNamespaces.length === 0) {
    return [];
  }

  // --- HOP 2: Get full app listings from the Registry for the matched namespaces ---
  const filter = matchingNamespaces.map((ns) => ({ namespace: ns }));

  // Note: Your candid might expect the filter to be wrapped in an outer array.
  // Adjust if necessary, e.g., `filter: [filter]`
  const response = await registryActor.get_app_listings({
    filter: [filter],
    prev: [], // Optional for pagination, empty for the first page
    take: [BigInt(matchingNamespaces.length)], // Request all matched items
  });

  // The registry returns a Result type, so we need to handle the 'ok' and 'err' cases.
  if ('ok' in response) {
    return response.ok;
  } else {
    // If there was an error fetching from the registry, log it and return an empty array.
    console.error('Failed to fetch app listings from registry:', response.err);
    throw new Error('Could not fetch app details for search results.');
  }
};
