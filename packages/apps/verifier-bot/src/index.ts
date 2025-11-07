import {
  listPendingVerifications,
  getBountiesForWasm,
  reserveBountyWithApiKey,
  fileAttestation,
  submitDivergence,
  fileAttestationWithApiKey,
  submitDivergenceWithApiKey,
  hasVerifierParticipatedWithApiKey,
  getBountyLock,
  getLockedBountyForVerifier,
  AttestationData,
  configure as configureIcJs,
} from '@prometheus-protocol/ic-js';
import { verifyBuild } from './builder.js';
// Load dotenv only in development (Docker containers have env vars set)
if (process.env.NODE_ENV !== 'production') {
  await import('dotenv/config');
}
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to persist participated WASMs across restarts
const PARTICIPATED_CACHE_FILE = path.join(
  __dirname,
  '.participated-wasms.json',
);

// Load participated WASMs from disk
function loadParticipatedWasms(): Set<string> {
  try {
    if (fs.existsSync(PARTICIPATED_CACHE_FILE)) {
      const data = fs.readFileSync(PARTICIPATED_CACHE_FILE, 'utf-8');
      return new Set(JSON.parse(data));
    }
  } catch (error) {
    console.error('Failed to load participated cache:', error);
  }
  return new Set();
}

// Save participated WASMs to disk
function saveParticipatedWasms(wasms: Set<string>): void {
  try {
    fs.writeFileSync(
      PARTICIPATED_CACHE_FILE,
      JSON.stringify([...wasms]),
      'utf-8',
    );
  } catch (error) {
    console.error('Failed to save participated cache:', error);
  }
}

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
  IC_NETWORK === 'ic'
    ? 'https://icp-api.io'
    : process.env.IC_HOST || 'http://host.docker.internal:4943';

console.log(`[Bot] Host: ${host}`);
configureIcJs({ canisterIds, host });
// ------------------------------------

console.log('🤖 Prometheus Protocol Verifier Bot');
console.log('====================================');
console.log(`🔑 API Key: ${VERIFIER_API_KEY.slice(0, 12)}...`);
console.log(`🌐 Network: ${IC_NETWORK}`);
console.log(`⏱️  Poll Interval: ${POLL_INTERVAL_MS}ms`);
console.log('====================================\n');

// Track WASMs where we've already submitted results to avoid retrying failed submissions
// Persisted to disk so it survives restarts
const participatedWasms = loadParticipatedWasms();
console.log(
  `📝 Loaded ${participatedWasms.size} previously participated WASMs from cache\n`,
);

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
        // Skip WASMs where we've already submitted results (and got "already participated" error)
        if (participatedWasms.has(job.wasm_hash)) {
          continue; // Silent skip - no need to log every time
        }

        // Check if this job has a build_reproducibility_v1 bounty
        console.log(`   🔍 Checking bounties for WASM: ${job.wasm_hash}`);
        const bounties = await getBountiesForWasm(job.wasm_hash);
        console.log(`   📋 Found ${bounties.length} bounties for this WASM`);

        // Find all build reproducibility bounties
        const buildBounties = bounties.filter((b: any) => {
          const auditType = b.challengeParameters?.audit_type;
          return auditType === 'build_reproducibility_v1';
        });

        if (buildBounties.length === 0) {
          console.log(`   ⏭️  Skipping ${jobSummary}: No bounty sponsored yet`);
          continue;
        }

        // First, check if we already have an active lock on any bounty for this WASM
        // This allows resuming work after restart/disconnect
        let buildBounty: any = null;
        let isResumingWork = false;

        const alreadyParticipated = await hasVerifierParticipatedWithApiKey(
          job.wasm_hash,
          VERIFIER_API_KEY,
        );

        if (alreadyParticipated) {
          // We have an active lock - find which bounty it is
          console.log(
            `   🔄 Found existing lock, finding which bounty to resume...`,
          );

          // Use the helper function to find which bounty this verifier has locked
          buildBounty = await getLockedBountyForVerifier(
            job.wasm_hash,
            VERIFIER_API_KEY,
          );

          if (!buildBounty) {
            // Couldn't find our lock - it may have expired
            console.log(
              `   ⏭️  Skipping ${jobSummary}: Lock expired or work already completed`,
            );
            continue;
          }

          isResumingWork = true;
          console.log(`   ♻️  Resuming work on bounty ${buildBounty.id}`);
        } else {
          // Try to reserve a new bounty - attempt each one until successful
          let reservationError: string | null = null;

          for (const bounty of buildBounties) {
            try {
              console.log(`\n🔒 Attempting to reserve bounty ${bounty.id}...`);
              await reserveBountyWithApiKey({
                api_key: VERIFIER_API_KEY,
                bounty_id: bounty.id,
                token_id: canisterIds.USDC_LEDGER,
              });
              buildBounty = bounty;
              console.log(
                `   ✅ Bounty ${bounty.id} reserved, stake locked for 1 hour`,
              );
              break;
            } catch (error: any) {
              const errorMsg = error.message || String(error);
              if (errorMsg.includes('already locked')) {
                console.log(
                  `   ⏭️  Bounty ${bounty.id} is already locked, trying next...`,
                );
                continue;
              } else {
                // Other errors (insufficient balance, etc.) should stop trying
                reservationError = errorMsg;
                break;
              }
            }
          }

          if (!buildBounty) {
            console.log(
              `   ⏭️  Skipping ${jobSummary}: ${reservationError || 'All bounties are locked'}`,
            );
            continue;
          }
        }

        console.log(`\n🎯 Processing verification job`);
        console.log(`   WASM Hash: ${job.wasm_hash}`);
        console.log(`   Repo: ${job.repo}`);
        console.log(`   Commit: ${job.commit_hash}`);
        console.log(`   Bounty ID: ${buildBounty.id}`);
        console.log(`   Reward: ${buildBounty.tokenAmount} tokens`);

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

          // Re-check which bounty we actually own after the build
          // (state may have changed during the long build process)
          console.log(`🔍 Re-verifying bounty ownership after build...`);
          const currentBounty = await getLockedBountyForVerifier(
            job.wasm_hash,
            VERIFIER_API_KEY,
          );

          if (!currentBounty) {
            console.log(
              `   ⚠️  No longer have a lock on any bounty for this WASM`,
            );
            console.log(
              `   This can happen if the lock expired or was taken by another bot`,
            );
            continue;
          }

          if (currentBounty.id !== buildBounty.id) {
            console.log(
              `   ℹ️  Bounty changed from ${buildBounty.id} to ${currentBounty.id} during build`,
            );
            buildBounty = currentBounty; // Update to the current bounty
          }

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

          try {
            await fileAttestationWithApiKey(VERIFIER_API_KEY, {
              bounty_id: buildBounty.id,
              wasm_id: job.wasm_hash,
              attestationData,
            });
            console.log(`   ✅ Attestation filed successfully`);
          } catch (error: any) {
            // Check if we already participated - if so, mark and skip in future
            if (
              error.message &&
              error.message.includes('already participated')
            ) {
              console.log(`   ℹ️  Already participated in this verification`);
              participatedWasms.add(job.wasm_hash);
              saveParticipatedWasms(participatedWasms);
              continue; // Skip to next job
            }
            console.error(`   ❌ Failed to file attestation:`, error.message);
            throw error;
          }
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

          try {
            await submitDivergenceWithApiKey(VERIFIER_API_KEY, {
              bountyId: buildBounty.id,
              wasmId: job.wasm_hash,
              reason: result.error || 'Build failed or hash mismatch',
            });
            console.log(`   ✅ Divergence report filed successfully`);
          } catch (error: any) {
            // Check if we already participated - if so, mark and skip in future
            if (
              error.message &&
              error.message.includes('already participated')
            ) {
              console.log(`   ℹ️  Already participated in this verification`);
              participatedWasms.add(job.wasm_hash);
              saveParticipatedWasms(participatedWasms);
              continue; // Skip to next job
            }
            console.error(
              `   ❌ Failed to file divergence report:`,
              error.message,
            );
            throw error;
          }

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

  // Wait a moment for replica to be fully ready (avoid noisy startup errors)
  if (IC_NETWORK === 'local') {
    console.log('⏳ Waiting for local replica to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

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
