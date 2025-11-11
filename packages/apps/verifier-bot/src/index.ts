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
  requestVerificationJob,
  releaseJobAssignment,
  AttestationData,
  configure as configureIcJs,
} from '@prometheus-protocol/ic-js';
import { verifyBuild } from './builder.js';
import { verifyMcpTools } from './mcp-tools.js';
// Load dotenv only in development (Docker containers have env vars set)
if (process.env.NODE_ENV !== 'production') {
  await import('dotenv/config');
}
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to persist completed bounties across restarts
const COMPLETED_BOUNTIES_CACHE_FILE = path.join(
  __dirname,
  '.completed-bounties.json',
);

// Load completed bounties from disk
function loadCompletedBounties(): Set<bigint> {
  try {
    if (fs.existsSync(COMPLETED_BOUNTIES_CACHE_FILE)) {
      const data = fs.readFileSync(COMPLETED_BOUNTIES_CACHE_FILE, 'utf-8');
      const arr = JSON.parse(data);
      return new Set(arr.map((id: string) => BigInt(id)));
    }
  } catch (error) {
    console.error('Failed to load completed bounties cache:', error);
  }
  return new Set();
}

// Save completed bounties to disk
function saveCompletedBounties(bounties: Set<bigint>): void {
  try {
    const arr = [...bounties].map((id) => id.toString());
    fs.writeFileSync(
      COMPLETED_BOUNTIES_CACHE_FILE,
      JSON.stringify(arr),
      'utf-8',
    );
  } catch (error) {
    console.error('Failed to save completed bounties cache:', error);
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

// Track completed bounties to avoid re-processing the same job
// Persisted to disk so it survives restarts
const completedBounties = loadCompletedBounties();
console.log(
  `📝 Loaded ${completedBounties.size} previously completed bounties from cache\n`,
);

/**
 * New job-queue-based polling function.
 * Requests work directly from audit hub instead of scanning all pending verifications.
 */
async function pollAndVerifyWithJobQueue(): Promise<void> {
  const MAX_JOB_ATTEMPTS = 5; // Try up to 5 times to get a valid job

  for (let attempt = 0; attempt < MAX_JOB_ATTEMPTS; attempt++) {
    try {
      if (attempt > 0) {
        console.log(
          `   🔄 Attempt ${attempt + 1}/${MAX_JOB_ATTEMPTS} to get a new job...`,
        );
      } else {
        console.log(
          `🔍 [${new Date().toISOString()}] Requesting verification job from audit hub...`,
        );
      }

      // Request a job assignment from the audit hub
      const job = await requestVerificationJob(VERIFIER_API_KEY!);

      if (!job) {
        console.log(`   ℹ️  No verification jobs available`);
        return;
      }

      // Check if we've already completed this bounty
      if (completedBounties.has(job.bounty_id)) {
        console.log(
          `   ✅ Already completed bounty ${job.bounty_id}. Skipping...`,
        );
        return;
      }

      console.log(`\n🎯 Received job assignment`);
      console.log(`   WASM ID: ${job.wasm_id}`);
      console.log(`   Repo: ${job.repo}`);
      console.log(`   Commit: ${job.commit_hash}`);
      console.log(`   Bounty ID: ${job.bounty_id}`);
      console.log(
        `   Expires: ${new Date(Number(job.expires_at) / 1_000_000).toISOString()}`,
      );

      // Extract audit_type from build_config (challenge_parameters)
      const buildConfigMap = new Map(job.build_config);
      console.log(
        `   🐛 DEBUG: build_config entries:`,
        Array.from(buildConfigMap.entries()),
      );

      const auditTypeEntry = buildConfigMap.get('audit_type');
      console.log(`   🐛 DEBUG: auditTypeEntry:`, auditTypeEntry);

      const auditType =
        auditTypeEntry && 'Text' in auditTypeEntry
          ? auditTypeEntry.Text
          : 'build_reproducibility_v1'; // Default to build verification

      console.log(`   Audit Type: ${auditType}`);

      // Route to appropriate verification function based on audit type
      if (auditType === 'tools_v1') {
        // === MCP TOOLS VERIFICATION ===
        console.log(`\n🔨 Starting MCP tools verification...`);
        console.log(
          `   ℹ️  Skipping rebuild - tools_v1 only runs after build consensus`,
        );

        // Download the WASM directly from the registry instead of rebuilding
        // This is safe because tools_v1 bounties only exist after build_reproducibility_v1 consensus
        let wasmPath: string;
        try {
          const { downloadWasmByHash } = await import('./builder.js');
          const downloadResult = await downloadWasmByHash(job.wasm_id);
          wasmPath = downloadResult.wasmPath;
        } catch (downloadError) {
          console.log(`❌ Failed to download WASM from registry`);
          console.log(`   Reason: ${downloadError}`);

          completedBounties.add(job.bounty_id);
          saveCompletedBounties(completedBounties);

          await submitDivergenceWithApiKey(VERIFIER_API_KEY!, {
            bountyId: job.bounty_id,
            wasmId: job.wasm_id,
            reason: `Failed to download WASM: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`,
          });

          console.log(`   ✅ Divergence report filed successfully\n`);
          return;
        }

        console.log(`✅ WASM downloaded! Now discovering MCP tools...`);

        // Verify MCP tools using PocketIC
        const toolsResult = await verifyMcpTools(wasmPath, job.wasm_id);

        if (toolsResult.success && toolsResult.tools) {
          console.log(
            `✅ Tools verified! Discovered ${toolsResult.tools.length} tools`,
          );

          completedBounties.add(job.bounty_id);
          saveCompletedBounties(completedBounties);

          const attestationData: AttestationData = {
            '126:audit_type': 'tools_v1',
            tools: toolsResult.tools,
            verifier_version: '4.0.0', // Tools audit version
            build_timestamp: Date.now() * 1_000_000,
            git_commit: job.commit_hash,
            repo_url: job.repo,
          };

          await fileAttestationWithApiKey(VERIFIER_API_KEY!, {
            bounty_id: job.bounty_id,
            wasm_id: job.wasm_id,
            attestationData,
          });

          console.log(`   ✅ Tools attestation filed successfully`);
          console.log(`   📋 Tools discovered:`);
          toolsResult.tools.forEach((tool) => {
            console.log(
              `      - ${tool.name}: ${tool.description || 'No description'}`,
            );
          });
        } else {
          console.log(`❌ Tools verification failed`);
          console.log(`   Reason: ${toolsResult.error}`);

          completedBounties.add(job.bounty_id);
          saveCompletedBounties(completedBounties);

          await submitDivergenceWithApiKey(VERIFIER_API_KEY!, {
            bountyId: job.bounty_id,
            wasmId: job.wasm_id,
            reason: toolsResult.error || 'MCP tools verification failed',
          });

          console.log(`   ✅ Divergence report filed successfully\n`);
        }
      } else {
        // === BUILD REPRODUCIBILITY VERIFICATION (default) ===
        console.log(`\n🔨 Starting reproducible build...`);
        const buildResult = await verifyBuild(
          job.repo,
          job.commit_hash,
          job.wasm_id,
        );

        console.log(`\n📊 Build completed in ${buildResult.duration}s`);

        if (buildResult.success) {
          // Success: File attestation
          console.log(`✅ Build verified! Hash matches. Filing attestation...`);

          // Mark bounty as completed BEFORE filing so we don't retry on error
          completedBounties.add(job.bounty_id);
          saveCompletedBounties(completedBounties);

          const attestationData: AttestationData = {
            '126:audit_type': 'build_reproducibility_v1',
            build_duration_seconds: buildResult.duration,
            verifier_version: '4.0.0', // Updated version supporting multiple audit types
            build_timestamp: Date.now() * 1_000_000,
            git_commit: job.commit_hash,
            repo_url: job.repo,
          };

          if (buildResult.buildLog) {
            attestationData['build_log_excerpt'] = buildResult.buildLog.slice(
              0,
              500,
            );
          }

          await fileAttestationWithApiKey(VERIFIER_API_KEY!, {
            bounty_id: job.bounty_id,
            wasm_id: job.wasm_id,
            attestationData,
          });

          console.log(`   ✅ Attestation filed successfully`);
          console.log(`   ⏳ Waiting for 5-of-9 consensus...`);
          console.log(
            `   💰 Payout will be automatic after consensus is reached\n`,
          );
        } else {
          // Failure: File divergence
          console.log(
            `❌ Build verification failed. Filing divergence report...`,
          );
          console.log(`   Reason: ${buildResult.error}`);

          // Mark bounty as completed BEFORE filing so we don't retry on error
          completedBounties.add(job.bounty_id);
          saveCompletedBounties(completedBounties);

          await submitDivergenceWithApiKey(VERIFIER_API_KEY!, {
            bountyId: job.bounty_id,
            wasmId: job.wasm_id,
            reason: buildResult.error || 'Build failed or hash mismatch',
          });

          console.log(`   ✅ Divergence report filed successfully`);
          console.log(`   ⏳ Waiting for 5-of-9 consensus...`);
          console.log(
            `   ❌ WASM ${job.wasm_id.slice(0, 12)}... divergence reported\n`,
          );
        }
      }

      // Don't release the assignment - let it stay locked until verification completes
      // This prevents the verifier from being re-assigned to the same WASM
      console.log(`   🔒 Assignment remains locked until consensus`);

      // Successfully processed job - exit the retry loop
      return;
    } catch (error: any) {
      console.error(`\n❌ Error processing job:`);
      console.error(`   ${error.message}`);

      // On error, release the assignment so the bounty can be re-assigned
      try {
        const job = await requestVerificationJob(VERIFIER_API_KEY!);
        if (job) {
          await releaseJobAssignment(VERIFIER_API_KEY!, job.bounty_id);
          console.error(`   🔓 Job assignment released after error`);
        }
      } catch (releaseError: any) {
        console.error(
          `   ⚠️  Failed to release assignment: ${releaseError.message}`,
        );
      }
      // Don't retry on error - wait for next poll
      return;
    }
  } // end for loop

  console.log(
    `   ⚠️  Could not find a valid job after ${MAX_JOB_ATTEMPTS} attempts`,
  );
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
  await pollAndVerifyWithJobQueue();

  // Then poll on interval
  setInterval(async () => {
    await pollAndVerifyWithJobQueue();
  }, POLL_INTERVAL_MS);

  console.log(`✅ Verifier Bot is now running`);
  console.log(`   Polling every ${POLL_INTERVAL_MS / 1000} seconds\n`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
