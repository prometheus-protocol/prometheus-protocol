import {
  listPendingVerifications,
  getBountiesForWasm,
  reserveBountyWithApiKey,
  fileAttestation,
  submitDivergence,
  hasVerifierParticipatedWithApiKey,
  AttestationData,
  configure as configureIcJs,
} from '@prometheus-protocol/ic-js';
import { verifyBuild } from './builder.js';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURE THE SHARED PACKAGE ---
// Configuration from environment variables
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);
const VERIFIER_API_KEY = process.env.VERIFIER_API_KEY;
const IC_NETWORK = process.env.IC_NETWORK || 'ic';

if (!VERIFIER_API_KEY) {
  console.error('❌ VERIFIER_API_KEY environment variable is required');
  console.error(
    '   Generate an API key from the verifier dashboard after depositing stake',
  );
  process.exit(1);
}

// This function is ONLY for local development
function loadLocalCanisterIds() {
  const network = 'local';
  const canisterIdsPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '.dfx',
    network,
    'canister_ids.json',
  );

  if (!fs.existsSync(canisterIdsPath)) {
    throw new Error(
      `Could not find local canister_ids.json at ${canisterIdsPath}. Run 'dfx deploy' first.`,
    );
  }

  try {
    const canisterIdsJson = JSON.parse(
      fs.readFileSync(canisterIdsPath, 'utf-8'),
    );
    return Object.entries(canisterIdsJson).reduce(
      (acc: Record<string, string>, [name, ids]) => {
        acc[name.toUpperCase()] = (ids as Record<string, string>)[network];
        return acc;
      },
      {},
    );
  } catch (e) {
    console.error('Error parsing canister_ids.json:', e);
    throw e;
  }
}

// Load canister IDs based on network
let canisterIds: Record<string, string>;

if (IC_NETWORK === 'ic') {
  console.log('[Bot] Using production canister IDs.');
  canisterIds = __PROD_CANISTER_IDS__;

  if (!canisterIds || Object.keys(canisterIds).length === 0) {
    console.error(
      'Error: Production canister IDs were not baked into this build. Please rebuild the bot.',
    );
    process.exit(1);
  }
} else if (IC_NETWORK === 'local') {
  console.log('[Bot] Using local canister IDs from .dfx directory.');
  canisterIds = loadLocalCanisterIds();
} else {
  console.error(
    `Error: Invalid network specified: '${IC_NETWORK}'. Use 'ic' or 'local'.`,
  );
  process.exit(1);
}

// Configure the shared library with the chosen set of IDs
const host =
  IC_NETWORK === 'ic' ? 'https://icp-api.io' : 'http://127.0.0.1:4943';

console.log(`[Bot] Host: ${host}`);
configureIcJs({ canisterIds, host });
// ------------------------------------

console.log('🤖 Prometheus Protocol Verifier Bot');
console.log('====================================');
console.log(`🔑 API Key: ${VERIFIER_API_KEY.slice(0, 12)}...`);
console.log(`🌐 Network: ${IC_NETWORK}`);
console.log(`⏱️  Poll Interval: ${POLL_INTERVAL_MS}ms`);
console.log('====================================\n');

/**
 * Main polling and verification loop.
 * Fetches pending verifications, checks for bounties, and processes jobs.
 */
async function pollAndVerify(): Promise<void> {
  try {
    console.log(
      `🔍 [${new Date().toISOString()}] Polling for pending verifications...`,
    );

    const pending = await listPendingVerifications();
    console.log(`   Found ${pending.length} pending verification(s)`);

    if (pending.length === 0) {
      return;
    }

    for (const job of pending) {
      const jobSummary = `${job.wasm_hash.slice(0, 12)}... from ${job.repo}`;

      try {
        // Check if this job has a build_reproducibility_v1 bounty
        console.log(`   🔍 Checking bounties for WASM: ${job.wasm_hash}`);
        const bounties = await getBountiesForWasm(job.wasm_hash);
        console.log(`   📋 Found ${bounties.length} bounties for this WASM`);

        // Check if we've already participated in this WASM verification
        const alreadyParticipated = await hasVerifierParticipatedWithApiKey(
          job.wasm_hash,
          VERIFIER_API_KEY,
        );

        if (alreadyParticipated) {
          console.log(
            `   ⏭️  Skipping ${jobSummary}: Already participated in this verification`,
          );
          continue;
        }

        // Find an available bounty that isn't already claimed
        const buildBounty = bounties.find((b: any) => {
          const auditType = b.challengeParameters?.audit_type;
          const isBuildBounty = auditType === 'build_reproducibility_v1';
          // Note: claimed bounties won't be returned by getBountiesForWasm as they're filtered
          return isBuildBounty;
        });

        if (!buildBounty) {
          console.log(`   ⏭️  Skipping ${jobSummary}: No bounty sponsored yet`);
          continue;
        }

        console.log(`\n🎯 Processing verification job`);
        console.log(`   WASM Hash: ${job.wasm_hash}`);
        console.log(`   Repo: ${job.repo}`);
        console.log(`   Commit: ${job.commit_hash}`);
        console.log(`   Bounty ID: ${buildBounty.id}`);
        console.log(`   Reward: ${buildBounty.tokenAmount} tokens`);

        // Reserve the bounty using API key (stakes USDC automatically)
        console.log(`\n🔒 Reserving bounty with API key...`);
        await reserveBountyWithApiKey({
          api_key: VERIFIER_API_KEY,
          bounty_id: buildBounty.id,
          token_id: 'build_reproducibility_v1',
        });
        console.log(`   ✅ Bounty reserved, stake locked for 1 hour`);

        // Run the reproducible build (auto-detects canister name from dfx.json)
        console.log(`\n🔨 Starting reproducible build...`);
        const result = await verifyBuild(
          job.repo,
          job.commit_hash,
          job.wasm_hash,
        );

        console.log(`\n📊 Build completed in ${result.duration}s`);

        if (result.success) {
          // Success: File attestation
          console.log(`✅ Build verified! Hash matches. Filing attestation...`);

          const attestationData: AttestationData = {
            '126:audit_type': 'build_reproducibility_v1',
            build_duration_seconds: result.duration,
            verifier_version: '2.0.0', // Updated for API key auth
            build_timestamp: Date.now() * 1_000_000, // Convert to nanoseconds (IC standard)
            git_commit: job.commit_hash,
            repo_url: job.repo,
          };

          // Add truncated build log if available
          if (result.buildLog) {
            attestationData['build_log_excerpt'] = result.buildLog.slice(
              0,
              500,
            );
          }

          // Note: fileAttestation needs to be updated to not require identity
          // For now, we'll need to add an API-key variant
          await fileAttestation(undefined as any, {
            bounty_id: buildBounty.id,
            wasm_id: job.wasm_hash,
            attestationData,
          });

          console.log(`   ✅ Attestation filed successfully`);
          console.log(`   ⏳ Waiting for 5-of-9 consensus...`);
          console.log(
            `   ✅ WASM ${job.wasm_hash.slice(0, 12)}... attestation recorded`,
          );
          console.log(
            `   💰 Payout will be automatic after consensus is reached\n`,
          );
        } else {
          // Failure: File divergence
          console.log(
            `❌ Build verification failed. Filing divergence report...`,
          );
          console.log(`   Reason: ${result.error}`);

          // Note: submitDivergence needs to be updated to not require identity
          await submitDivergence(undefined as any, {
            bountyId: buildBounty.id,
            wasmId: job.wasm_hash,
            reason: result.error || 'Build failed or hash mismatch',
          });

          console.log(`   ✅ Divergence report filed`);
          console.log(`   ⏳ Waiting for 5-of-9 consensus...`);
          console.log(
            `   ❌ WASM ${job.wasm_hash.slice(0, 12)}... divergence reported`,
          );
          console.log(
            `   💰 Payout will be automatic after consensus is reached\n`,
          );
        }
      } catch (error: any) {
        console.error(`\n❌ Error processing ${jobSummary}:`);
        console.error(`   ${error.message}`);

        // If we reserved the bounty but failed to submit results,
        // the lock will expire in 1 hour and our stake will be slashed.
        // This is intentional to prevent griefing attacks.
        console.error(`   ⚠️  Lock will expire in 1 hour if not resolved`);
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Polling error: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Main execution
async function main() {
  setupShutdownHandlers();

  console.log('🚀 Verifier Bot is starting...\n');

  // Run immediately on startup
  await pollAndVerify();

  // Then poll on interval
  setInterval(async () => {
    await pollAndVerify();
  }, POLL_INTERVAL_MS);

  console.log(`✅ Verifier Bot is now running`);
  console.log(`   Polling every ${POLL_INTERVAL_MS / 1000} seconds\n`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
