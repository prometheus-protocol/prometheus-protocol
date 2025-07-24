import { Identity } from '@dfinity/agent';
import { getAuthActor } from './actors';
import { Principal } from '@dfinity/principal';

export interface PublicResourceServer {
  resource_server_id: string;
  name: string;
  logo_uri: string;
  uris: string[];
  scopes: [string, string][];
  accepted_payment_canisters: Principal[];
  service_principals: Principal[]; // List of trusted backend server identities.
}

// --- API Functions for Grant Management ---

/**
 * Fetches the list of resource server IDs for which the current user has an active grant.
 * @returns An array of resource server ID strings.
 */
export const getMyGrants = async (identity: Identity): Promise<string[]> => {
  const authActor = getAuthActor(identity);
  // This backend method directly returns the array, not a Result object.
  const result = await authActor.get_my_grants();
  return result;
};

/**
 * Fetches the public, non-sensitive details of a specific resource server.
 * This is used to display names and logos for the user's connections.
 */
export const getPublicResourceServer = async (
  identity: Identity,
  resourceServerId: string,
): Promise<PublicResourceServer> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.get_public_resource_server(resourceServerId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Revokes a user's grant for a specific resource server.
 * This will remove the connection from their list.
 */
export const revokeGrant = async (
  identity: Identity,
  resourceServerId: string,
): Promise<string> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.revoke_grant(resourceServerId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};
