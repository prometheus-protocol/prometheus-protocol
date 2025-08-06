import { fetch } from 'cross-fetch';
import { Principal } from '@dfinity/principal';
import { HttpAgent, Identity } from '@dfinity/agent';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { createActor } from '@declarations/auth';
import canisterIds from '../../../../.dfx/local/canister_ids.json';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ResourceServer } from '@declarations/auth_server/auth_server.did';

const backendCanisterId = Principal.fromText(canisterIds.auth_server.local);
const icrc2CanisterId = Principal.fromText('aaaaa-aa');
const replicaUrl = `http://127.0.0.1:4943`;

const createActorFor = (identity: Identity) => {
  const agent = new HttpAgent({ host: replicaUrl, identity });
  return createActor(backendCanisterId, { agent });
};

export async function setup() {
  console.log('\n🚀 Performing global E2E setup...');

  // 1. Dynamically register a single client for all test suites
  // This is likely idempotent already, but we'll assume it is for now.
  const registerResponse = await fetch(
    `${replicaUrl}/register?canisterId=${backendCanisterId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Global E2E Test Client',
        redirect_uris: ['https://jwt.io'],
      }),
    },
  );

  if (registerResponse.status !== 201) {
    // This might fail if not idempotent, but we'll focus on the resource server error.
    console.warn('Could not register client, it might already exist.');
  }
  const dcrResponse = await registerResponse.json();

  // 2. Get or Create the Resource Server (Idempotent Pattern)
  // MODIFIED: Use a deterministic seed for the developer identity.
  // This ensures we are the same "developer" on every test run.
  const seedPhrase =
    'test test test test test test test test test test test junk';
  const developerIdentity = Secp256k1KeyIdentity.fromSeedPhrase(seedPhrase);
  const backendActor = createActorFor(developerIdentity);

  const targetUri = 'https://some-oauth-resource-server.com';
  let resourceServer: ResourceServer | undefined;

  // Step 2a: Check if the server already exists
  const existingServersRes = await backendActor.list_my_resource_servers();
  if ('err' in existingServersRes) {
    throw new Error(
      `Global setup failed during resource server listing: ${existingServersRes.err}`,
    );
  }
  const existingServers = existingServersRes.ok;
  console.log(
    'uris:',
    existingServers.map((s) => s.uris),
  );
  resourceServer = existingServers.find((s) => s.uris.includes(targetUri));

  // Step 2b: If it doesn't exist, create it
  if (!resourceServer) {
    console.log('Registering new resource server...');
    const registerRsResponse = await backendActor.register_resource_server({
      initial_service_principal: developerIdentity.getPrincipal(),
      name: 'Global E2E Resource Server',
      logo_uri: '',
      uris: [targetUri],
      accepted_payment_canisters: [icrc2CanisterId],
      scopes: [
        ['image:read', 'Allows the app to read your files.'],
        ['image:write', 'Allows the app to create and modify your files.'],
      ],
    });

    if ('err' in registerRsResponse) {
      throw new Error(
        `Global setup failed during registration: ${registerRsResponse.err}`,
      );
    }
    resourceServer = registerRsResponse.ok;
  } else {
    console.log('Resource server already exists. Using existing one.');
  }

  if (!resourceServer) {
    throw new Error(
      'Global setup failed: Could not get or create resource server.',
    );
  }

  // 3. Write the client credentials to a temporary environment file
  const envContent = `
E2E_CLIENT_ID=${dcrResponse.client_id}
E2E_RESOURCE_SERVER_ID=${resourceServer.resource_server_id}
  `;
  const envPath = path.join(__dirname, '..', '.test.env');
  await fs.writeFile(envPath, envContent.trim());

  console.log(
    '✅ Global E2E setup complete. Client and Resource Server are ready.',
  );

  return async () => {
    console.log('\n🧹 Performing global E2E teardown...');
    await fs.unlink(envPath);
    console.log('✅ Global E2E teardown complete.');
  };
}
