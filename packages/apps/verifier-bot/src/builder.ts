import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { BuildResult } from './types.js';
import {
  bootstrapBuildFiles,
  getMocVersionFromMopsToml,
  validateMotokoProject,
} from '@prometheus-protocol/reproducible-build';
import { downloadWasmByHash as downloadWasmFromRegistry } from '@prometheus-protocol/ic-js';

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => T,
  maxRetries: number = 3,
  initialDelay: number = 5000,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || String(error);

      // Check if it's a rate limit error
      const isRateLimit =
        errorMsg.includes('API rate limit exceeded') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('429');

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(
          `⏳ Rate limit detected. Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else if (attempt < maxRetries - 1) {
        // For other errors, retry with shorter delay
        const delay = 2000 * Math.pow(2, attempt);
        console.log(
          `⚠️  Build failed. Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Verifies that a git repository at a specific commit produces the expected WASM hash.
 * Uses Docker-based reproducible builds to ensure deterministic compilation.
 * Automatically detects the canister name from dfx.json.
 */
export async function verifyBuild(
  repo: string,
  commitHash: string,
  expectedWasmHash: string,
): Promise<BuildResult> {
  const startTime = Date.now();
  const workDir = `/tmp/verify-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Generate unique container name for this build (used in try and finally blocks)
  const containerName = `verify-container-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${process.pid}`;

  try {
    console.log(`📦 Cloning ${repo}...`);
    execSync(`git clone --depth 1 ${repo} ${workDir}`, {
      timeout: 120_000,
      stdio: 'pipe',
    });

    console.log(`🔀 Fetching commit ${commitHash.slice(0, 8)}...`);
    execSync(`git -C ${workDir} fetch origin ${commitHash}`, {
      timeout: 60_000,
      stdio: 'pipe',
    });

    console.log(`🔀 Checking out commit...`);
    execSync(`git -C ${workDir} checkout ${commitHash}`, {
      timeout: 10_000,
      stdio: 'pipe',
    });

    // Auto-detect canister name from dfx.json
    const canisterName = extractCanisterNameFromDfx(workDir);
    console.log(`📦 Detected canister: ${canisterName}`);

    // Locate the canister directory
    const canisterPath = findCanisterPath(workDir, canisterName);
    console.log(`📂 Canister path: ${canisterPath}`);

    // Set up reproducible build environment
    await setupReproducibleBuild(canisterPath, canisterName, workDir);

    // Clean any existing output and Docker resources to ensure fresh build
    const outPath = path.join(canisterPath, 'out');
    if (fs.existsSync(outPath)) {
      console.log(`🧹 Cleaning existing output directory...`);
      execSync(`rm -rf ${outPath}`, { cwd: canisterPath });
    }

    console.log(`🧹 Cleaning Docker compose resources...`);
    try {
      // Use a shared network to avoid exhausting Docker's subnet pool
      execSync(`docker-compose down`, {
        cwd: canisterPath,
        timeout: 60_000,
        stdio: 'pipe',
      });
    } catch (e) {
      // Ignore errors if compose isn't running
    }

    // Ensure shared network exists for all builds
    try {
      execSync(`docker network inspect verifier-shared-network`, {
        timeout: 5_000,
        stdio: 'pipe',
      });
    } catch (e) {
      // Network doesn't exist, create it
      console.log(`🌐 Creating shared network for reproducible builds...`);
      execSync(`docker network create verifier-shared-network`, {
        timeout: 10_000,
        stdio: 'pipe',
      });
    }

    console.log(`🔨 Building Docker image (no cache)...`);
    await retryWithBackoff(
      () => {
        const buildCmd = process.env.GITHUB_TOKEN
          ? `docker-compose build --no-cache --build-arg GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`
          : `docker-compose build --no-cache`;
        console.log(
          `🐛 DEBUG: Executing command: ${buildCmd.replace(process.env.GITHUB_TOKEN || '', '[TOKEN]')}`,
        );
        console.log(`🐛 DEBUG: CWD: ${canisterPath}`);
        console.log(
          `🐛 DEBUG: GITHUB_TOKEN present: ${!!process.env.GITHUB_TOKEN}`,
        );
        try {
          const result = execSync(buildCmd, {
            cwd: canisterPath,
            timeout: 600_000, // 10 minutes max
            stdio: 'inherit', // Changed to inherit to see actual Docker output
            env: { ...process.env },
            shell: '/bin/sh',
          });
          console.log(`🐛 DEBUG: Build command succeeded`);
          return result;
        } catch (error: any) {
          console.log(
            `🐛 DEBUG: Build command failed with exit code: ${error.status}`,
          );
          console.log(
            `🐛 DEBUG: Error output: ${error.stderr?.toString().substring(0, 500)}`,
          );
          throw error;
        }
      },
      3,
      5000,
    );

    console.log(`🔨 Running build in Docker...`);
    // Use --rm to auto-remove container after build completes
    // Use a unique container name (defined at function scope for cleanup access)
    // Network is configured in docker-compose.yml to use shared network
    const buildLog = await retryWithBackoff(
      () => {
        return execSync(
          `docker-compose run --rm --name ${containerName} wasm`,
          {
            cwd: canisterPath,
            timeout: 600_000, // 10 minutes max
            stdio: 'pipe',
            env: {
              ...process.env,
              DOCKER_BUILDKIT: '1',
            },
          },
        ).toString();
      },
      3,
      5000,
    );

    console.log(`📋 Build output:\n${buildLog.slice(-500)}`); // Last 500 chars

    // Extract hash from build output (format: "HASH  out/out_Linux_x86_64.wasm")
    const hashMatch = buildLog.match(
      /([a-f0-9]{64})\s+out\/out_Linux_x86_64\.wasm/,
    );
    if (!hashMatch) {
      throw new Error('Could not extract WASM hash from build output');
    }

    const actualHash = hashMatch[1];
    const duration = Math.floor((Date.now() - startTime) / 1000);

    console.log(`📊 Expected hash: ${expectedWasmHash}`);
    console.log(`📊 Actual hash:   ${actualHash}`);

    if (actualHash === expectedWasmHash) {
      console.log(`✅ Hash match! Build verified.`);
      const wasmPath = path.join(canisterPath, 'out', 'out_Linux_x86_64.wasm');
      return {
        success: true,
        wasmHash: actualHash,
        wasmPath,
        buildLog: buildLog.slice(-1000), // Keep last 1KB
        duration,
      };
    } else {
      console.log(`❌ Hash mismatch!`);
      return {
        success: false,
        error: `Hash mismatch. Expected: ${expectedWasmHash}, Got: ${actualHash}`,
        buildLog: buildLog.slice(-1000),
        duration,
      };
    }
  } catch (error: any) {
    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Redact GITHUB_TOKEN from error messages to prevent leaking credentials
    let errorMessage = error.message;
    if (process.env.GITHUB_TOKEN) {
      errorMessage = errorMessage.replace(
        new RegExp(process.env.GITHUB_TOKEN, 'g'),
        '[REDACTED]',
      );
    }

    console.error(`❌ Build error:`, errorMessage);

    return {
      success: false,
      error: `Build failed: ${errorMessage}`,
      duration,
    };
  } finally {
    // Cleanup
    try {
      console.log(`🧹 Cleaning up ${workDir}...`);

      // First, try to remove root-owned files using Docker
      const outPath = path.join(workDir, 'out');
      if (fs.existsSync(outPath)) {
        try {
          console.log(`🐳 Using Docker to remove root-owned files...`);
          // Use alpine container to remove files as root
          // Remove contents but not the mount point itself
          execSync(
            `docker run --rm -v ${outPath}:/cleanup alpine sh -c "rm -rf /cleanup/*"`,
            { timeout: 10_000, stdio: 'pipe' },
          );
        } catch (dockerErr) {
          console.log('⚠️  Docker cleanup failed, files may remain');
        }
      }

      // Clean up THIS SPECIFIC container only (if it still exists)
      // IMPORTANT: Only clean up our container, not others that might be running concurrently
      try {
        const containers = execSync(
          `docker ps -a -q -f name=${containerName}`,
          { encoding: 'utf-8', timeout: 5_000 },
        )
          .trim()
          .split('\n')
          .filter(Boolean);

        if (containers.length > 0) {
          console.log(`🐳 Removing this build's container: ${containerName}`);
          for (const containerId of containers) {
            execSync(`docker rm -f ${containerId}`, {
              timeout: 10_000,
              stdio: 'pipe',
            });
          }
        }
      } catch (dockerErr) {
        // Ignore errors
      }

      // Clean up Docker networks created for this build
      try {
        const canisterPath = findCanisterPath(
          workDir,
          extractCanisterNameFromDfx(workDir),
        );
        execSync(`docker-compose down`, {
          cwd: canisterPath,
          timeout: 30_000,
          stdio: 'pipe',
        });
      } catch (dockerErr) {
        // Ignore errors
      }

      // Now remove the entire work directory
      execSync(`rm -rf ${workDir}`, { timeout: 30_000 });
      console.log(`✅ Cleanup completed successfully`);
    } catch (e) {
      console.error('⚠️  Cleanup failed (non-critical):', e);
    }
  }
}

/**
 * Extracts the canister name from dfx.json by finding which canister
 * has src/main.mo as its main file.
 */
function extractCanisterNameFromDfx(repoPath: string): string {
  try {
    const dfxJsonPath = path.join(repoPath, 'dfx.json');

    if (!fs.existsSync(dfxJsonPath)) {
      console.warn(`   ⚠️  dfx.json not found, using fallback`);
      return 'canister';
    }

    const dfxJson = JSON.parse(fs.readFileSync(dfxJsonPath, 'utf8'));

    if (!dfxJson.canisters) {
      console.warn(`   ⚠️  No canisters in dfx.json, using fallback`);
      return 'canister';
    }

    // Look for a canister with src/main.mo as its main file
    for (const [name, config] of Object.entries(dfxJson.canisters)) {
      const canisterConfig = config as any;

      // Check if this is a Motoko canister with src/main.mo
      if (
        canisterConfig.type === 'motoko' &&
        (canisterConfig.main === 'src/main.mo' ||
          canisterConfig.main?.endsWith('/src/main.mo'))
      ) {
        return name;
      }
    }

    // If no exact match, return the first Motoko canister
    for (const [name, config] of Object.entries(dfxJson.canisters)) {
      const canisterConfig = config as any;
      if (canisterConfig.type === 'motoko') {
        return name;
      }
    }

    console.warn(`   ⚠️  No Motoko canisters in dfx.json, using fallback`);
    return 'canister';
  } catch (error: any) {
    console.warn(`   ⚠️  Error reading dfx.json: ${error.message}`);
    return 'canister';
  }
}

/**
 * Finds the canister source directory in the cloned repository.
 */
function findCanisterPath(workDir: string, canisterName: string): string {
  // Try standard locations
  const candidates = [
    path.join(workDir, 'packages/canisters', canisterName),
    path.join(workDir, 'canisters', canisterName),
    path.join(workDir, 'src'),
    workDir,
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'src'))) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find canister source directory for ${canisterName}`,
  );
}

/**
 * Sets up the reproducible build environment in the canister directory.
 * Uses the shared reproducible-build library for consistent builds.
 */
async function setupReproducibleBuild(
  canisterPath: string,
  canisterName: string,
  repoRoot: string,
): Promise<void> {
  console.log(`📝 Setting up reproducible build...`);

  // For monorepos, check repo root for mops.toml first, then canister path
  let mocVersion: string | null = null;
  let mopsPath = path.join(repoRoot, 'mops.toml');
  
  if (fs.existsSync(mopsPath)) {
    console.log(`📦 Found mops.toml at repo root`);
    mocVersion = getMocVersionFromMopsToml(repoRoot);
  } else {
    mopsPath = path.join(canisterPath, 'mops.toml');
    if (fs.existsSync(mopsPath)) {
      console.log(`📦 Found mops.toml in canister directory`);
      mocVersion = getMocVersionFromMopsToml(canisterPath);
    }
  }
  
  mocVersion = mocVersion || '0.16.0';
  console.log(`📦 Using moc version: ${mocVersion}`);

  // If mops.toml doesn't exist anywhere, create it in canister path
  if (!fs.existsSync(path.join(repoRoot, 'mops.toml')) && !fs.existsSync(path.join(canisterPath, 'mops.toml'))) {
    console.log(`📝 Generating mops.toml with moc version ${mocVersion}...`);
    await generateMopsToml(canisterPath, canisterName, repoRoot, mocVersion);
  }
  
  // For monorepos: if mops.toml is at repo root, copy it to canister path for Docker
  const repoMopsPath = path.join(repoRoot, 'mops.toml');
  const canisterMopsPath = path.join(canisterPath, 'mops.toml');
  if (fs.existsSync(repoMopsPath) && !fs.existsSync(canisterMopsPath) && repoRoot !== canisterPath) {
    console.log(`📋 Copying mops.toml from repo root to canister directory`);
    fs.copyFileSync(repoMopsPath, canisterMopsPath);
  }
  
  // Also copy .mops directory if it exists at repo root (contains downloaded packages)
  const repoMopsDir = path.join(repoRoot, '.mops');
  const canisterMopsDir = path.join(canisterPath, '.mops');
  if (fs.existsSync(repoMopsDir) && !fs.existsSync(canisterMopsDir) && repoRoot !== canisterPath) {
    console.log(`📋 Copying .mops directory from repo root to canister directory`);
    fs.cpSync(repoMopsDir, canisterMopsDir, { recursive: true });
  }

  // Validate project structure
  const validation = validateMotokoProject(canisterPath);
  if (!validation.valid) {
    throw new Error(
      `Invalid Motoko project. Missing: ${validation.missing.join(', ')}`,
    );
  }

  // Use shared library to bootstrap build files
  bootstrapBuildFiles({
    projectPath: canisterPath,
    mocVersion,
  });

  console.log(`✅ Reproducible build environment ready`);
}

/**
 * Generates a mops.toml file with dependencies and toolchain version.
 * This is only used as a fallback if the project doesn't have mops.toml.
 */
async function generateMopsToml(
  canisterPath: string,
  canisterName: string,
  repoRoot: string,
  mocVersion: string,
): Promise<void> {
  // Try to read dfx.json from repo root for dependencies
  const dfxPath = path.join(repoRoot, 'dfx.json');

  // Default dependencies for Motoko projects
  const dependencies = {
    base: '0.16.0',
  };

  try {
    if (fs.existsSync(dfxPath)) {
      const dfxJson = JSON.parse(fs.readFileSync(dfxPath, 'utf8'));
      // Could enhance this to extract dependencies from dfx.json if needed
    }
  } catch (error) {
    console.warn(`⚠️  Could not read dfx.json, using minimal dependencies`);
  }

  const mopsToml = `[package]
name = "${canisterName}"
version = "1.0.0"
description = "Verified canister"

[dependencies]
${Object.entries(dependencies)
  .map(([pkg, ver]) => `${pkg} = "${ver}"`)
  .join('\n')}

[toolchain]
moc = "${mocVersion}"
`;

  fs.writeFileSync(path.join(canisterPath, 'mops.toml'), mopsToml);
  console.log(`✅ Generated mops.toml with moc version ${mocVersion}`);
}

/**
 * Downloads a WASM from the registry by its hash and saves it to a temporary location.
 * This is used for tools_v1 verification to skip rebuilding when we already have
 * consensus that the build is reproducible.
 *
 * @param wasmHash The hex hash of the WASM to download
 * @returns Path to the downloaded WASM file
 */
export async function downloadWasmByHash(
  wasmHash: string,
): Promise<{ wasmPath: string }> {
  const startTime = Date.now();

  try {
    console.log(`📥 Downloading WASM from registry...`);
    console.log(`   Hash: ${wasmHash}`);

    // Download the complete WASM from the registry
    const wasmBytes = await downloadWasmFromRegistry(wasmHash);

    // Create a temporary directory for this WASM
    const workDir = `/tmp/wasm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    fs.mkdirSync(workDir, { recursive: true });

    // Save WASM to disk
    const wasmPath = path.join(workDir, 'downloaded.wasm');
    fs.writeFileSync(wasmPath, wasmBytes);

    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.log(`✅ WASM downloaded successfully (${duration}s)`);
    console.log(`   Path: ${wasmPath}`);
    console.log(`   Size: ${wasmBytes.length} bytes`);

    return { wasmPath };
  } catch (error) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.error(`❌ Failed to download WASM:`, error);
    throw new Error(
      `Failed to download WASM after ${duration}s: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
