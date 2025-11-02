import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { BuildResult } from './types.js';

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

  try {
    console.log(`📦 Cloning ${repo}...`);
    execSync(`git clone --depth 1 ${repo} ${workDir}`, {
      timeout: 120_000,
      stdio: 'pipe',
    });

    console.log(`🔀 Fetching commit ${commitHash.slice(0, 8)}...`);
    execSync(`git -C ${workDir} fetch --depth 1 origin ${commitHash}`, {
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

    console.log(`🔨 Building with Docker (this may take several minutes)...`);
    const buildLog = execSync(`docker-compose run --rm wasm`, {
      cwd: canisterPath,
      timeout: 600_000, // 10 minutes max
      stdio: 'pipe',
      env: {
        ...process.env,
        DOCKER_BUILDKIT: '1',
      },
    }).toString();

    console.log(`📋 Build output:\n${buildLog.slice(-500)}`); // Last 500 chars

    // Read the output WASM
    const wasmPath = path.join(canisterPath, 'out', 'out_Linux_x86_64.wasm');
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Built WASM not found at ${wasmPath}`);
    }

    const wasmBytes = fs.readFileSync(wasmPath);
    const actualHash = crypto
      .createHash('sha256')
      .update(wasmBytes)
      .digest('hex');

    const duration = Math.floor((Date.now() - startTime) / 1000);

    console.log(`📊 Expected hash: ${expectedWasmHash}`);
    console.log(`📊 Actual hash:   ${actualHash}`);

    if (actualHash === expectedWasmHash) {
      console.log(`✅ Hash match! Build verified.`);
      return {
        success: true,
        wasmHash: actualHash,
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
    console.error(`❌ Build error:`, error.message);

    return {
      success: false,
      error: `Build failed: ${error.message}`,
      duration,
    };
  } finally {
    // Cleanup
    try {
      console.log(`🧹 Cleaning up ${workDir}...`);
      execSync(`rm -rf ${workDir}`, { timeout: 30_000 });
    } catch (e) {
      console.error('⚠️  Cleanup failed:', e);
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
 * Copies Docker templates and generates necessary config files.
 */
async function setupReproducibleBuild(
  canisterPath: string,
  canisterName: string,
  repoRoot: string,
): Promise<void> {
  const templatePath = path.join('/app', 'templates', 'reproducible-build');

  console.log(`📝 Setting up reproducible build...`);

  // Read moc version from project's mops.toml
  const mopsPath = path.join(canisterPath, 'mops.toml');
  let mocVersion = '0.16.0'; // Default fallback

  if (fs.existsSync(mopsPath)) {
    console.log(`📖 Reading toolchain version from mops.toml...`);
    const mopsContent = fs.readFileSync(mopsPath, 'utf8');

    // Parse [toolchain] section
    const toolchainMatch = mopsContent.match(
      /\[toolchain\][^\[]*moc\s*=\s*["']([^"']+)["']/,
    );
    if (toolchainMatch) {
      mocVersion = toolchainMatch[1];
      console.log(`🔧 Detected moc version: ${mocVersion}`);
    } else {
      console.warn(
        `⚠️  No [toolchain] moc version found in mops.toml, using default: ${mocVersion}`,
      );
    }
  } else {
    console.warn(`⚠️  mops.toml not found at ${mopsPath}`);
    console.log(
      `📝 Generating mops.toml with default moc version ${mocVersion}...`,
    );
    await generateMopsToml(canisterPath, canisterName, repoRoot, mocVersion);
  }

  // Copy Docker build templates and update with correct moc version
  for (const file of [
    'docker-compose.yml',
    'Dockerfile',
    'Dockerfile.base',
    'build.sh',
  ]) {
    const srcPath = path.join(templatePath, file);
    const destPath = path.join(canisterPath, file);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Template file not found: ${srcPath}`);
    }

    let content = fs.readFileSync(srcPath, 'utf8');

    // Update docker-compose.yml with the project's moc version
    if (file === 'docker-compose.yml') {
      // Replace the moc version in the x-base-image section
      content = content.replace(/moc: &moc [0-9.]+/, `moc: &moc ${mocVersion}`);
      content = content.replace(/dfx: &dfx [0-9.]+/, `dfx: &dfx ${mocVersion}`);
      content = content.replace(
        /ghcr\.io\/[^:]+:moc-[0-9.]+/,
        `ghcr.io/research-ag/motoko-build:moc-${mocVersion}`,
      );

      console.log(
        `🐳 Using Docker image: ghcr.io/research-ag/motoko-build:moc-${mocVersion}`,
      );
    }

    fs.writeFileSync(destPath, content);

    // Make build.sh executable
    if (file === 'build.sh') {
      fs.chmodSync(destPath, 0o755);
    }
  }

  // Ensure out/ directory exists
  const outDir = path.join(canisterPath, 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

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
