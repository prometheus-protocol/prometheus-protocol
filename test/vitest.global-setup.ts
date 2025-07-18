// test/vitest.global-setup.ts
import { fetch } from 'cross-fetch';
import { Principal } from '@dfinity/principal';
import canisterIds from '../.dfx/local/canister_ids.json';
import * as fs from 'fs/promises';
import * as path from 'path';

const backendCanisterId = Principal.fromText(canisterIds.oauth_backend.local);
const replicaUrl = `http://127.0.0.1:4943`;

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

  // 2. Write the credentials to a temporary environment file
  const envContent = `
E2E_CLIENT_ID=${dcrResponse.client_id}
E2E_CLIENT_SECRET=${dcrResponse.client_secret}
  `;
  const envPath = path.join(__dirname, '.test.env');
  await fs.writeFile(envPath, envContent.trim());

  console.log('✅ Global E2E setup complete. Client credentials saved.');

  // Teardown function (optional, but good practice)
  return async () => {
    console.log('\n🧹 Performing global E2E teardown...');
    await fs.unlink(envPath);
    console.log('✅ Global E2E teardown complete.');
  };
}
