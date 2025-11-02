import {
  listPendingVerifications,
  getBountiesForWasm,
  reserveBounty,
  fileAttestation,
  submitDivergence,
  AttestationData,
} from '@prometheus-protocol/ic-js';
import { verifyBuild } from './builder.js';
import { identityFromPemContent } from './identity.js';
import type { VerificationJob, BountyInfo } from './types.js';

// Configuration from environment variables
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);
const VERIFIER_PEM = process.env.VERIFIER_PEM;
const IC_NETWORK = process.env.IC_NETWORK || 'ic';

if (!VERIFIER_PEM) {
  console.error('❌ VERIFIER_PEM environment variable is required');
  process.exit(1);
}

// Initialize verifier identity
const VERIFIER_IDENTITY = identityFromPemContent(VERIFIER_PEM);
const VERIFIER_PRINCIPAL = VERIFIER_IDENTITY.getPrincipal().toText();

console.log('🤖 Prometheus Protocol Verifier Bot');
console.log('====================================');
console.log(`🆔 Verifier Principal: ${VERIFIER_PRINCIPAL}`);
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
        const bounties = await getBountiesForWasm(job.wasm_hash);

        const buildBounty = bounties.find((b: any) => {
          const auditType = b.challengeParameters?.audit_type;
          return auditType === 'build_reproducibility_v1';
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

        // Reserve the bounty (stake reputation)
        console.log(`\n🔒 Reserving bounty...`);
        await reserveBounty(VERIFIER_IDENTITY, {
          bounty_id: buildBounty.id,
          token_id: 'build_reproducibility_v1',
        });
        console.log(`   ✅ Bounty reserved, stake locked for 3 days`);

        // Extract canister name from metadata (if available)
        const canisterName =
          job.metadata?.canister_name || extractCanisterNameFromRepo(job.repo);
        console.log(`   📦 Canister: ${canisterName}`);

        // Run the reproducible build
        console.log(`\n🔨 Starting reproducible build...`);
        const result = await verifyBuild(
          job.repo,
          job.commit_hash,
          job.wasm_hash,
          canisterName,
        );

        console.log(`\n📊 Build completed in ${result.duration}s`);

        if (result.success) {
          // Success: File attestation
          console.log(`✅ Build verified! Hash matches. Filing attestation...`);

          const attestationData: AttestationData = {
            '126:audit_type': 'build_reproducibility_v1',
            build_duration_seconds: result.duration,
            verifier_version: '1.0.0',
            verifier_principal: VERIFIER_PRINCIPAL,
            build_timestamp: Date.now(),
          };

          // Add truncated build log if available
          if (result.buildLog) {
            attestationData['build_log_excerpt'] = result.buildLog.slice(
              0,
              500,
            );
          }

          await fileAttestation(VERIFIER_IDENTITY, {
            bounty_id: buildBounty.id,
            wasm_id: job.wasm_hash,
            attestationData,
          });

          console.log(`   ✅ Attestation filed successfully`);
          console.log(
            `   ✅ WASM ${job.wasm_hash.slice(0, 12)}... is now VERIFIED`,
          );
          console.log(`   💰 Bounty claimed automatically\n`);
        } else {
          // Failure: File divergence
          console.log(
            `❌ Build verification failed. Filing divergence report...`,
          );
          console.log(`   Reason: ${result.error}`);

          await submitDivergence(VERIFIER_IDENTITY, {
            bountyId: buildBounty.id,
            wasmId: job.wasm_hash,
            reason: result.error || 'Build failed or hash mismatch',
          });

          console.log(`   ✅ Divergence report filed`);
          console.log(
            `   ❌ WASM ${job.wasm_hash.slice(0, 12)}... is now REJECTED`,
          );
          console.log(`   💰 Bounty claimed for reporting divergence\n`);
        }
      } catch (error: any) {
        console.error(`\n❌ Error processing ${jobSummary}:`);
        console.error(`   ${error.message}`);

        // If we reserved the bounty but failed to submit results,
        // the lock will expire in 3 days and our stake will be slashed.
        // This is intentional to prevent griefing attacks.
        console.error(`   ⚠️  Lock will expire in 3 days if not resolved`);
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Polling error: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * Attempts to extract the canister name from the repository URL.
 * Falls back to 'mcp_registry' if extraction fails.
 */
function extractCanisterNameFromRepo(repo: string): string {
  try {
    // Try to extract from repo name (e.g., "mcp-registry" -> "mcp_registry")
    const match = repo.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1].replace(/-/g, '_');
    }
  } catch (e) {
    // Ignore
  }
  return 'mcp_registry'; // Sensible default
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
