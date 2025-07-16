// generate-auth-url.js
const crypto = require('crypto');
const fs = require('fs'); // Import the file system module

// --- CONFIGURATION ---
const AUTH_CANISTER_ID = 'avqkn-guaaa-aaaaa-qaaea-cai'; // Example ID, replace me!
const ENV_FILE = '.env.prom';
// ---------------------

// Use environment variables if they exist, otherwise use defaults
const CLIENT_ID = process.env.NEW_CLIENT_ID || 'test-app-01';
const REDIRECT_URI = 'https://jwt.io';
const STATE = `cli-run-${Date.now()}`;
const SCOPE = 'profile';
const RESOURCE_SERVER_ID =
  'rs_41f480c88b2515b87c3cc9543008aabd0625061ab54b047a747f3492b8ffd22e';

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function sha256(verifier) {
  return crypto.createHash('sha256').update(verifier).digest();
}

function base64urlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function main() {
  if (AUTH_CANISTER_ID.includes('replace me')) {
    /* ... error handling ... */ return;
  }
  if (!process.env.NEW_CLIENT_ID) {
    console.warn(
      "\n⚠️ WARNING: $NEW_CLIENT_ID is not set. Using default 'test-app-01'.",
    );
    console.warn(
      '   Run `source .env.prom` if you have registered a new client.\n',
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = base64urlEncode(sha256(codeVerifier));

  // Append the verifier to our environment file.
  // This makes it available to the get_token.sh script later.
  const export_command = `\nexport PKCE_VERIFIER="${codeVerifier}"`;
  fs.appendFileSync(ENV_FILE, export_command, 'utf8');

  const authUrl = new URL(
    `http://${AUTH_CANISTER_ID}.localhost:4943/authorize`,
  );
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', STATE);
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Tell the Auth Canister which resource we want to get a token for.
  authUrl.searchParams.set('resource', RESOURCE_SERVER_ID);

  console.log('\n✅ PKCE Verifier Saved & URL Generated!');
  console.log(
    '------------------------------------------------------------------',
  );
  console.log(`\nSTEP 1: The PKCE verifier has been saved to '${ENV_FILE}'.`);
  console.log('   Run `source .env.prom` to load it into your shell.');
  console.log(
    '\n------------------------------------------------------------------',
  );
  console.log(
    '\nSTEP 2: Paste this full URL into your browser to start the flow.\n',
  );
  console.log(`   Authorize URL: ${authUrl.href}`);
  console.log(
    '\n------------------------------------------------------------------',
  );
}

main();
