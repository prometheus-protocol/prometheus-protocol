import { fetch } from 'cross-fetch';
import { Principal } from '@dfinity/principal';
import { HttpAgent, Identity } from '@dfinity/agent';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { createActor } from '../src/declarations/oauth_backend';
import canisterIds from '../.dfx/local/canister_ids.json';
import * as fs from 'fs/promises';
import * as path from 'path';

const backendCanisterId = Principal.fromText(canisterIds.oauth_backend.local);
// The ICRC-2 canister ID for ckUSDC
const icrc2CanisterId = Principal.fromText(canisterIds.icrc1_ledger.local);
const replicaUrl = `http://127.0.0.1:4943`;

const createActorFor = (identity: Identity) => {
  const agent = new HttpAgent({ host: replicaUrl, identity });
  return createActor(backendCanisterId, { agent });
};

export async function setup() {
  console.log('\n🚀 Performing global E2E setup...');

  // 1. Dynamically register a single client for all test suites
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
    throw new Error('Global setup failed: Could not register client.');
  }
  const dcrResponse = await registerResponse.json();

  // 2. Register a single resource server for all test suites
  const developerIdentity = Secp256k1KeyIdentity.generate();
  const backendActor = createActorFor(developerIdentity);
  const activateResponse = await backendActor.register_resource_server({
    initial_service_principal: developerIdentity.getPrincipal(),
    name: 'Global E2E Resource Server',
    logo_uri: '', // Optional, can be empty
    uris: ['https://some-oauth-resource-server.com'],
    accepted_payment_canisters: [icrc2CanisterId],
    scopes: [
      ['image:read', 'Allows the app to read your files.'],
      ['image:write', 'Allows the app to create and modify your files.'],
    ],
  });

  if (!('active' in activateResponse.status)) {
    throw new Error('Global setup failed: Could not register resource server.');
  }

  // 3. Write the client credentials to a temporary environment file
  const envContent = `
E2E_CLIENT_ID=${dcrResponse.client_id}
E2E_CLIENT_SECRET=${dcrResponse.client_secret}
  `;
  const envPath = path.join(__dirname, '.test.env');
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
